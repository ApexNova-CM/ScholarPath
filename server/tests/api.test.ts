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
        email: 'admin@scholarpath.org',
        password: 'admin123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('admin');
    adminToken = res.body.data.token;
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
