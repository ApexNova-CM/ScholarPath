import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';

let studentToken = '';
let studentId = '';
let adminToken = '';
let pendingScholarshipId = '';

beforeAll(async () => {
  await db.init();
});

describe('Phase 4: Authentication System', () => {
  const testEmail = `test_${Date.now()}@example.com`;

  it('POST /api/v1/auth/register — should register a new student account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'securePassword123',
        firstName: 'Taylor',
        lastName: 'Swift',
        country: 'United States',
        educationLevel: 'Undergraduate',
        institution: 'Stanford University',
        fieldOfStudy: 'Computer Science',
        gpa: 3.9,
        gpaScale: 4.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.role).toBe('student');

    studentToken = res.body.data.token;
    studentId = res.body.data.user.id;
  });

  it('POST /api/v1/auth/register — should reject duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'anotherPassword',
        firstName: 'Duplicate',
        lastName: 'User',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('POST /api/v1/auth/login — should fail with wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'incorrectPassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login — should log in successfully as student', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'securePassword123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('POST /api/v1/auth/login — should log in successfully as default Super Admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@scholavon.org',
        password: 'admin123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('admin');
    adminToken = res.body.data.token;
  });

  it('POST /api/v1/auth/login — should log in successfully as secondary admin Chris Ekpe', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'chrisekpe18@gmail.com',
        password: 'admin123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.email).toBe('chrisekpe18@gmail.com');
  });

  it('GET /api/v1/auth/me — should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(studentId);
  });
});

describe('Phase 5: Public & Student API Endpoints', () => {
  it('GET /api/v1/categories — should return categories list with scholarship counts', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/scholarships — should return paginated verified scholarships', async () => {
    const res = await request(app).get('/api/v1/scholarships');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/student/dashboard — should return student pipeline and upcoming deadlines', async () => {
    const res = await request(app)
      .get('/api/v1/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appCounts).toBeDefined();
    expect(res.body.data.upcomingScholarships).toBeDefined();
  });

  it('POST /api/v1/student/saved/:id — should toggle scholarship bookmark', async () => {
    const res = await request(app)
      .post('/api/v1/student/saved/sch-001')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.ids).toContain('sch-001');
  });

  it('POST /api/v1/student/applications — should start tracking scholarship application with checklist', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        scholarshipId: 'sch-001',
        notes: 'Priority 1 application',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scholarshipId).toBe('sch-001');
    expect(res.body.data.checklist.length).toBeGreaterThan(0);
  });
});

describe('Phase 7 & 8: Authorization (RBAC) & Zod Validation', () => {
  it('RBAC Guard: Student should be blocked from GET /api/v1/admin/metrics with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Admin Access: Admin should successfully view /api/v1/admin/metrics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalScholarships).toBeDefined();
    expect(res.body.data.verifiedCount).toBeDefined();
  });

  it('Zod Validation: Should reject scholarship creation missing required fields with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/admin/scholarships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'X', // too short (< 3)
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });
});

