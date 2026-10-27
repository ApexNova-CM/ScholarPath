import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Polyfill localStorage for Node/Vitest environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  clear() { this.store = {}; }
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, value: string): void { this.store[key] = String(value); }
  removeItem(key: string): void { delete this.store[key]; }
}
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageMock(),
    writable: true,
  });
}
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
  });
}

import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';
import { UserRecord } from '../src/types';

describe('BUG-02 Security Fix: Role & Subscription Privilege Protection', () => {
  const adminId = 'usr-admin-priv-test';
  const adminEmail = 'admin_priv_test@scholavon.org';
  const secondAdminId = 'usr-admin-priv-test-2';
  const secondAdminEmail = 'second_admin_priv_test@scholavon.org';
  const studentId = 'usr-student-priv-test';
  const studentEmail = 'student_priv_test@scholavon.org';

  let studentToken = '';
  let adminToken = '';

  beforeAll(async () => {
    // Intercept db.save to protect db.json from mutations during tests
    (db as any).save = vi.fn();
    await db.init();

    // Seed test users in memory store
    const studentUser: UserRecord = {
      id: studentId,
      email: studentEmail,
      passwordHash: 'dummyhash',
      role: 'student',
      subscriptionStatus: 'free',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (db.findUserById(studentId)) {
      db.updateUser(studentId, studentUser);
    } else {
      db.createUser(studentUser);
    }
    db.upsertProfile({
      profileCompletion: 100,
      userId: studentId,
      firstName: 'Test',
      lastName: 'Student',
      country: 'Nigeria',
      educationLevel: 'Undergraduate',
      institution: 'University of Lagos',
      fieldOfStudy: 'Computer Engineering',
      gpa: 3.8,
      gpaScale: 4.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const adminUser: UserRecord = {
      id: adminId,
      email: adminEmail,
      passwordHash: 'dummyhash',
      role: 'admin',
      subscriptionStatus: 'premium',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (db.findUserById(adminId)) {
      db.updateUser(adminId, adminUser);
    } else {
      db.createUser(adminUser);
    }
    db.createAdminUser({
      id: adminId,
      firstName: 'Priv',
      lastName: 'Admin',
      email: adminEmail,
      role: 'Admin',
      status: 'Active',
      assignedDepartment: 'Security Operations',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });

    // Create tokens
    studentToken = jwt.sign(
      { id: studentId, email: studentEmail, role: 'student' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { id: adminId, email: adminEmail, role: 'admin' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Registration & Metadata Privilege Protection', () => {
    it('should ignore any client-supplied role in registration payload and assign student role', async () => {
      const targetEmail = `forged_role_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: targetEmail,
          password: 'Password123!',
          firstName: 'Attacker',
          lastName: 'User',
          role: 'admin', // Injected role attempt
          subscriptionStatus: 'premium', // Injected subscription attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('student');

      // Verify in database store
      const created = db.findUserByEmail(targetEmail);
      expect(created?.role).toBe('student');
    });
  });

  describe('2. Unauthorized Privilege Escalation Blocked', () => {
    it('should block a regular student from calling admin role update endpoint (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${studentId}/role`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');

      // Confirm role remained student
      const user = db.findUserById(studentId);
      expect(user?.role).toBe('student');
    });

    it('should reject invalid role assignments on admin role update endpoint (400)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${studentId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'super_hacker' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_ROLE');
    });
  });

  describe('3. Ordinary Profile Edits Preserved', () => {
    it('should allow student to update legitimate academic profile fields without changing role', async () => {
      const res = await request(app)
        .put('/api/v1/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: 'UpdatedName',
          gpa: 3.95,
          fieldOfStudy: 'Software Engineering',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('UpdatedName');
      expect(res.body.data.gpa).toBe(3.95);

      // Verify user account role in db is still student
      const user = db.findUserById(studentId);
      expect(user?.role).toBe('student');
    });
  });

  describe('4. Authorized Admin Management & Last-Admin Safeguard', () => {
    it('should allow an authorized admin to promote a student to admin', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${studentId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin', department: 'Operations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = db.findUserById(studentId);
      expect(updated?.role).toBe('admin');
    });

    it('should allow an authorized admin to demote another admin when multiple admins exist', async () => {
      // Ensure two admins exist
      const secondAdminUser: UserRecord = {
        id: secondAdminId,
        email: secondAdminEmail,
        passwordHash: 'dummyhash',
        role: 'admin',
        subscriptionStatus: 'free',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (db.findUserById(secondAdminId)) {
        db.updateUser(secondAdminId, secondAdminUser);
      } else {
        db.createUser(secondAdminUser);
      }
      db.createAdminUser({
        id: secondAdminId,
        firstName: 'Second',
        lastName: 'Admin',
        email: secondAdminEmail,
        role: 'Admin',
        status: 'Active',
        assignedDepartment: 'Operations',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      // Demote second admin to student
      const res = await request(app)
        .put(`/api/v1/admin/users/${secondAdminId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const demoted = db.findUserById(secondAdminId);
      expect(demoted?.role).toBe('student');
    });

    it('should block demoting the last remaining administrator (CANNOT_REMOVE_LAST_ADMIN)', async () => {
      // Mock db.getAdminUsers to simulate only 1 admin remaining
      vi.spyOn(db, 'getAdminUsers').mockReturnValue([{ id: adminId } as any]);

      // Attempt to demote the sole remaining admin
      const res = await request(app)
        .put(`/api/v1/admin/users/${adminId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_REMOVE_LAST_ADMIN');

      // Admin role must still be preserved
      const user = db.findUserById(adminId);
      expect(user?.role).toBe('admin');
    });
  });

  describe('5. Paystack Subscription Processing Integrity', () => {
    const testSecret = 'sk_test_mock_paystack_secret_key_99999';
    let origSecret: string;

    beforeAll(() => {
      origSecret = config.paystackSecretKey;
    });

    afterEach(() => {
      config.paystackSecretKey = origSecret;
    });

    it('should reject webhook requests with invalid Paystack signature (400)', async () => {
      config.paystackSecretKey = testSecret;

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', 'invalid_signature_hash')
        .send(JSON.stringify({
          event: 'charge.success',
          data: {
            reference: 'sch_ref_test_001',
            amount: 500000,
            currency: 'NGN',
            customer: { email: studentEmail },
          },
        }));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid webhook signature');
    });

    it('should process webhook when valid signature is supplied (200)', async () => {
      config.paystackSecretKey = testSecret;

      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          reference: `sch_test_${Date.now()}`,
          amount: 500000,
          currency: 'NGN',
          customer: { email: studentEmail, customer_code: 'CUS_test_001' },
          metadata: { userId: studentId, planId: 'premium_monthly' },
        },
      });

      const hmac = crypto
        .createHmac('sha512', testSecret)
        .update(Buffer.from(payload, 'utf-8'))
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', hmac)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
