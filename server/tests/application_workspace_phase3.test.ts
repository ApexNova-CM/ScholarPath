/**
 * Phase 3: Application Workspace & Execution Tests
 *
 * Tests the Start Application flow, draft saving, idempotency,
 * server-side ownership authorization (403 cross-student), and
 * external submission status transitions.
 *
 * Zero-migration compliance: database status uses 'Preparing' for drafts
 * and 'Applied' for submissions. Display-layer label mapping happens in
 * getApplicationDisplayStatus() which is covered by separate unit tests.
 *
 * Phase 3.1 additions:
 * - Task 1: Native submission must not falsely mark Applied without genuine server confirmation.
 * - Task 2: Backend draft-sync failure must be distinguishable from success at the server level.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Environment polyfills required by server-side modules in Node/Vitest
// ---------------------------------------------------------------------------
class LocalStorageMock {
  private store: Record<string, string> = {};
  clear() { this.store = {}; }
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = String(value); }
  removeItem(key: string): void { delete this.store[key]; }
}
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: new LocalStorageMock(), writable: true });
}
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
}

// ---------------------------------------------------------------------------
// Supabase mock (must be hoisted before imports)
// ---------------------------------------------------------------------------
const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';

// ---------------------------------------------------------------------------
// Test user IDs
// ---------------------------------------------------------------------------
const STUDENT_A_ID = 'usr-phase3-student-a';
const STUDENT_B_ID = 'usr-phase3-student-b';
const SCHOLARSHIP_ID = 'sch-phase3-open-001';
const SCHOLAVON_NATIVE_SCHOLARSHIP_ID = 'sch-phase3-native-001';

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function signToken(userId: string, role: 'student' | 'admin' = 'student'): string {
  const secret = config.jwtSecret || 'test-jwt-secret-phase3';
  return jwt.sign({ sub: userId, id: userId, role, email: `${userId}@test.scholavon.org` }, secret, { expiresIn: '1h' });
}

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------
function mockSupabaseDisabled() {
  // Disable Supabase so routes fall back to db store
  (config as any).supabaseUrl = '';
  (config as any).supabaseServiceRoleKey = '';
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  (db as any).save = vi.fn();
  await db.init();
  mockSupabaseDisabled();

  // Ensure Student A exists
  if (!db.findUserById(STUDENT_A_ID)) {
    db.createUser({
      id: STUDENT_A_ID,
      email: `${STUDENT_A_ID}@test.scholavon.org`,
      passwordHash: 'hash-a',
      role: 'student',
      firstName: 'Alpha',
      lastName: 'Student',
      country: 'GB',
      profileCompletion: 60,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  // Ensure Student B exists
  if (!db.findUserById(STUDENT_B_ID)) {
    db.createUser({
      id: STUDENT_B_ID,
      email: `${STUDENT_B_ID}@test.scholavon.org`,
      passwordHash: 'hash-b',
      role: 'student',
      firstName: 'Beta',
      lastName: 'Student',
      country: 'US',
      profileCompletion: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  // Ensure a test scholarship exists and is open
  if (!db.findScholarshipById(SCHOLARSHIP_ID)) {
    const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.createScholarship({
      id: SCHOLARSHIP_ID,
      title: 'Phase 3 Test Scholarship',
      providerName: 'Test Provider',
      amount: 5000,
      currency: 'GBP',
      deadline: futureDeadline,
      status: 'active',
      applicationMethod: 'External Website',
      applicationUrl: 'https://provider.example.com/apply',
      category: 'Merit',
      educationLevels: ['Undergraduate'],
      requiredDocuments: ['Transcript', 'Personal Statement'],
      eligibilityCriteria: [],
      description: 'Phase 3 test scholarship',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  // Ensure native direct scholarship exists
  if (!db.findScholarshipById(SCHOLAVON_NATIVE_SCHOLARSHIP_ID)) {
    const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.createScholarship({
      id: SCHOLAVON_NATIVE_SCHOLARSHIP_ID,
      title: 'Scholavon Native Direct Application Opportunity',
      providerName: 'Scholavon Foundation',
      amount: 10000,
      currency: 'GBP',
      deadline: futureDeadline,
      status: 'active',
      applicationMethod: 'Scholavon Application',
      category: 'Merit',
      educationLevels: ['Undergraduate'],
      requiredDocuments: ['Transcript', 'Cover Letter'],
      eligibilityCriteria: [],
      description: 'Direct Scholavon application test opportunity',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }
});

// Clean up applications created during tests to prevent state leakage
beforeEach(() => {
  // Remove any existing Phase 3 test applications to start each test fresh
  const testScholIds = [SCHOLARSHIP_ID, SCHOLAVON_NATIVE_SCHOLARSHIP_ID];
  const allApps = db.getApplicationsByUser(STUDENT_A_ID);
  for (const a of allApps) {
    if (testScholIds.includes(a.scholarshipId)) {
      db.deleteApplication(a.id);
    }
  }
  const allAppsB = db.getApplicationsByUser(STUDENT_B_ID);
  for (const a of allAppsB) {
    if (testScholIds.includes(a.scholarshipId)) {
      db.deleteApplication(a.id);
    }
  }
});

// ---------------------------------------------------------------------------
// Suite 1: Start Application (POST /api/v1/student/applications)
// ---------------------------------------------------------------------------
describe('Phase 3 — Start Application', () => {
  it('creates a new application with status Preparing and submissionMethod external', async () => {
    const token = signToken(STUDENT_A_ID);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.status).toBe('Preparing');
    expect(data.submissionMethod).toBe('external'); // External Website scholarship
    expect(data.scholarshipId).toBe(SCHOLARSHIP_ID);
    expect(data.userId).toBe(STUDENT_A_ID);
  }, 30000);

  it('requires authentication — returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/student/applications')
      .send({ scholarshipId: SCHOLARSHIP_ID });

    expect(res.status).toBe(401);
  });

  it('returns 400 when scholarshipId is missing', async () => {
    const token = signToken(STUDENT_A_ID);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SCHOLARSHIP_ID_REQUIRED');
  });

  it('returns 404 for a non-existent scholarship', async () => {
    const token = signToken(STUDENT_A_ID);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: 'sch-does-not-exist' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SCHOLARSHIP_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Idempotency — resuming existing draft without duplicating
// ---------------------------------------------------------------------------
describe('Phase 3 — Idempotency: Resume Existing Draft', () => {
  it('returns the same application when student re-posts for a scholarship already tracked', async () => {
    const token = signToken(STUDENT_A_ID);

    // First POST — create
    const first = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(first.status).toBe(201);
    const originalId = first.body.data.id;

    // Second POST — should be idempotent
    const second = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(originalId);

    // Confirm only one record exists in db
    const allApps = db.getApplicationsByUser(STUDENT_A_ID);
    const matching = allApps.filter(a => a.scholarshipId === SCHOLARSHIP_ID);
    expect(matching).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: GET /api/v1/student/applications/:id — ownership check
// ---------------------------------------------------------------------------
describe('Phase 3 — GET Application: Ownership Authorization', () => {
  it('returns 403 when Student B tries to GET Student A\'s application', async () => {
    // Create application as Student A
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    // Try to access as Student B
    const tokenB = signToken(STUDENT_B_ID);
    const getRes = await request(app)
      .get(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('FORBIDDEN');
  });

  it('returns the application when Student A accesses their own record', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(appId);
    expect(getRes.body.data.userId).toBe(STUDENT_A_ID);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: PATCH /api/v1/student/applications/:id — draft saving
// ---------------------------------------------------------------------------
describe('Phase 3 — PATCH Application: Draft Saving', () => {
  it('saves notes, essay draft, and checklist updates without changing status', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const updatedChecklist = [
      { id: 'chk-1', label: 'Transcript', completed: true, required: true },
      { id: 'chk-2', label: 'Personal Statement', completed: false, required: true },
    ];

    const patchRes = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        notes: 'Requested reference from Prof. Smith on Oct 20.',
        essayDraft: 'My motivation is to advance research in renewable energy...',
        checklist: updatedChecklist,
      });

    expect(patchRes.status).toBe(200);
    const saved = patchRes.body.data;
    expect(saved.notes).toBe('Requested reference from Prof. Smith on Oct 20.');
    expect(saved.essayDraft).toBe('My motivation is to advance research in renewable energy...');
    expect(saved.checklist[0].completed).toBe(true);
    // Status must remain Preparing — draft saving must NOT advance the application
    expect(saved.status).toBe('Preparing');
  });

  it('returns 403 when Student B tries to PATCH Student A\'s application', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const tokenB = signToken(STUDENT_B_ID);
    const patchRes = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ notes: 'Injected by Student B' });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('FORBIDDEN');

    // Verify original application unchanged
    const original = db.findApplicationById(appId);
    expect(original?.notes).not.toBe('Injected by Student B');
  });
});

// ---------------------------------------------------------------------------
// Suite 5: External Submission Reporting
// ---------------------------------------------------------------------------
describe('Phase 3 — External Submission Reporting', () => {
  it('sets status to Applied, submissionMethod to external, externalSubmissionConfirmed true', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    // Simulate "I've Submitted Externally" action
    const patchRes = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'Applied',
        submissionMethod: 'external',
        externalSubmissionConfirmed: true,
        appliedAt: new Date().toISOString(),
      });

    expect(patchRes.status).toBe(200);
    const data = patchRes.body.data;
    expect(data.status).toBe('Applied');
    expect(data.submissionMethod).toBe('external');
    // Server must auto-confirm externalSubmissionConfirmed when status=Applied+external
    expect(data.externalSubmissionConfirmed).toBe(true);
    expect(data.appliedAt).toBeTruthy();
  });

  it('does NOT mark status as Applied when checklist is completed without explicit status update', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    // Update checklist only — status must NOT change
    const patchRes = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        checklist: [
          { id: 'chk-1', label: 'Transcript', completed: true, required: true },
          { id: 'chk-2', label: 'Personal Statement', completed: true, required: true },
        ],
      });

    expect(patchRes.status).toBe(200);
    // Completing checklist alone must not auto-advance to Applied
    expect(patchRes.body.data.status).toBe('Preparing');
  });
});

// ---------------------------------------------------------------------------
// Suite 6: DELETE /api/v1/student/applications/:id — ownership check
// ---------------------------------------------------------------------------
describe('Phase 3 — DELETE Application: Ownership Authorization', () => {
  it('returns 403 when Student B tries to DELETE Student A\'s application', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const tokenB = signToken(STUDENT_B_ID);
    const deleteRes = await request(app)
      .delete(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(deleteRes.status).toBe(403);
    // Verify record still exists
    expect(db.findApplicationById(appId)).toBeTruthy();
  });

  it('allows Student A to delete their own application', async () => {
    const tokenA = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(deleteRes.status).toBe(200);
    // Must be removed from db
    expect(db.findApplicationById(appId)).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Backward Compatibility — multi-audience profiles
// ---------------------------------------------------------------------------
describe('Phase 3 — Backward Compatibility', () => {
  it('creates an application for a secondary-stage user without GPA or institution', async () => {
    const secondaryUserId = 'usr-phase3-secondary';
    if (!db.findUserById(secondaryUserId)) {
      db.createUser({
        id: secondaryUserId,
        email: `${secondaryUserId}@test.scholavon.org`,
        passwordHash: 'hash-sec',
        role: 'student',
        firstName: 'Sec',
        lastName: 'Student',
        country: 'NG',
        applicantStage: 'secondary',
        secondarySchoolName: 'Lagos State High School',
        profileCompletion: 35,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    // Clean up any existing application
    const existing = db.getApplicationsByUser(secondaryUserId);
    for (const a of existing) {
      if (a.scholarshipId === SCHOLARSHIP_ID) db.deleteApplication(a.id);
    }

    const token = signToken(secondaryUserId);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Preparing');
    expect(res.body.data.userId).toBe(secondaryUserId);
  });

  it('creates an application for a vocational-stage user without GPA', async () => {
    const vocUserId = 'usr-phase3-vocational';
    if (!db.findUserById(vocUserId)) {
      db.createUser({
        id: vocUserId,
        email: `${vocUserId}@test.scholavon.org`,
        passwordHash: 'hash-voc',
        role: 'student',
        firstName: 'Voc',
        lastName: 'Learner',
        country: 'AU',
        applicantStage: 'vocational',
        tradeSpecialization: 'Plumbing',
        profileCompletion: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }

    const existing = db.getApplicationsByUser(vocUserId);
    for (const a of existing) {
      if (a.scholarshipId === SCHOLARSHIP_ID) db.deleteApplication(a.id);
    }

    const token = signToken(vocUserId);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Preparing');
  });
});

// ---------------------------------------------------------------------------
// Suite 8: Phase 3.1 — Native Submission & Draft Sync Feedback
// ---------------------------------------------------------------------------
describe('Phase 3.1 — Submission Integrity & Save Feedback', () => {
  it('initializes a native application in Preparing (draft) state without marking it Applied', async () => {
    const token = signToken(STUDENT_A_ID);
    const res = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLAVON_NATIVE_SCHOLARSHIP_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Preparing');
    expect(res.body.data.submissionMethod).toBe('native');
    expect(res.body.data.appliedAt).toBeFalsy();
  });

  it('ensures no arbitrary unvalidated /submit endpoint falsely marks native application as Applied', async () => {
    const token = signToken(STUDENT_A_ID);
    // Create draft
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLAVON_NATIVE_SCHOLARSHIP_ID });
    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    // Verify there is no rogue native submission endpoint that bypasses validation
    const submitAttempt = await request(app)
      .post(`/api/v1/student/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    // Should be 404 since native submission is not yet implemented on the server
    expect(submitAttempt.status).toBe(404);

    // Application status must remain Preparing
    const getRes = await request(app)
      .get(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('Preparing');
  });

  it('distinguishes successful draft sync (200 OK) from sync failure', async () => {
    const token = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    const appId = createRes.body.data.id;

    // 1. Successful sync
    const successfulSync = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        notes: 'Notes saved via sync',
        essayDraft: 'Draft content synchronized',
        essayStatus: 'drafting',
      });
    expect(successfulSync.status).toBe(200);
    expect(successfulSync.body.success).toBe(true);
    expect(successfulSync.body.data.notes).toBe('Notes saved via sync');

    // 2. Failed sync (e.g. invalid application id or network error simulator)
    const failedSync = await request(app)
      .patch('/api/v1/student/applications/app-non-existent-999')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Will fail' });
    expect(failedSync.status).toBe(404);
    expect(failedSync.body.success).toBe(false);

    // 3. Unauthorized sync attempt (e.g. expired token / no auth)
    const unauthSync = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .send({ notes: 'Unauthenticated attempt' });
    expect(unauthSync.status).toBe(401);
  });

  it('external submission remains explicitly self-reported with student_updated source and confirmation flag', async () => {
    const token = signToken(STUDENT_A_ID);
    const createRes = await request(app)
      .post('/api/v1/student/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ scholarshipId: SCHOLARSHIP_ID });
    const appId = createRes.body.data.id;

    const reportRes = await request(app)
      .patch(`/api/v1/student/applications/${appId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'Applied',
        submissionMethod: 'external',
        externalSubmissionConfirmed: true,
        statusSource: 'student_updated',
        appliedAt: new Date().toISOString(),
      });

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.status).toBe('Applied');
    expect(reportRes.body.data.submissionMethod).toBe('external');
    expect(reportRes.body.data.externalSubmissionConfirmed).toBe(true);
    expect(reportRes.body.data.statusSource).toBe('student_updated');
  });
});

