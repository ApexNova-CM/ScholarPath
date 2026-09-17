import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/store';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  CreateScholarshipSchema,
  VerificationDecisionSchema,
  ScholarshipRecord,
  VerificationLogRecord,
} from '../types';

const router = Router();

// All admin routes require role === 'admin'
router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /api/v1/admin/metrics
router.get('/metrics', (req: Request, res: Response): void => {
  const scholarships = db.getScholarships();
  const providers = db.getProviders();
  const users = db.getAllStudentProfiles();
  const applications = db.getAllApplications();

  const now = new Date().getTime();
  const verifiedCount = scholarships.filter((s) => s.verificationStatus === 'verified').length;
  const pendingCount = scholarships.filter((s) => s.verificationStatus === 'pending_verification').length;
  const expiredCount = scholarships.filter((s) => new Date(s.deadline).getTime() < now).length;

  res.json({
    success: true,
    data: {
      totalScholarships: scholarships.length,
      verifiedCount,
      pendingCount,
      expiredCount,
      totalProviders: providers.length,
      totalStudents: users.length,
      totalApplications: applications.length,
    },
  });
});

// GET /api/v1/admin/verifications/queue
router.get('/verifications/queue', (req: Request, res: Response): void => {
  const queue = db.getScholarships().filter((s) => s.verificationStatus === 'pending_verification');
  const logs = db.getVerificationLogs();

  res.json({
    success: true,
    data: {
      pending: queue,
      history: logs,
    },
  });
});

// POST /api/v1/admin/verifications/:id/decision
router.post(
  '/verifications/:id/decision',
  validateBody(VerificationDecisionSchema),
  (req: Request, res: Response): void => {
    const scholarship = db.findScholarshipById(req.params.id);
    if (!scholarship) {
      res.status(404).json({
        success: false,
        error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
      });
      return;
    }

    const { decision, notes } = req.body;
    const previousStatus = scholarship.verificationStatus;
    const adminUser = req.user!;

    // Update scholarship status
    const updated = db.updateScholarship(scholarship.id, {
      verificationStatus: decision,
      status: decision === 'verified' ? 'verified' : decision === 'rejected' ? 'rejected' : 'pending_verification',
      verifiedBy: adminUser.id,
      verifiedAt: decision === 'verified' ? new Date().toISOString() : undefined,
      verificationNotes: notes,
    });

    // Record audit log
    const log: VerificationLogRecord = {
      id: `vlog-${crypto.randomUUID()}`,
      scholarshipId: scholarship.id,
      scholarshipTitle: scholarship.title,
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      previousStatus,
      newStatus: decision,
      notes: notes || '',
      timestamp: new Date().toISOString(),
    };
    db.createVerificationLog(log);

    res.json({
      success: true,
      data: {
        scholarship: updated,
        auditLog: log,
      },
    });
  }
);

// GET /api/v1/admin/scholarships
router.get('/scholarships', (req: Request, res: Response): void => {
  const scholarships = db.getScholarships();
  res.json({
    success: true,
    data: scholarships,
  });
});