describe('Phase 7 & 10: Verification Queue & Audit Trail', () => {
  it('Admin can view verification queue', async () => {
    const res = await request(app)
      .get('/api/v1/admin/verifications/queue')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.pending)).toBe(true);
    if (res.body.data.pending.length > 0) {
      pendingScholarshipId = res.body.data.pending[0].id;
    }
  });

  it('Admin can verify scholarship and generate audit log', async () => {
    const targetId = pendingScholarshipId || 'sch-006';
    const res = await request(app)
      .post(`/api/v1/admin/verifications/${targetId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'verified',
        notes: 'Verified against official foundation website.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scholarship.verificationStatus).toBe('verified');
    expect(res.body.data.auditLog).toBeDefined();
    expect(res.body.data.auditLog.newStatus).toBe('verified');
  });
});

describe('Free Plan Application Limit & Slot Management', () => {
  let freeToken = '';
  let freeId = '';
  let plusToken = '';
  let plusId = '';
  let app1Id = '';
  let app2Id = '';
  let app3Id = '';

  beforeAll(async () => {
    // Register free student
    const freeEmail = `free_limit_${Date.now()}@example.com`;
    const regFree = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: freeEmail,
        password: 'password123',
        firstName: 'Free',
        lastName: 'Student',
        country: 'Nigeria',
        educationLevel: 'Undergraduate',
        institution: 'UNILAG',
        fieldOfStudy: 'Engineering',
        gpa: 3.8,
        gpaScale: 4.0,
      });
    freeToken = regFree.body.data.token;
    freeId = regFree.body.data.user.id;

    // Register plus student
    const plusEmail = `plus_limit_${Date.now()}@example.com`;
    const regPlus = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: plusEmail,
        password: 'password123',
        firstName: 'Plus',
        lastName: 'Student',
        country: 'Ghana',
        educationLevel: 'Undergraduate',
        institution: 'Legon',
        fieldOfStudy: 'Computer Science',
        gpa: 4.0,
        gpaScale: 4.0,
      });
    plusToken = regPlus.body.data.token;
    plusId = regPlus.body.data.user.id;

    const plusUser = db.findUserById(plusId);
    if (plusUser) {
      db.updateUser(plusId, { ...plusUser, subscriptionStatus: 'premium' } as any);
    }
  });

  it('Free student can track 1st application', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-001', notes: 'First app' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    app1Id = res.body.data.id;
  });

  it('Re-applying to already tracked scholarship does not consume another slot', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-001', notes: 'First app updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(app1Id);
  });

  it('Free student can track 2nd application', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-002', notes: 'Second app' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    app2Id = res.body.data.id;
  });

  it('Free student can track 3rd application (3/3 used)', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-003', notes: 'Third app' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    app3Id = res.body.data.id;
  });

  it('4th application attempt must be rejected with 403 UPGRADE_REQUIRED', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-004', notes: 'Fourth app' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UPGRADE_REQUIRED');
    expect(res.body.error.upgradeUrl).toBe('/pricing');
  });

  it('Deleting an application frees the slot', async () => {
    const delRes = await request(app)
      .delete(`/api/v1/student/applications/${app3Id}`)
      .set('Authorization', `Bearer ${freeToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Now tracking 2 applications, so 3rd one can be created
    const newRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${freeToken}`)
      .send({ scholarshipId: 'sch-004', notes: 'New third app after deleting old one' });

    expect(newRes.status).toBe(201);
    expect(newRes.body.success).toBe(true);
  });

  it('Plus/Premium student can track unlimited applications (4+)', async () => {
    const res1 = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: 'sch-001' });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: 'sch-002' });
    expect(res2.status).toBe(201);

    const res3 = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: 'sch-003' });
    expect(res3.status).toBe(201);

    const res4 = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: 'sch-004' });
    expect(res4.status).toBe(201);

    const res5 = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: 'sch-006' });
    expect(res5.status).toBe(201);
    expect(res5.body.success).toBe(true);
  });

  it('Rejects new application for closed/expired scholarship with 400 SCHOLARSHIP_CLOSED', async () => {
    // Seed closed scholarship
    const closedId = `closed-test-${Date.now()}`;
    await db.createScholarship({
      id: closedId,
      title: 'Closed Test Scholarship',
      providerId: 'p-1',
      providerName: 'Closed Org',
      description: 'Closed',
      shortDescription: 'Closed',
      category: 'General',
      tags: [],
      amount: 1000,
      currency: 'USD',
      fundingType: 'Partial',
      eligibleCountries: ['All'],
      educationLevels: ['Undergraduate'],
      fieldsOfStudy: ['All'],
      gpaScale: 4.0,
      requiredDocuments: [],
      applicationInstructions: '',
      applicationUrl: 'https://example.com',
      deadline: '2020-01-01T00:00:00Z',
      status: 'closed',
      manuallyClosed: true,
      verificationStatus: 'verified',
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${plusToken}`)
      .send({ scholarshipId: closedId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SCHOLARSHIP_CLOSED');
    expect(res.body.error.message).toContain('closed');
  });
});

describe('Feature #9: Upgraded Admin Add Scholarship & Expanded Audit Model', () => {
  let createdExtendedScholarshipId = '';

  it('Admin can create a rich, 9-section scholarship opportunity with structured requirements and steps', async () => {
    const payload = {
      title: 'Mastercard Foundation Scholars Program at University of Edinburgh',
      providerName: 'Mastercard Foundation',
      category: 'STEM & Tech',
      scholarshipType: 'Full Postgraduate Scholarship',
      shortDescription: 'Comprehensive funding for African graduate students in STEM.',
      description: 'The Mastercard Foundation Scholars Program provides transformative education opportunities to young leaders from Africa.',
      tags: ['STEM', 'Full-Ride', 'Africa', 'Masters'],

      // Award Details
      amount: 45000,
      currency: 'GBP',
      awardCurrency: 'GBP',
      fundingType: 'Full',
      awardType: 'Full scholarship',
      awardFrequency: 'Annual',
      awardValueText: 'Full tuition plus £1,350 monthly living stipend',
      awardDescription: 'Covers full tuition fees, travel, accommodation, and living expenses.',
      amountPeriod: 'Annual',
      amountDisplay: '£45,000 annually',
      whatTheAwardCovers: ['Full Tuition Fee', 'Living Allowance / Stipend', 'Accommodation / Housing', 'Round-trip Airfare / Travel'],
      numberOfRecipients: '30 scholars',

      // Eligibility
      eligibleCountries: ['Nigeria', 'Ghana', 'Kenya', 'Rwanda', 'Uganda'],
      eligibleNationalities: ['African Citizens'],
      countryOfStudy: ['United Kingdom'],
      educationLevels: ['Postgraduate (Masters)'],
      institutionTypes: ['Public University'],
      fieldsOfStudy: ['Computer Science', 'Data Science', 'Engineering', 'Global Health'],
      eligibleCourses: ['MSc Artificial Intelligence', 'MSc Data Science', 'MSc Sustainable Energy'],
      minimumGPA: 3.5,
      gpaScale: 4.0,
      academicStanding: 'First Class or Second Class Upper',
      genderRequirement: 'Any',
      minimumAge: 20,
      maximumAge: 35,
      financialNeedRequired: true,
      leadershipRequired: true,
      communityServiceRequired: true,
      disabilityApplicable: true,
      otherEligibilityConditions: ['Must qualify for admission to the University of Edinburgh', 'Commitment to return to home country upon completion'],

      // Requirements
      structuredRequirements: [
        {
          id: 'req-1',
          name: 'Official Academic Transcript',
          description: 'Certified transcript with official university seal',
          required: true,
          isDocument: true,
          acceptedFileTypes: ['PDF'],
          order: 1
        },
        {
          id: 'req-2',
          name: 'Personal Statement of Purpose',
          description: 'Max 1,000 words demonstrating leadership and commitment to Africa',
          required: true,
          isDocument: true,
          acceptedFileTypes: ['PDF', 'DOCX'],
          order: 2
        },
        {
          id: 'req-3',
          name: 'Two Academic References',
          description: 'Letters from former academic supervisors',
          required: true,
          isDocument: true,
          acceptedFileTypes: ['PDF'],
          order: 3
        }
      ],

      // Application Details
      applicationMethod: 'External Website',
      applicationUrl: 'https://www.ed.ac.uk/student-funding/postgraduate/international/mastercard-foundation/apply',
      officialWebsiteUrl: 'https://mastercardfdn.org/scholars',
      applicationFee: 'Free',
      accountRequired: true,
      applicationInstructions: 'Submit application via the University of Edinburgh scholarship portal.',
      applicationSteps: [
        { id: 'step-1', stepNumber: 1, title: 'Apply for admission to eligible MSc program', description: 'Obtain an offer of admission before applying for scholarship.' },
        { id: 'step-2', stepNumber: 2, title: 'Access scholarship portal', description: 'Log in using MyEd portal credentials.' },
        { id: 'step-3', stepNumber: 3, title: 'Complete scholarship questionnaire', description: 'Provide responses on financial need and leadership.' },
        { id: 'step-4', stepNumber: 4, title: 'Upload supporting documents and submit', description: 'Submit before the January 27 deadline.' }
      ],

      // Important Dates
      openingDate: '2026-10-01',
      deadline: '2027-01-27',
      deadlineTime: '17:00',
      expectedResultDate: '2027-04-30',
      awardDate: '2027-09-01',
      timezone: 'GMT',

      // Selection Process
      selectionProcess: 'Academic Review → Shortlisting → Online Interview → Final Award',
      selectionCriteria: 'Academic achievement, financial need, and demonstrated leadership commitment.',
      testRequired: false,
      interviewRequired: true,
      essayRequired: true,
      shortlistingProcess: 'Shortlisted candidates contacted for interviews in March 2027.',
      selectionSteps: [
        { id: 'sel-1', stageNumber: 1, name: 'Eligibility Verification', description: 'Assessment of degree classification and nationality.' },
        { id: 'sel-2', stageNumber: 2, name: 'Panel Interview', description: '30-minute interview with Edinburgh selection panel.' },
        { id: 'sel-3', stageNumber: 3, name: 'Final Award Letter', description: 'Offer packages sent to successful scholars.' }
      ],

      // Verification & Publishing
      status: 'verified',
      verificationStatus: 'verified',
      officialSourceUrl: 'https://www.ed.ac.uk/student-funding/postgraduate/international/mastercard-foundation',
      sourceType: 'Official Website',
      verifiedBy: 'Senior Audit Officer',
      verifiedAt: '2026-10-08T12:00:00.000Z',
      verificationNotes: 'Verified directly against the official University of Edinburgh portal announcement.',
      isFeatured: true,
      autoCloseOnDeadline: true
    };

    const res = await request(app)
      .post('/api/v1/admin/scholarships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe(payload.title);
    expect(res.body.data.whatTheAwardCovers.length).toBe(4);
    expect(res.body.data.structuredRequirements.length).toBe(3);
    expect(res.body.data.applicationSteps.length).toBe(4);
    expect(res.body.data.selectionSteps.length).toBe(3);
    expect(res.body.data.requiredDocuments.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.verificationStatus).toBe('verified');

    createdExtendedScholarshipId = res.body.data.id;
  });

  it('Student discovery GET /api/v1/scholarships retrieves the newly created extended scholarship', async () => {
    const res = await request(app).get('/api/v1/scholarships');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const found = res.body.data.items.find((s: any) => s.id === createdExtendedScholarshipId);
    expect(found).toBeDefined();
    expect(found.title).toContain('University of Edinburgh');
    expect(found.whatTheAwardCovers).toContain('Full Tuition Fee');
    expect(found.structuredRequirements.length).toBe(3);
    expect(found.applicationSteps.length).toBe(4);
    expect(found.selectionSteps.length).toBe(3);
    expect(found.verificationStatus).toBe('verified');
  });

  it('Admin can edit the extended scholarship fields via PUT /api/v1/admin/scholarships/:id', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/scholarships/${createdExtendedScholarshipId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numberOfRecipients: '35 scholars',
        awardValueText: 'Updated full tuition plus £1,400 monthly stipend',
        verificationNotes: 'Re-verified on October 8, 2026 by lead administrator.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.numberOfRecipients).toBe('35 scholars');
    expect(res.body.data.awardValueText).toContain('£1,400');
    expect(res.body.data.lastUpdatedAt).toBeDefined();
  });
});

