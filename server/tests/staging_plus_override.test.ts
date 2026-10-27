import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Polyfill localStorage for Node/Vitest environment
class LocalStorageMock {
  private store: Record<string, string> = {};
  clear() {
    this.store = {};
  }
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  const mockStorage = new LocalStorageMock();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
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
import { isStagingPlusOverrideActive, AUTHORIZED_TEST_EMAIL } from '../src/utils/stagingGuard';

function createAuthToken(userId: string, email: string, role: string = 'student'): string {
  return jwt.sign({ id: userId, email, role }, config.jwtSecret, { expiresIn: '1h' });
}

describe('Staging-Only Scholavon Plus Test Override Security Suite', () => {
  const authorizedEmail = AUTHORIZED_TEST_EMAIL;
  const authorizedUserId = 'usr-test-authorized-plus';
  const unauthorizedEmail = 'regularstudent@example.com';
  const unauthorizedUserId = 'usr-test-regular-student';

  const origEnv = { ...process.env };
  const origConfigAllow = config.allowStagingPlusOverride;
  const origConfigEmail = config.stagingPlusOverrideEmail;
  const origConfigEnv = config.env;
  const origConfigAppUrl = config.appUrl;
  const origSupabaseUrl = config.supabaseUrl;
  const origSupabaseKey = config.supabaseServiceRoleKey;
  let origSave: any;

  beforeEach(async () => {
    // Intercept db.save to protect db.json
    origSave = (db as any).save;
    (db as any).save = vi.fn();

    // Set standard non-production test state
    process.env.NODE_ENV = 'test';
    config.env = 'test';
    config.allowStagingPlusOverride = true;
    config.stagingPlusOverrideEmail = authorizedEmail;
    config.appUrl = 'http://localhost:3000';

    // Disable Supabase so all routes fall back to local db — prevents network timeouts
    config.supabaseUrl = '';
    config.supabaseServiceRoleKey = '';

    await db.init();

    // Seed test users in local store
    const userAuth: UserRecord = {
      id: authorizedUserId,
      email: authorizedEmail,
      passwordHash: 'dummy_hash',
      role: 'student',
      subscriptionStatus: 'free',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (db.findUserById(authorizedUserId)) {
      db.updateUser(authorizedUserId, userAuth);
    } else {
      db.createUser(userAuth);
    }

    const userUnauth: UserRecord = {
      id: unauthorizedUserId,
      email: unauthorizedEmail,
      passwordHash: 'dummy_hash',
      role: 'student',
      subscriptionStatus: 'free',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (db.findUserById(unauthorizedUserId)) {
      db.updateUser(unauthorizedUserId, userUnauth);
    } else {
      db.createUser(userUnauth);
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    config.allowStagingPlusOverride = origConfigAllow;
    config.stagingPlusOverrideEmail = origConfigEmail;
    config.env = origConfigEnv;
    config.appUrl = origConfigAppUrl;
    config.supabaseUrl = origSupabaseUrl;
    config.supabaseServiceRoleKey = origSupabaseKey;
    if (origSave) {
      (db as any).save = origSave;
    }
  });

  describe('1. Fail-Closed Production Guards', () => {
    it('returns false if allowStagingPlusOverride is false', () => {
      config.allowStagingPlusOverride = false;
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when config.env is production', () => {
      config.env = 'production';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when RAILWAY_ENVIRONMENT_NAME is production', () => {
      process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when VERCEL_ENV is production', () => {
      process.env.VERCEL_ENV = 'production';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when appUrl points to production domain scholavon.com', () => {
      config.appUrl = 'https://scholavon.com';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when appUrl points to production domain www.scholavon.org', () => {
      config.appUrl = 'https://www.scholavon.org';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed when environment name is ambiguous/unrecognized', () => {
      process.env.NODE_ENV = 'unknown_custom_env';
      config.env = 'unknown_custom_env';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });
  });

  describe('2. User Isolation & Authentication Guards', () => {
    it('fails closed for unauthorized email addresses', () => {
      expect(isStagingPlusOverrideActive(unauthorizedUserId, unauthorizedEmail)).toBe(false);
    });

    it('fails closed if configured override email does not match authorized email', () => {
      config.stagingPlusOverrideEmail = 'someoneelse@gmail.com';
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(false);
    });

    it('fails closed if user email is empty or missing', () => {
      expect(isStagingPlusOverrideActive('unknown-id', '')).toBe(false);
    });

    it('succeeds in non-prod staging/test environment for authorized user', () => {
      expect(isStagingPlusOverrideActive(authorizedUserId, authorizedEmail)).toBe(true);
    });
  });

  describe('3. GET /api/v1/payments/status Endpoint Contract', () => {
    it('returns 401 Unauthorized if no token is provided', async () => {
      const res = await request(app).get('/api/v1/payments/status');
      expect(res.status).toBe(401);
    });

    it('returns test override status for authorized user in staging without Paystack records', async () => {
      const token = createAuthToken(authorizedUserId, authorizedEmail);
      const res = await request(app)
        .get('/api/v1/payments/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        planId: 'staging_test_override',
        status: 'active',
        isTestOverride: true,
        currentPeriodEnd: null,
        nextPaymentDate: null,
        cancelledAt: null,
      });
    });

    it('returns regular status (free) for unauthorized user', async () => {
      const token = createAuthToken(unauthorizedUserId, unauthorizedEmail);
      const res = await request(app)
        .get('/api/v1/payments/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('free');
      expect(res.body.data.isTestOverride).toBeUndefined();
    });
  });

  describe('4. Entitlement Enforcement (Applications, Documents, AI)', () => {
    it('allows authorized test user to track more than 3 applications while restricting unauthorized user', async () => {
      // Create 4 scholarships
      for (let i = 1; i <= 4; i++) {
        db.createScholarship({
          id: `sch-test-limit-${i}`,
          title: `Scholarship ${i}`,
          providerId: 'prov-1',
          providerName: 'Foundation',
          description: 'Desc',
          amount: 5000,
          currency: 'USD',
          deadline: '2028-12-31',
          educationLevels: ['Undergraduate'],
          fieldsOfStudy: ['Engineering'],
          countries: ['International'],
          applicationUrl: 'https://example.com',
          status: 'verified',
          featured: false,
          verified: true,
          viewCount: 0,
          savedCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
      }

      // Seed 3 existing applications for unauthorized user
      const unauthApps = [
        { id: 'app-u-1', userId: unauthorizedUserId, scholarshipId: 'sch-test-limit-1', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'app-u-2', userId: unauthorizedUserId, scholarshipId: 'sch-test-limit-2', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'app-u-3', userId: unauthorizedUserId, scholarshipId: 'sch-test-limit-3', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      for (const a of unauthApps) db.createApplication(a as any);

      // Seed 3 existing applications for authorized user
      const authApps = [
        { id: 'app-a-1', userId: authorizedUserId, scholarshipId: 'sch-test-limit-1', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'app-a-2', userId: authorizedUserId, scholarshipId: 'sch-test-limit-2', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'app-a-3', userId: authorizedUserId, scholarshipId: 'sch-test-limit-3', status: 'submitted', timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      for (const a of authApps) db.createApplication(a as any);

      // Unauthorized user tries 4th application -> 403 UPGRADE_REQUIRED
      const unauthToken = createAuthToken(unauthorizedUserId, unauthorizedEmail);
      const unauthRes = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${unauthToken}`)
        .send({ scholarshipId: 'sch-test-limit-4' });

      expect(unauthRes.status).toBe(403);
      expect(unauthRes.body.error?.code).toBe('UPGRADE_REQUIRED');

      // Authorized user with staging override tries 4th application -> 201 Success
      const authToken = createAuthToken(authorizedUserId, authorizedEmail);
      const authRes = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scholarshipId: 'sch-test-limit-4' });

      expect(authRes.status).toBe(201);
      expect(authRes.body.success).toBe(true);
    });

    it('allows authorized test user to upload more than 3 documents while restricting unauthorized user', async () => {
      // Seed 3 documents for both
      for (let i = 1; i <= 3; i++) {
        db.createDocument({
          id: `doc-u-${i}`,
          userId: unauthorizedUserId,
          name: `Doc ${i}`,
          type: 'transcript',
          fileFormat: 'pdf',
          fileSize: 1024,
          fileUrl: '/tmp/test.pdf',
          verified: false,
          uploadedAt: new Date().toISOString(),
        });
        db.createDocument({
          id: `doc-a-${i}`,
          userId: authorizedUserId,
          name: `Doc ${i}`,
          type: 'transcript',
          fileFormat: 'pdf',
          fileSize: 1024,
          fileUrl: '/tmp/test.pdf',
          verified: false,
          uploadedAt: new Date().toISOString(),
        });
      }

      // Unauthorized user attempts 4th document
      const unauthToken = createAuthToken(unauthorizedUserId, unauthorizedEmail);
      const unauthRes = await request(app)
        .post('/api/v1/student/documents/upload')
        .set('Authorization', `Bearer ${unauthToken}`)
        .field('name', 'Doc 4')
        .field('type', 'essay');

      expect(unauthRes.status).toBe(403);
      expect(unauthRes.body.error?.code).toBe('UPGRADE_REQUIRED');

      // Authorized test user attempts 4th document
      const authToken = createAuthToken(authorizedUserId, authorizedEmail);
      const authRes = await request(app)
        .post('/api/v1/student/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('name', 'Doc 4')
        .field('type', 'essay');

      expect(authRes.status).toBe(201);
      expect(authRes.body.success).toBe(true);
    });

    it('allows authorized test user to exceed 5 daily AI prompts while restricting unauthorized user', async () => {
      const today = new Date().toISOString().slice(0, 10);
      // Max out prompt count for both
      for (let i = 0; i < 5; i++) {
        db.incrementDailyAiPromptCount(unauthorizedUserId, today);
        db.incrementDailyAiPromptCount(authorizedUserId, today);
      }

      // Unauthorized user hits 403 on 6th prompt
      const unauthToken = createAuthToken(unauthorizedUserId, unauthorizedEmail);
      const unauthRes = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${unauthToken}`)
        .send({ message: 'Hello Vona' });

      expect(unauthRes.status).toBe(403);
      expect(unauthRes.body.error?.code).toBe('UPGRADE_REQUIRED');

      // Authorized user bypasses limit and proceeds to AI processing (not 403)
      const authToken = createAuthToken(authorizedUserId, authorizedEmail);
      const authRes = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Hello Vona' });

      // Should not be 403 UPGRADE_REQUIRED
      expect(authRes.status).not.toBe(403);
    });
  });
});
