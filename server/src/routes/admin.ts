import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/store';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { config } from '../config';
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
  async (req: Request, res: Response): Promise<void> => {
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

    if (config.supabaseUrl && config.supabaseServiceRoleKey && updated) {
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await supabase.from('scholarships').update({
          verification_status: updated.verificationStatus,
          status: updated.status,
          verified_by: updated.verifiedBy,
          verified_at: updated.verifiedAt,
          verification_notes: updated.verificationNotes,
          updated_at: new Date().toISOString(),
        }).eq('id', scholarship.id);
      } catch (err) {
        console.warn('[admin] error syncing verification decision to Supabase:', err);
      }
    }

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
  async (req: Request, res: Response): Promise<void> => {
    const adminUser = req.user!;
    const body = req.body;

    const verificationStatus = body.verificationStatus || 'verified';
    const status = body.status || (verificationStatus === 'pending_verification' ? 'pending_verification' : 'verified');
    const isVerified = verificationStatus === 'verified';

    // Required Documents derivation compatibility:
    // 1. If legacy requiredDocuments has items, preserve it.
    // 2. If legacy requiredDocuments is empty and structuredRequirements has document items, derive from structuredRequirements.
    let requiredDocs = Array.isArray(body.requiredDocuments) ? body.requiredDocuments : [];
    if (requiredDocs.length === 0 && Array.isArray(body.structuredRequirements)) {
      requiredDocs = body.structuredRequirements
        .filter((r: any) => r.isDocument && r.name)
        .map((r: any) => r.name.trim());
    }

    const newScholarship: ScholarshipRecord = {
      id: body.id || `sch-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title,
      providerId: body.providerId || 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      providerName: body.providerName,
      providerLogo: body.providerLogo || '',
      description: body.description,
      shortDescription: body.shortDescription || body.description.slice(0, 140),
      category: body.category,
      scholarshipType: body.scholarshipType,
      tags: body.tags || [],

      // Award Details
      amount: body.amount !== undefined && body.amount !== null && !isNaN(Number(body.amount)) ? Number(body.amount) : undefined,
      currency: body.currency || 'USD',
      awardCurrency: body.awardCurrency || body.currency || 'USD',
      fundingType: body.fundingType || 'Full',
      awardType: body.awardType,
      awardFrequency: body.awardFrequency,
      awardValueText: body.awardValueText,
      awardDescription: body.awardDescription,
      amountPeriod: body.amountPeriod,
      amountDisplay: body.amountDisplay,
      whatTheAwardCovers: body.whatTheAwardCovers,
      numberOfRecipients: body.numberOfRecipients,

      // Eligibility
      eligibleCountries: body.eligibleCountries || ['All'],
      eligibleStates: body.eligibleStates,
      eligibleNationalities: body.eligibleNationalities,
      countryOfStudy: body.countryOfStudy,
      educationLevels: body.educationLevels || ['Undergraduate'],
      institutionTypes: body.institutionTypes,
      studyYears: body.studyYears,
      fieldsOfStudy: body.fieldsOfStudy || ['All'],
      eligibleCourses: body.eligibleCourses,
      minimumAge: body.minimumAge,
      maximumAge: body.maximumAge,
      minimumGPA: body.minimumGPA,
      gpaScale: body.gpaScale || 4.0,
      academicStanding: body.academicStanding,
      genderRequirement: body.genderRequirement || 'Any',
      financialNeedRequired: body.financialNeedRequired || false,
      leadershipRequired: body.leadershipRequired,
      communityServiceRequired: body.communityServiceRequired,
      disabilityApplicable: body.disabilityApplicable,
      membershipRequirement: body.membershipRequirement,
      otherEligibilityConditions: body.otherEligibilityConditions,
      otherRequirements: body.otherRequirements,
      otherRequirementsNotes: body.otherRequirementsNotes,

      // Requirements
      requiredDocuments: requiredDocs,
      structuredRequirements: body.structuredRequirements,

      // Application Details
      applicationMethod: body.applicationMethod,
      applicationInstructions: body.applicationInstructions || '',
      applicationUrl: body.applicationUrl,
      officialWebsiteUrl: body.officialWebsiteUrl,
      applicationFee: body.applicationFee,
      applicationFeeCurrency: body.applicationFeeCurrency,
      accountRequired: body.accountRequired,
      applicationSteps: body.applicationSteps,

      // Important Dates
      openingDate: body.openingDate,
      deadline: body.deadline,
      deadlineTime: body.deadlineTime,
      expectedResultDate: body.expectedResultDate,
      awardDate: body.awardDate,
      timezone: body.timezone,

      // Selection Process
      selectionProcess: body.selectionProcess,
      selectionCriteria: body.selectionCriteria,
      testRequired: body.testRequired,
      interviewRequired: body.interviewRequired,
      essayRequired: body.essayRequired,
      shortlistingProcess: body.shortlistingProcess,
      selectionSteps: body.selectionSteps,
      otherSelectionInfo: body.otherSelectionInfo,

      // Verification & Publishing
      status,
      verificationStatus,
      officialSourceUrl: body.officialSourceUrl,
      sourceType: body.sourceType,
      verifiedBy: isVerified ? (body.verifiedBy || adminUser.email || adminUser.id) : undefined,
      verifiedAt: isVerified ? (body.verifiedAt || new Date().toISOString()) : undefined,
      verificationNotes: body.verificationNotes,
      lastUpdatedAt: new Date().toISOString(),
      isFeatured: body.isFeatured || false,
      autoCloseOnDeadline: body.autoCloseOnDeadline !== undefined ? body.autoCloseOnDeadline : true,
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createScholarship(newScholarship);

    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      try {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await supabase.from('scholarships').upsert({
          id: newScholarship.id,
          title: newScholarship.title,
          provider_id: newScholarship.providerId,
          provider_name: newScholarship.providerName,
          provider_logo: newScholarship.providerLogo,
          description: newScholarship.description,
          short_description: newScholarship.shortDescription,
          category: newScholarship.category,
          scholarship_type: newScholarship.scholarshipType,
          tags: newScholarship.tags,
          amount: newScholarship.amount,
          currency: newScholarship.currency,
          funding_type: newScholarship.fundingType,
          amount_period: newScholarship.amountPeriod,
          amount_display: newScholarship.amountDisplay,
          eligible_countries: newScholarship.eligibleCountries,
          eligible_states: newScholarship.eligibleStates,
          education_levels: newScholarship.educationLevels,
          fields_of_study: newScholarship.fieldsOfStudy,
          minimum_age: newScholarship.minimumAge,
          maximum_age: newScholarship.maximumAge,
          minimum_gpa: newScholarship.minimumGPA,
          gpa_scale: newScholarship.gpaScale,
          gender_requirement: newScholarship.genderRequirement,
          financial_need_required: newScholarship.financialNeedRequired,
          other_requirements: newScholarship.otherRequirements,
          required_documents: newScholarship.requiredDocuments,
          application_instructions: newScholarship.applicationInstructions,
          application_url: newScholarship.applicationUrl,
          opening_date: newScholarship.openingDate,
          deadline: newScholarship.deadline,
          expected_result_date: newScholarship.expectedResultDate,
          status: newScholarship.status,
          verification_status: newScholarship.verificationStatus,
          verified_by: newScholarship.verifiedBy,
          verified_at: newScholarship.verifiedAt,
          verification_notes: newScholarship.verificationNotes,
          view_count: newScholarship.viewCount,
          save_count: newScholarship.saveCount,
        }, { onConflict: 'id' });
      } catch (err) {
        console.warn('[admin] error syncing new scholarship to Supabase:', err);
      }
    }

    res.status(201).json({
      success: true,
      data: newScholarship,
    });
  }
);

// PUT /api/v1/admin/scholarships/:id
router.put('/scholarships/:id', async (req: Request, res: Response): Promise<void> => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  const updates = { ...req.body, updatedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() };
  if ((!updates.requiredDocuments || updates.requiredDocuments.length === 0) && Array.isArray(updates.structuredRequirements)) {
    updates.requiredDocuments = updates.structuredRequirements
      .filter((r: any) => r.isDocument && r.name)
      .map((r: any) => r.name.trim());
  }

  const updated = db.updateScholarship(existing.id, updates);

  if (config.supabaseUrl && config.supabaseServiceRoleKey && updated) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('scholarships').upsert({
        id: updated.id,
        title: updated.title,
        provider_id: updated.providerId,
        provider_name: updated.providerName,
        provider_logo: updated.providerLogo,
        description: updated.description,
        short_description: updated.shortDescription,
        category: updated.category,
        scholarship_type: updated.scholarshipType,
        tags: updated.tags,
        amount: updated.amount,
        currency: updated.currency,
        funding_type: updated.fundingType,
        amount_period: updated.amountPeriod,
        amount_display: updated.amountDisplay,
        eligible_countries: updated.eligibleCountries,
        eligible_states: updated.eligibleStates,
        education_levels: updated.educationLevels,
        fields_of_study: updated.fieldsOfStudy,
        minimum_age: updated.minimumAge,
        maximum_age: updated.maximumAge,
        minimum_gpa: updated.minimumGPA,
        gpa_scale: updated.gpaScale,
        gender_requirement: updated.genderRequirement,
        financial_need_required: updated.financialNeedRequired,
        other_requirements: updated.otherRequirements,
        required_documents: updated.requiredDocuments,
        application_instructions: updated.applicationInstructions,
        application_url: updated.applicationUrl,
        opening_date: updated.openingDate,
        deadline: updated.deadline,
        expected_result_date: updated.expectedResultDate,
        status: updated.status,
        verification_status: updated.verificationStatus,
        verified_by: updated.verifiedBy,
        verified_at: updated.verifiedAt,
        verification_notes: updated.verificationNotes,
        view_count: updated.viewCount,
        save_count: updated.saveCount,
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[admin] error syncing updated scholarship to Supabase:', err);
    }
  }

  res.json({
    success: true,
    data: updated,
  });
});

// DELETE /api/v1/admin/scholarships/:id
router.delete('/scholarships/:id', async (req: Request, res: Response): Promise<void> => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  db.deleteScholarship(existing.id);

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('scholarships').delete().eq('id', existing.id);
    } catch (err) {
      console.warn('[admin] error deleting scholarship from Supabase:', err);
    }
  }

  res.json({
    success: true,
    data: { message: 'Scholarship permanently deleted successfully.' },
  });
});

// POST /api/v1/admin/scholarships/:id/archive
router.post('/scholarships/:id/archive', async (req: Request, res: Response): Promise<void> => {
  const existing = db.findScholarshipById(req.params.id);
  if (!existing) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  const updated = db.updateScholarship(existing.id, { status: 'archived' });

  if (config.supabaseUrl && config.supabaseServiceRoleKey && updated) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('scholarships').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', existing.id);
    } catch (err) {
      console.warn('[admin] error archiving scholarship in Supabase:', err);
    }
  }

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

// PUT /api/v1/admin/users/:id/role
router.put('/users/:id/role', (req: Request, res: Response): void => {
  const { role, department } = req.body;
  if (!role || !['admin', 'student'].includes(role)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROLE', message: 'Role must be either admin or student.' },
    });
    return;
  }

  const user = db.findUserById(req.params.id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  // Check last remaining admin if demoting
  if (role === 'student' && user.role === 'admin') {
    const allAdmins = db.getAdminUsers();
    if (allAdmins.length <= 1) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_REMOVE_LAST_ADMIN', message: 'Cannot revoke privileges: at least one administrator must remain active.' },
      });
      return;
    }
  }

  db.updateUser(user.id, { role });

  if (role === 'admin') {
    const profile = db.getProfile(user.id);
    db.createAdminUser({
      id: user.id,
      firstName: profile?.firstName || 'Admin',
      lastName: profile?.lastName || 'User',
      email: user.email,
      role: 'Admin',
      status: 'Active',
      assignedDepartment: department?.trim() || profile?.fieldOfStudy || 'Operations',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
  } else {
    db.deleteAdminUser(user.id);
  }

  res.json({
    success: true,
    data: { message: `User role successfully updated to ${role}.` },
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
router.post('/staff', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, role, department, password } = req.body;
    if (!firstName || !lastName || !email) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'First name, last name, and email are required.' },
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = db.findUserByEmail(cleanEmail);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'ADMIN_ALREADY_EXISTS', message: 'An administrator or user with this email already exists.' },
      });
      return;
    }

    const newStaffId = `usr-admin-${crypto.randomUUID().slice(0, 8)}`;
    const plainPassword = password && password.trim().length >= 6 ? password.trim() : 'admin123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Register user auth record so new admin can log in immediately
    db.createUser({
      id: newStaffId,
      email: cleanEmail,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const newStaff = db.createAdminUser({
      id: newStaffId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      role: role || 'Admin',
      status: 'Active',
      assignedDepartment: department?.trim() || 'Operations',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: newStaff,
    });
  } catch (err) {
    next(err);
  }
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

// GET /api/v1/admin/subscriptions
// Returns Paystack subscription metrics from Supabase for the admin dashboard.
router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      // Gracefully degrade when Supabase service role is not configured
      res.json({
        success: true,
        data: {
          totalPlusUsers: 0,
          byPlan: { premium_monthly: 0, premium_annual: 0 },
          byStatus: { active: 0, cancelled: 0, past_due: 0, inactive: 0 },
          totalRevenueKobo: 0,
          totalRevenuNaira: '0.00',
          note: 'Supabase service role not configured. Set SUPABASE_SERVICE_ROLE_KEY on Railway.',
        },
      });
      return;
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Subscription counts by plan and status
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('plan_id, status');

    if (subErr) throw new Error(subErr.message);

    const subsData = subs || [];
    const totalPlusUsers = subsData.filter((s: any) => s.status === 'active').length;
    const byPlan = {
      premium_monthly: subsData.filter((s: any) => s.plan_id === 'premium_monthly' && s.status === 'active').length,
      premium_annual: subsData.filter((s: any) => s.plan_id === 'premium_annual' && s.status === 'active').length,
    };
    const byStatus = {
      active: subsData.filter((s: any) => s.status === 'active').length,
      cancelled: subsData.filter((s: any) => s.status === 'cancelled').length,
      past_due: subsData.filter((s: any) => s.status === 'past_due').length,
      inactive: subsData.filter((s: any) => s.status === 'inactive').length,
    };

    // Total revenue from verified payment_events
    const { data: events, error: evtErr } = await supabase
      .from('payment_events')
      .select('amount_kobo')
      .in('event_type', ['charge.success', 'charge.success.verify', 'invoice.payment_success'])
      .not('amount_kobo', 'is', null);

    if (evtErr) throw new Error(evtErr.message);

    const totalRevenueKobo = (events || []).reduce(
      (sum: number, e: any) => sum + (e.amount_kobo || 0),
      0
    );

    res.json({
      success: true,
      data: {
        totalPlusUsers,
        byPlan,
        byStatus,
        totalRevenueKobo,
        totalRevenuNaira: (totalRevenueKobo / 100).toFixed(2),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
