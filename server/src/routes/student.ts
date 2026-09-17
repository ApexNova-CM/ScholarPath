import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../db/store';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { UpdateProfileSchema, ApplicationRecord, StoredDocumentRecord } from '../types';
import { config } from '../config';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// All student routes require student authentication
router.use(authenticateToken);

// GET /api/v1/student/dashboard
router.get('/dashboard', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const profile = db.getProfile(userId);
  const applications = db.getApplicationsByUser(userId);
  const notifications = db.getNotificationsByUser(userId);
  const savedIds = db.getSavedIdsByUser(userId);
  const allScholarships = db.getScholarships().filter((s) => s.verificationStatus === 'verified' && s.status !== 'archived');

  // Pipeline counts
  const appCounts = {
    total: applications.length,
    preparing: applications.filter((a) => a.status === 'Preparing').length,
    applied: applications.filter((a) => a.status === 'Applied').length,
    underReview: applications.filter((a) => a.status === 'Under Review').length,
    interview: applications.filter((a) => a.status === 'Interview').length,
    awarded: applications.filter((a) => a.status === 'Awarded').length,
  };

  // Upcoming deadlines (within next 45 days)
  const now = new Date().getTime();
  const upcoming = allScholarships
    .filter((s) => {
      const diff = (new Date(s.deadline).getTime() - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 45;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);

  res.json({
    success: true,
    data: {
      profile,
      appCounts,
      upcomingScholarships: upcoming,
      savedIds,
      recentApplications: applications.slice(0, 5),
      recentNotifications: notifications.slice(0, 5),
    },
  });
});

// GET /api/v1/student/profile
router.get('/profile', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  let profile = db.getProfile(userId);
  if (!profile) {
    const user = db.findUserById(userId);
    profile = db.upsertProfile({
      userId,
      firstName: '',
      lastName: '',
      country: 'International',
      educationLevel: 'Undergraduate',
      institution: '',
      fieldOfStudy: '',
      gpa: 0,
      gpaScale: 4.0,
      profileCompletion: 0,
      createdAt: user?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    data: profile,
  });
});

// PUT /api/v1/student/profile
router.put('/profile', validateBody(UpdateProfileSchema), (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const existing = db.getProfile(userId);

  const updated = db.upsertProfile({
    ...(existing || {
      userId,
      firstName: '',
      lastName: '',
      country: 'International',
      educationLevel: 'Undergraduate',
      institution: '',
      fieldOfStudy: '',
      gpa: 0,
      gpaScale: 4.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    ...req.body,
    userId,
  });

  res.json({
    success: true,
    data: updated,
  });
});

// GET /api/v1/student/saved
router.get('/saved', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const savedIds = db.getSavedIdsByUser(userId);
  const scholarships = savedIds
    .map((id) => db.findScholarshipById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  res.json({
    success: true,
    data: {
      ids: savedIds,
      scholarships,
    },
  });
});

// POST /api/v1/student/saved/:scholarshipId
router.post('/saved/:scholarshipId', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const scholarshipId = req.params.scholarshipId;

  const result = db.toggleSaved(userId, scholarshipId);
  res.json({
    success: true,
    data: result,
  });
});

// GET /api/v1/student/applications
router.get('/applications', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const applications = db.getApplicationsByUser(userId);
  res.json({
    success: true,
    data: applications,
  });
});

// POST /api/v1/student/applications
router.post('/applications', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const { scholarshipId, notes } = req.body;

  if (!scholarshipId) {
    res.status(400).json({
      success: false,
      error: { code: 'SCHOLARSHIP_ID_REQUIRED', message: 'Scholarship ID is required.' },
    });
    return;
  }

  const scholarship = db.findScholarshipById(scholarshipId);
  if (!scholarship) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  // Check if already tracking
  const existingApps = db.getApplicationsByUser(userId);
  const alreadyTracking = existingApps.find((a) => a.scholarshipId === scholarshipId);
  if (alreadyTracking) {
    res.json({
      success: true,
      data: alreadyTracking,
    });
    return;
  }

  const checklist = (scholarship.requiredDocuments || []).map((docName) => ({
    id: `chk-${crypto.randomUUID().slice(0, 8)}`,
    label: docName,
    completed: false,
    required: true,
  }));

  const newApp: ApplicationRecord = {
    id: `app-${crypto.randomUUID()}`,
    userId,
    scholarshipId: scholarship.id,
    scholarshipTitle: scholarship.title,
    providerName: scholarship.providerName,
    deadline: scholarship.deadline,
    amount: scholarship.amount,
    currency: scholarship.currency,
    status: 'Interested',
    notes: notes || '',
    checklist,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createApplication(newApp);

  // Send confirmation notification
  db.createNotification({
    id: `notif-${crypto.randomUUID()}`,
    userId,
    title: `Started Application: ${scholarship.title}`,
    message: `You began tracking your application. Complete the required checklist before the deadline on ${new Date(scholarship.deadline).toLocaleDateString()}.`,
    type: 'deadline',
    read: false,
    relatedScholarshipId: scholarship.id,
    relatedApplicationId: newApp.id,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    data: newApp,
  });
});

// PATCH /api/v1/student/applications/:id
router.patch('/applications/:id', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const app = db.findApplicationById(req.params.id);

  if (!app) {
    res.status(404).json({
      success: false,
      error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
    });
    return;
  }

  if (app.userId !== userId && req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You cannot update another student’s application.' },
    });
    return;
  }

  const updates = req.body;
  if (updates.status && updates.status === 'Applied' && !app.appliedAt) {
    updates.appliedAt = new Date().toISOString();
  }

  const updated = db.updateApplication(app.id, updates);
  res.json({
    success: true,
    data: updated,
  });
});

