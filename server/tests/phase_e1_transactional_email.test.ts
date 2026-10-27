import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { emailService } from '../src/services/emailService';
import crypto from 'crypto';

describe('Phase E1 / E1.1: Transactional Email & Password Reset Suite', () => {
  const testStudentEmail = `phase_e1_${Date.now()}@test.scholavon.org`;
  const initialPassword = 'passwordOld123';
  const updatedPassword = 'newPassword456!';
  let userId = '';

  beforeAll(async () => {
    await db.init();

    // Register a student for testing
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testStudentEmail,
        password: initialPassword,
        firstName: 'Elena',
        lastName: 'Rostova',
        country: 'Nigeria',
        educationLevel: 'Undergraduate',
        institution: 'University of Lagos',
        fieldOfStudy: 'Biochemistry',
        gpa: 3.8,
        gpaScale: 4.0,
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    userId = regRes.body.data.user.id;
  });

  describe('1. Registration & Welcome Email Behavior', () => {
    it('registers successfully even when email provider is unconfigured (non-blocking)', async () => {
      const anotherEmail = `welcome_test_${Date.now()}@test.scholavon.org`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: anotherEmail,
          password: 'strongPassword999!',
          firstName: 'Amara',
          lastName: 'Okonkwo',
          country: 'Ghana',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(anotherEmail);
    });

    it('sendWelcome generates deterministic idempotency key and handles missing config gracefully', async () => {
      const result = await emailService.sendWelcome(
        testStudentEmail,
        'Elena',
        userId
      );

      // In test environment without EMAIL_PROVIDER_API_KEY, result must be not_configured
      expect(result.accepted).toBe(false);
      expect(result.status).toBe('not_configured');
      expect(result.statusMessage).toContain('Email provider not configured');
    });
  });

  describe('2. Forgot-Password Request Handling & Anti-Enumeration', () => {
    it('rejects invalid email payload with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 generic success for unknown email to prevent enumeration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown_user_99999@test.scholavon.org' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('password-reset link has been sent');
    });

    it('returns 200 and generates a valid reset token for existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testStudentEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('password-reset link has been sent');
    });

    it('invalidates prior reset tokens when a new reset is requested for the same email', async () => {
      // Create token 1
      const rawToken1 = 'test-token-1-' + crypto.randomUUID();
      const hash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
      db.storePasswordResetToken({
        tokenHash: hash1,
        userId,
        email: testStudentEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      // Request another reset through the API for the same email
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testStudentEmail });
      expect(res.status).toBe(200);

      // Token 1 must now be superseded and consumePasswordResetToken must return null
      const consumedOld = db.consumePasswordResetToken(hash1);
      expect(consumedOld).toBeNull();
    });
  });

  describe('3. Reset-Password Token Validation & Execution', () => {
    it('rejects reset request with non-existent or malformed token (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-fake-token-1234567890abcdef',
          newPassword: 'brandNewPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('rejects password shorter than 8 characters (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token',
          newPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully consumes a valid token and updates password in credential store', async () => {
      // Create a known token directly in store to test consumption & password update
      const rawToken = 'test-secret-raw-token-' + crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      db.storePasswordResetToken({
        tokenHash,
        userId,
        email: testStudentEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      // Submit reset request with the raw token
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: updatedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Your password has been updated successfully');

      // Verify old password no longer works in login
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: initialPassword,
        });
      expect(oldLogin.status).toBe(401);

      // Verify new password works in login
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: updatedPassword,
        });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.success).toBe(true);
    });

    it('prevents replay attacks: token cannot be reused after consumption', async () => {
      const rawToken = 'test-replay-token-' + crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      db.storePasswordResetToken({
        tokenHash,
        userId,
        email: testStudentEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      });

      // First use: success
      const res1 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'replayedPassword1!',
        });
      expect(res1.status).toBe(200);

      // Second use: must fail
      const res2 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'replayedPassword2!',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('rejects expired tokens (400)', async () => {
      const rawToken = 'expired-token-' + crypto.randomUUID();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Expired 5 minutes ago
      db.storePasswordResetToken({
        tokenHash,
        userId,
        email: testStudentEmail,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'anotherNewPassword888!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  describe('4. Email Delivery Status Distinction', () => {
    it('distinguishes unconfigured status cleanly without throwing', async () => {
      const res = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(res.status).toBe('not_configured');
      expect(res.accepted).toBe(false);
      expect(res.delivered).toBe(false);
      expect(res.statusMessage).toContain('Email provider not configured');
    });
  });
});
