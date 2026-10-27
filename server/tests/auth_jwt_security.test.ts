import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Polyfill localStorage for Node/Vitest environment if needed
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

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';

describe('BUG-01 Security Fix: JWT Authentication & Verification', () => {
  const adminId = 'usr-admin-001';
  const studentId = 'usr-test-jwt-student';
  const attackerSecret = 'attacker-crafted-secret-key-12345';

  const origSupabaseUrl = config.supabaseUrl;
  const origSupabaseKey = config.supabaseServiceRoleKey;

  beforeAll(async () => {
    (db as any).save = vi.fn();
    await db.init();
    // Ensure test student exists in db
    if (!db.findUserById(studentId)) {
      db.createUser({
        id: studentId,
        email: 'jwt_student@scholavon.org',
        passwordHash: 'dummyhash',
        role: 'student',
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    // Default mock behavior
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    // Default test state: Supabase unconfigured unless test explicitly configures it
    config.supabaseUrl = '';
    config.supabaseServiceRoleKey = '';
  });

  afterEach(() => {
    config.supabaseUrl = origSupabaseUrl;
    config.supabaseServiceRoleKey = origSupabaseKey;
  });

  describe('Forged & Tampered Token Rejection', () => {
    it('should reject forged token signed with an arbitrary attacker secret', async () => {
      const forgedToken = jwt.sign(
        { sub: adminId, email: 'admin@scholavon.org' },
        attackerSecret,
        { algorithm: 'HS256' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject unsigned token (alg: none) attempting admin bypass', async () => {
      // Craft header and payload with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: adminId, email: 'admin@scholavon.org' })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should prevent forged token from accessing admin endpoints (BUG-01 exploit scenario)', async () => {
      const forgedAdminToken = jwt.sign(
        { sub: adminId, id: adminId, email: 'admin@scholavon.org', role: 'admin' },
        'untrusted-secret-key'
      );

      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${forgedAdminToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired custom token', async () => {
      const expiredToken = jwt.sign(
        { id: studentId, email: 'jwt_student@scholavon.org', role: 'student' },
        config.jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject completely malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-even-a-jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject request missing authorization token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Legitimate Custom Token Authentication', () => {
    it('should accept legitimate custom token signed with config.jwtSecret', async () => {
      const validToken = jwt.sign(
        { id: studentId, email: 'jwt_student@scholavon.org', role: 'student' },
        config.jwtSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentId);
      expect(res.body.data.user.role).toBe('student');
    });

    it('should resolve role from database and ignore role spoofed in token claims', async () => {
      // User creates a token with valid secret for studentId, but claims role: 'admin'
      const spoofedRoleToken = jwt.sign(
        { id: studentId, email: 'jwt_student@scholavon.org', role: 'admin' },
        config.jwtSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      // Student attempting to access admin endpoint
      const adminRes = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${spoofedRoleToken}`);

      expect(adminRes.status).toBe(403);
      expect(adminRes.body.success).toBe(false);
      expect(adminRes.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Supabase Token Verification Path', () => {
    it('should accept valid Supabase token verified via Supabase Auth getUser', async () => {
      config.supabaseUrl = 'https://mock-supabase.supabase.co';
      config.supabaseServiceRoleKey = 'mock-service-role-key';

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: studentId,
            email: 'jwt_student@scholavon.org',
          },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'student' },
              error: null,
            }),
          }),
        }),
      });

      const supabaseToken = 'valid.supabase.access.token';

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${supabaseToken}`);

      expect(mockGetUser).toHaveBeenCalledWith(supabaseToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentId);
    });

    it('should reject Supabase token when getUser returns an error', async () => {
      config.supabaseUrl = 'https://mock-supabase.supabase.co';
      config.supabaseServiceRoleKey = 'mock-service-role-key';

      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid JWT signature', status: 401 },
      });

      const invalidSupabaseToken = 'invalid.supabase.token';

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${invalidSupabaseToken}`);

      expect(mockGetUser).toHaveBeenCalledWith(invalidSupabaseToken);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