// PUT /api/v1/student/applications/:id/checklist
router.put('/applications/:id/checklist', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const app = db.findApplicationById(req.params.id);

  if (!app) {
    res.status(404).json({
      success: false,
      error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
    });
    return;
  }

  if (app.userId !== userId && req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied.' },
    });
    return;
  }

  const { checklistItemId, completed, documentId } = req.body;
  const updatedChecklist = app.checklist.map((item) => {
    if (item.id === checklistItemId) {
      return {
        ...item,
        completed: completed !== undefined ? completed : item.completed,
        documentId: documentId !== undefined ? documentId : item.documentId,
      };
    }
    return item;
  });

  const updated = db.updateApplication(app.id, { checklist: updatedChecklist });
  res.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/student/applications/:id
router.delete('/applications/:id', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const app = db.findApplicationById(req.params.id);

  if (!app) {
    res.status(404).json({
      success: false,
      error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
    });
    return;
  }

  if (app.userId !== userId && req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied.' },
    });
    return;
  }

  db.deleteApplication(app.id);
  res.json({
    success: true,
    data: { message: 'Application deleted successfully.' },
  });
});

// GET /api/v1/student/documents
router.get('/documents', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const documents = db.getDocumentsByUser(userId);
  res.json({
    success: true,
    data: documents,
  });
});

// POST /api/v1/student/documents/upload
router.post('/documents/upload', upload.single('file'), (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const file = req.file;
  const { name, type } = req.body;

  if (!file && !name) {
    res.status(400).json({
      success: false,
      error: { code: 'FILE_REQUIRED', message: 'Please provide a file or document name.' },
    });
    return;
  }

  const docId = `doc-${crypto.randomUUID()}`;
  const docName = name || file?.originalname || 'Academic Document';
  const fileFormat = file ? path.extname(file.originalname).replace('.', '').toLowerCase() : 'pdf';
  const fileSize = file ? file.size : 1024 * 512;
  const fileUrl = file ? `/uploads/${file.filename}` : `#preview-${docId}`;

  const docRecord: StoredDocumentRecord = {
    id: docId,
    userId,
    name: docName,
    type: type || 'CV / Resume',
    fileFormat,
    fileSize,
    fileUrl,
    verified: false,
    uploadedAt: new Date().toISOString(),
  };

  db.createDocument(docRecord);

  res.status(201).json({
    success: true,
    data: docRecord,
  });
});

// DELETE /api/v1/student/documents/:id
router.delete('/documents/:id', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const doc = db.findDocumentById(req.params.id);

  if (!doc) {
    res.status(404).json({
      success: false,
      error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' },
    });
    return;
  }

  if (doc.userId !== userId && req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot delete another student’s document.' },
    });
    return;
  }

  db.deleteDocument(doc.id);
  res.json({
    success: true,
    data: { message: 'Document deleted successfully.' },
  });
});

// GET /api/v1/student/notifications
router.get('/notifications', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const notifications = db.getNotificationsByUser(userId);
  res.json({
    success: true,
    data: notifications,
  });
});

// PATCH /api/v1/student/notifications/:id/read
router.patch('/notifications/:id/read', (req: Request, res: Response): void => {
  const ok = db.markNotificationRead(req.params.id);
  res.json({
    success: ok,
    data: { read: true },
  });
});

export default router;
