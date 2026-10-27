import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/store';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { UpdateProfileSchema, ApplicationRecord, StoredDocumentRecord, SubscriptionStatus, ApplicationStatus } from '../types';
import { config } from '../config';
import { emailService } from '../services/emailService';
import { processAIChat } from '../services/aiService';
import { isStagingPlusOverrideActive } from '../utils/stagingGuard';

import { getUserSubscriptionStatus, processDueRemindersForUser } from '../services/reminderScheduler';
export { getUserSubscriptionStatus };

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
router.put('/profile', validateBody(UpdateProfileSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const existing = db.getProfile(userId);

  const updated = db.upsertProfile({
    ...(existing || {
      userId,
      firstName: '',
      lastName: '',
      country: 'International',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    ...req.body,
    userId,
  });

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (req.body.firstName !== undefined) updateData.first_name = req.body.firstName;
      if (req.body.lastName !== undefined) updateData.last_name = req.body.lastName;
      if (req.body.country !== undefined) updateData.country = req.body.country;
      if (req.body.applicantStage !== undefined) updateData.applicant_stage = req.body.applicantStage;
      if (req.body.secondarySchoolName !== undefined) updateData.secondary_school_name = req.body.secondarySchoolName;
      if (req.body.secondaryGraduationYear !== undefined) updateData.secondary_graduation_year = req.body.secondaryGraduationYear;
      if (req.body.targetMajor !== undefined) updateData.target_major = req.body.targetMajor;
      if (req.body.tradeSpecialization !== undefined) updateData.trade_specialization = req.body.tradeSpecialization;
      if (req.body.tradeCertifications !== undefined) updateData.trade_certifications = req.body.tradeCertifications;
      if (req.body.yearsOfExperience !== undefined) updateData.years_of_experience = req.body.yearsOfExperience;
      if (req.body.targetIndustry !== undefined) updateData.target_industry = req.body.targetIndustry;
      if (req.body.skills !== undefined) updateData.skills = req.body.skills;
      if (req.body.portfolioUrl !== undefined) updateData.portfolio_url = req.body.portfolioUrl;
      if (req.body.linkedinUrl !== undefined) updateData.linkedin_url = req.body.linkedinUrl;
      if (req.body.githubUrl !== undefined) updateData.github_url = req.body.githubUrl;
      if (req.body.educationLevel !== undefined) updateData.education_level = req.body.educationLevel;
      if (req.body.institution !== undefined) updateData.institution = req.body.institution;
      if (req.body.fieldOfStudy !== undefined) updateData.field_of_study = req.body.fieldOfStudy;
      if (req.body.gpa !== undefined) updateData.gpa = req.body.gpa;
      if (req.body.gpaScale !== undefined) updateData.gpa_scale = req.body.gpaScale;
      await supabase.from('users').update(updateData).eq('id', userId);
    } catch (err) {
      console.warn('[student] error syncing profile update to Supabase:', err);
    }
  }

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

// Helper to retrieve applications for a user merging local DB and Supabase if configured
async function getApplicationsForUser(userId: string): Promise<ApplicationRecord[]> {
  const localApps = db.getApplicationsByUser(userId);
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', userId);
      if (data && Array.isArray(data)) {
        const map = new Map<string, ApplicationRecord>();
        for (const app of localApps) {
          map.set(app.id, app);
        }
        for (const row of data) {
          if (!map.has(row.id)) {
            map.set(row.id, {
              id: row.id,
              userId: row.user_id,
              scholarshipId: row.scholarship_id,
              scholarshipTitle: row.scholarship_title,
              providerName: row.provider_name,
              deadline: row.deadline,
              amount: row.amount,
              currency: row.currency,
              status: row.status,
              notes: row.notes || '',
              appliedAt: row.applied_at,
              submittedAt: row.submitted_at,
              checklist: row.checklist || [],
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
            });
          }
        }
        return Array.from(map.values());
      }
    } catch (err) {
      console.warn('[student] error fetching applications from Supabase:', err);
    }
  }
  return localApps;
}

// GET /api/v1/student/applications
router.get('/applications', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const applications = await getApplicationsForUser(userId);
  res.json({
    success: true,
    data: applications,
  });
});

// GET /api/v1/student/applications/:id
router.get('/applications/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const appId = req.params.id;
  const app = db.findApplicationById(appId);

  if (!app) {
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await supabase.from('applications').select('*').eq('id', appId).maybeSingle();
        if (data) {
          if (data.user_id !== userId && req.user!.role !== 'admin') {
            res.status(403).json({
              success: false,
              error: { code: 'FORBIDDEN', message: 'You cannot access another student’s application.' },
            });
            return;
          }
          res.json({ success: true, data });
          return;
        }
      } catch (err) {
        console.warn('[student] error querying application from Supabase:', err);
      }
    }
    res.status(404).json({
      success: false,
      error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
    });
    return;
  }

  if (app.userId !== userId && req.user!.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You cannot access another student’s application.' },
    });
    return;
  }

  res.json({
    success: true,
    data: app,
  });
});