// POST /api/v1/admin/scholarships
router.post(
  '/scholarships',
  validateBody(CreateScholarshipSchema),
  (req: Request, res: Response): void => {
    const adminUser = req.user!;
    const body = req.body;

    const newScholarship: ScholarshipRecord = {
      id: `sch-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title,
      providerId: body.providerId || 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      providerName: body.providerName,
      providerLogo: body.providerLogo || '',
      description: body.description,
      shortDescription: body.shortDescription || body.description.slice(0, 140),
      category: body.category,
      tags: body.tags || [],
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      currency: body.currency || 'USD',
      fundingType: body.fundingType || 'Full',
      amountPeriod: body.amountPeriod,
      amountDisplay: body.amountDisplay,
      eligibleCountries: body.eligibleCountries || ['All'],
      eligibleStates: body.eligibleStates,
      educationLevels: body.educationLevels || ['Undergraduate'],
      fieldsOfStudy: body.fieldsOfStudy || ['All'],
      minimumAge: body.minimumAge,
      maximumAge: body.maximumAge,
      minimumGPA: body.minimumGPA,
      gpaScale: body.gpaScale || 4.0,
      genderRequirement: body.genderRequirement || 'Any',
      financialNeedRequired: body.financialNeedRequired || false,
      otherRequirements: body.otherRequirements,
      requiredDocuments: body.requiredDocuments || [],
      applicationInstructions: body.applicationInstructions || '',
      applicationUrl: body.applicationUrl,
      openingDate: body.openingDate,
      deadline: body.deadline,
      expectedResultDate: body.expectedResultDate,
      status: 'pending_verification',
      verificationStatus: 'pending_verification',
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createScholarship(newScholarship);

    res.status(201).json({
      success: true,
      data: newScholarship,
    });
  }
);

// PUT /api/v1/admin/scholarships/:id
router.put('/scholarships/:id', (req: Request, res: Response): void => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  const updated = db.updateScholarship(existing.id, req.body);
  res.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/admin/scholarships/:id
router.delete('/scholarships/:id', (req: Request, res: Response): void => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  db.deleteScholarship(existing.id);
  res.json({
    success: true,
    data: { message: 'Scholarship permanently deleted successfully.' },
  });
});

// POST /api/v1/admin/scholarships/:id/archive
router.post('/scholarships/:id/archive', (req: Request, res: Response): void => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  const updated = db.updateScholarship(existing.id, { status: 'archived' });
  res.json({
    success: true,
    data: { message: 'Scholarship archived successfully.', scholarship: updated },
  });
});

// GET /api/v1/admin/providers
router.get('/providers', (req: Request, res: Response): void => {
  const providers = db.getProviders();
  res.json({
    success: true,
    data: providers,
  });
});

// POST /api/v1/admin/providers
router.post('/providers', (req: Request, res: Response): void => {
  const { name, website, contactEmail, description, country, type } = req.body;
  if (!name || !website || !contactEmail) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Name, website, and contactEmail are required.' },
    });
    return;
  }

  const newProvider = db.createProvider({
    id: `prov-${crypto.randomUUID()}`,
    name,
    website,
    contactEmail,
    description: description || '',
    country: country || 'International',
    type: type || 'Foundation',
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    data: newProvider,
  });
});

// GET /api/v1/admin/users
router.get('/users', (req: Request, res: Response): void => {
  const profiles = db.getAllStudentProfiles();
  res.json({
    success: true,
    data: profiles,
  });
});

// GET /api/v1/admin/staff
router.get('/staff', (req: Request, res: Response): void => {
  const staff = db.getAdminUsers();
  res.json({
    success: true,
    data: staff,
  });
});

// POST /api/v1/admin/staff
router.post('/staff', (req: Request, res: Response): void => {
  const { firstName, lastName, email, role, department } = req.body;
  if (!firstName || !lastName || !email) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'First name, last name, and email are required.' },
    });
    return;
  }

  const newStaff = db.createAdminUser({
    id: `usr-admin-${crypto.randomUUID().slice(0, 8)}`,
    firstName,
    lastName,
    email: email.toLowerCase().trim(),
    role: role || 'Admin',
    status: 'Active',
    assignedDepartment: department || 'Operations',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    data: newStaff,
  });
});

// DELETE /api/v1/admin/staff/:id
router.delete('/staff/:id', (req: Request, res: Response): void => {
  const ok = db.deleteAdminUser(req.params.id);
  if (!ok) {
    res.status(404).json({
      success: false,
      error: { code: 'STAFF_NOT_FOUND', message: 'Admin staff member not found.' },
    });
    return;
  }
  res.json({
    success: true,
    data: { message: 'Staff member removed successfully.' },
  });
});

export default router;