// POST /api/v1/student/applications
router.post('/applications', async (req: Request, res: Response): Promise<void> => {
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

  // Check if already tracking (idempotent return of historical record)
  const existingApps = await getApplicationsForUser(userId);
  const alreadyTracking = existingApps.find((a) => a.scholarshipId === scholarshipId);
  if (alreadyTracking) {
    res.json({
      success: true,
      data: alreadyTracking,
    });
    return;
  }

  // Reject new applications to closed/expired/archived scholarships
  let isPastDeadline = false;
  if (scholarship.deadline) {
    const d = new Date(scholarship.deadline);
    if (!isNaN(d.getTime())) {
      if (scholarship.deadline.trim().length <= 10) {
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        isPastDeadline = endOfDay.getTime() < Date.now();
      } else {
        isPastDeadline = d.getTime() < Date.now();
      }
    }
  }

  const isClosed =
    scholarship.status === 'closed' ||
    scholarship.status === 'expired' ||
    scholarship.status === 'archived' ||
    (scholarship as any).manuallyClosed === true ||
    isPastDeadline;

  if (isClosed) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SCHOLARSHIP_CLOSED',
        message: 'This scholarship is closed and is no longer accepting new applications.',
      },
    });
    return;
  }

  // Enforce Free plan limit of 3 active applications
  const subStatus = await getUserSubscriptionStatus(userId, req.user?.email);
  if (subStatus !== 'premium' && existingApps.length >= 3) {
    res.status(403).json({
      success: false,
      error: {
        code: 'UPGRADE_REQUIRED',
        message: 'You have reached the Free plan limit of 3 tracked applications. Upgrade to Scholavon Plus for unlimited applications.',
        upgradeUrl: '/pricing',
        currentCount: existingApps.length,
        limit: 3,
      },
    });
    return;
  }

  const checklist = (scholarship.requiredDocuments || []).map((docName) => ({
    id: `chk-${crypto.randomUUID().slice(0, 8)}`,
    label: docName,
    completed: false,
    required: true,
  }));

  const requestedStatus = req.body.status;
  const status: ApplicationStatus = 
    requestedStatus && ['Preparing', 'Interested', 'Applied'].includes(requestedStatus)
      ? requestedStatus
      : 'Preparing';

  const isScholavonNative = scholarship.applicationMethod === 'Scholavon Application';
  const submissionMethod: 'native' | 'external' = isScholavonNative ? 'native' : 'external';

  const newApp: ApplicationRecord = {
    id: `app-${crypto.randomUUID()}`,
    userId,
    scholarshipId: scholarship.id,
    scholarshipTitle: scholarship.title,
    providerName: scholarship.providerName,
    deadline: scholarship.deadline,
    amount: scholarship.amount,
    currency: scholarship.currency,
    status,
    submissionMethod,
    submissionStage: 'draft',
    notes: notes || '',
    checklist,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createApplication(newApp);

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('applications').upsert({
        id: newApp.id,
        user_id: userId,
        scholarship_id: scholarship.id,
        scholarship_title: scholarship.title,
        provider_name: scholarship.providerName,
        deadline: scholarship.deadline,
        amount: scholarship.amount || 0,
        currency: scholarship.currency || 'USD',
        status: newApp.status,
        notes: newApp.notes,
        checklist: newApp.checklist,
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[student] error syncing new application to Supabase:', err);
    }
  }

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

  // Send application started email if user preference allows it (non-blocking)
  const studentProfile = db.getProfile(userId);
  const studentUser = db.findUserById(userId);
  const emailRecipient = studentUser?.email || req.user?.email;
  if (studentProfile?.notificationPreferences?.email !== false && emailRecipient) {
    emailService
      .sendApplicationStarted(
        emailRecipient,
        studentProfile?.firstName || 'Student',
        scholarship.title,
        scholarship.deadline,
        newApp.id,
        scholarship.providerName
      )
      .catch(() => {});
  }

  res.status(201).json({
    success: true,
    data: newApp,
  });
});

// PATCH & PUT /api/v1/student/applications/:id
async function handleUpdateApplication(req: Request, res: Response): Promise<void> {
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

  const updates = { ...req.body };
  const oldStatus = app.status;
  const statusChanged = updates.status && updates.status !== oldStatus;

  if (updates.status && updates.status === 'Applied' && !app.appliedAt) {
    updates.appliedAt = new Date().toISOString();
  }
  if (updates.status === 'Applied' && updates.submissionMethod === 'external') {
    updates.externalSubmissionConfirmed = true;
    if (!updates.statusSource) updates.statusSource = 'student_updated';
  }

  const updated = db.updateApplication(app.id, updates);

  // Send status change email if a meaningful status transition occurred (never on minor draft saves or checklist edits)
  if (statusChanged) {
    const studentProfile = db.getProfile(app.userId);
    const studentUser = db.findUserById(app.userId);
    const emailRecipient = studentUser?.email || (app.userId === userId ? req.user?.email : undefined);

    if (studentProfile?.notificationPreferences?.email !== false && emailRecipient) {
      emailService
        .sendApplicationStatusChange(
          emailRecipient,
          studentProfile?.firstName || 'Student',
          app.scholarshipTitle,
          oldStatus,
          updates.status,
          app.id,
          app.providerName
        )
        .catch(() => {});
    }
  }

  // Sync update to Supabase if configured
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const sbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status) sbUpdates.status = updates.status;
      if (updates.notes !== undefined) sbUpdates.notes = updates.notes;
      if (updates.checklist) sbUpdates.checklist = updates.checklist;
      if (updates.appliedAt) sbUpdates.applied_at = updates.appliedAt;
      await supabase.from('applications').update(sbUpdates).eq('id', app.id);
    } catch (err) {
      console.warn('[student] error syncing updated application to Supabase:', err);
    }
  }

  res.json({
    success: true,
    data: updated,
  });
}

router.patch('/applications/:id', handleUpdateApplication);
router.put('/applications/:id', handleUpdateApplication);

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
router.delete('/applications/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const appId = req.params.id;
  const app = db.findApplicationById(appId);

  if (!app) {
    // Check if it exists in Supabase
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await supabase.from('applications').select('*').eq('id', appId).maybeSingle();
        if (data) {
          if (data.user_id !== userId && req.user!.role !== 'admin') {
            res.status(403).json({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Access denied.' },
            });
            return;
          }
          await supabase.from('applications').delete().eq('id', appId);
          res.json({
            success: true,
            data: { message: 'Application deleted successfully.' },
          });
          return;
        }
      } catch (err) {
        console.warn('[student] error deleting application from Supabase:', err);
      }
    }

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

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('applications').delete().eq('id', app.id);
    } catch (err) {
      console.warn('[student] error deleting application from Supabase:', err);
    }
  }

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
router.post('/documents/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
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

  // Enforce Free plan limit of 3 stored documents
  const subStatus = await getUserSubscriptionStatus(userId, req.user?.email);
  const existingDocs = db.getDocumentsByUser(userId);
  if (subStatus !== 'premium' && existingDocs.length >= 3) {
    // If file was uploaded to disk by multer, clean it up
    if (file && file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch {}
    }
    res.status(403).json({
      success: false,
      error: {
        code: 'UPGRADE_REQUIRED',
        message: 'You have reached the Free plan limit of 3 stored documents. Upgrade to Scholavon Plus for unlimited document storage.',
        upgradeUrl: '/pricing',
        currentCount: existingDocs.length,
        limit: 3,
      },
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

// POST /api/v1/student/notifications/read-all
router.post('/notifications/read-all', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  db.markAllNotificationsRead(userId);
  res.json({
    success: true,
    data: { message: 'All notifications marked as read.' },
  });
});

// GET /api/v1/student/reminders
router.get('/reminders', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const reminders = db.getRemindersByUser(userId);
  res.json({
    success: true,
    data: reminders,
  });
});

// POST /api/v1/student/reminders/process
router.post('/reminders/process', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const currentDate = req.body.currentDate ? new Date(req.body.currentDate) : undefined;

  const result = await processDueRemindersForUser(userId, currentDate);

  res.json({
    success: true,
    data: {
      processedCount: result.processedCount,
      sentCount: result.sentCount,
      reminders: result.reminders,
    },
  });
});

// POST /api/v1/student/ai/chat — Authenticated AI scholarship assistant
router.post('/ai/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || 'usr-student-001';
    const { message, history, contextScholarshipId, userProfile, applications, documents } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Message string is required'
      });
      return;
    }

    // Enforce 5 free AI prompts per UTC calendar day for Free plan users
    const subStatus = await getUserSubscriptionStatus(userId, req.user?.email);
    const today = new Date().toISOString().slice(0, 10); // e.g. '2026-10-09'
    const DAILY_LIMIT = 5;
    let remainingPrompts = -1; // -1 means unlimited (Plus)

    if (subStatus !== 'premium') {
      const usedCount = db.getDailyAiPromptCount(userId, today);
      if (usedCount >= DAILY_LIMIT) {
        res.status(403).json({
          success: false,
          error: {
            code: 'UPGRADE_REQUIRED',
            message: `You have reached your Free plan limit of ${DAILY_LIMIT} AI prompts today. Your quota resets at midnight UTC. Upgrade to Scholavon Plus for unlimited AI assistance with Vona.`,
            upgradeUrl: '/pricing',
            promptsUsed: usedCount,
            promptsLimit: DAILY_LIMIT
          }
        });
        return;
      }
    }

    const aiResponse = await processAIChat(userId, {
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      contextScholarshipId: typeof contextScholarshipId === 'string' ? contextScholarshipId : undefined,
      userProfile,
      applications,
      documents
    });

    if (subStatus !== 'premium') {
      const nextCount = db.incrementDailyAiPromptCount(userId, today);
      remainingPrompts = Math.max(0, DAILY_LIMIT - nextCount);
    }

    res.json({
      success: true,
      data: {
        ...aiResponse,
        remainingPrompts: subStatus === 'premium' ? null : remainingPrompts,
        isPlus: subStatus === 'premium'
      }
    });
  } catch (err: any) {
    console.error('AI chat endpoint error:', err);
    res.status(500).json({
      success: false,
      error: 'Scholavon AI is temporarily unavailable. Please try again.'
    });
  }
});

export default router;

