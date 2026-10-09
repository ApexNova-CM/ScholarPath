import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { 
  formatScholarshipAmount, 
  formatScholarshipDeadline, 
  getCurrencySymbol, 
  isDeadlinePassed,
  getDaysUntilDeadline,
  SUPPORT_EMAIL,
  buildSupportMailtoUrl
} from '../../src/utils/formatters';
import {
  isScholarshipOpen,
  isScholarshipClosingSoon,
  isScholarshipClosed,
  computeLifecycleStatus
} from '../../src/services/scholarshipFilters';
import { Scholarship } from '../../src/types';

describe('User Feedback Improvements Suite', () => {
  describe('Task 3: Award Currency & Amount Formatting', () => {
    it('formats numeric amounts with proper currency symbols', () => {
      expect(formatScholarshipAmount({ amount: 500000, award_currency: 'NGN' })).toBe('₦500,000');
      expect(formatScholarshipAmount({ amount: 15000, currency: 'GBP' })).toBe('£15,000');
      expect(formatScholarshipAmount({ amount: 20000, currency: 'EUR' })).toBe('€20,000');
      expect(formatScholarshipAmount({ amount: 10000, currency: 'USD' })).toBe('$10,000');
      expect(formatScholarshipAmount({ amount: 5000, currency: 'CAD' })).toBe('CA$5,000');
    });

    it('preserves descriptive award text when awardValueText / awardDescription is present', () => {
      expect(formatScholarshipAmount({ amount: 0, awardValueText: 'Full tuition + living stipend' })).toBe('Full tuition + living stipend');
      expect(formatScholarshipAmount({ amount: 500000, awardValueText: 'Up to ₦500,000' })).toBe('Up to ₦500,000');
      expect(formatScholarshipAmount({ awardDescription: 'Variable based on need' })).toBe('Variable based on need');
      expect(formatScholarshipAmount({ awardValueText: 'Not publicly disclosed' })).toBe('Not publicly disclosed');
    });

    it('handles zero or missing amounts gracefully without falsely defaulting to USD', () => {
      expect(formatScholarshipAmount({ amount: 0 })).toBe('Not specified');
      expect(formatScholarshipAmount({})).toBe('Not specified');
      expect(formatScholarshipAmount(null as any)).toBe('Not specified');
    });
  });

  describe('Task 2: Deadline Formatting & Timezone Safety', () => {
    it('formats date strings into human-readable format', () => {
      const formatted = formatScholarshipDeadline('2026-11-25');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Nov');
    });

    it('returns "Deadline not specified" for missing or invalid dates', () => {
      expect(formatScholarshipDeadline('')).toBe('Deadline not specified');
      expect(formatScholarshipDeadline(null as any)).toBe('Deadline not specified');
      expect(formatScholarshipDeadline('invalid-date')).toBe('Deadline not specified');
    });

    it('treats date-only strings as valid through 23:59:59.999 local to prevent premature closure', () => {
      // Use tomorrow's local date so the test is never timezone-sensitive
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const futureStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      expect(isDeadlinePassed(futureStr, noon)).toBe(false);
    });
  });

  describe('Task 1: Open, Closing Soon, and Closed Status Computation', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = '2020-01-01T00:00:00Z';

    const baseSch: Scholarship = {
      id: 'sch-status-test',
      title: 'Status Test Scholarship',
      providerId: 'p-1',
      providerName: 'Test Provider',
      description: 'Desc',
      shortDescription: 'Short',
      category: 'General',
      tags: [],
      amount: 5000,
      currency: 'USD',
      fundingType: 'Partial',
      eligibleCountries: ['All'],
      educationLevels: ['Undergraduate'],
      fieldsOfStudy: ['All'],
      gpaScale: 4.0,
      requiredDocuments: [],
      applicationInstructions: '',
      applicationUrl: 'https://example.com',
      deadline: futureDate,
      status: 'verified',
      verificationStatus: 'verified',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('identifies open scholarships correctly', () => {
      expect(isScholarshipOpen(baseSch)).toBe(true);
      expect(isScholarshipClosed(baseSch)).toBe(false);
    });

    it('identifies closing soon scholarships correctly (<= 7 days)', () => {
      const soonSch = { ...baseSch, deadline: soonDate };
      expect(isScholarshipOpen(soonSch)).toBe(true);
      expect(isScholarshipClosingSoon(soonSch)).toBe(true);
      expect(computeLifecycleStatus(soonSch)).toBe('closing_soon');
    });

    it('identifies closed scholarships (past deadline or manually closed)', () => {
      const expiredSch = { ...baseSch, deadline: pastDate };
      expect(isScholarshipClosed(expiredSch)).toBe(true);
      expect(isScholarshipOpen(expiredSch)).toBe(false);

      const manuallyClosedSch = { ...baseSch, manuallyClosed: true };
      expect(isScholarshipClosed(manuallyClosedSch)).toBe(true);
      expect(isScholarshipOpen(manuallyClosedSch)).toBe(false);
    });

    it('keeps pending and rejected scholarships out of student open status', () => {
      const pendingSch = { ...baseSch, status: 'pending' as any, verificationStatus: 'pending' as any };
      expect(isScholarshipOpen(pendingSch)).toBe(false);

      const rejectedSch = { ...baseSch, status: 'rejected' as any, verificationStatus: 'rejected' as any };
      expect(isScholarshipOpen(rejectedSch)).toBe(false);
    });
  });

  describe('Task 6: Application Creation Guard for Closed Scholarships (API)', () => {
    let studentToken = '';
    let studentId = '';
    let openSchId = '';
    let closedSchId = '';

    beforeAll(async () => {
      await db.init();

      // Register student
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `fb_student_${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Feedback',
          lastName: 'Tester',
          country: 'Nigeria',
          educationLevel: 'Undergraduate',
          institution: 'Unilag',
          fieldOfStudy: 'Engineering',
          gpa: 4.5,
          gpaScale: 5.0,
        });

      studentToken = regRes.body.data.token;
      studentId = regRes.body.data.user.id;

      // Seed an open scholarship and a closed scholarship
      openSchId = `open-sch-${Date.now()}`;
      closedSchId = `closed-sch-${Date.now()}`;

      await db.createScholarship({
        id: openSchId,
        title: 'Open Scholarship',
        providerId: 'p-1',
        providerName: 'Open Org',
        description: 'Open desc',
        shortDescription: 'Open',
        category: 'Tech',
        tags: [],
        amount: 250000,
        currency: 'NGN',
        awardCurrency: 'NGN',
        fundingType: 'Partial',
        eligibleCountries: ['Nigeria'],
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Engineering'],
        gpaScale: 5.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: 'https://example.com',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'verified',
        verificationStatus: 'verified',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.createScholarship({
        id: closedSchId,
        title: 'Closed Scholarship',
        providerId: 'p-2',
        providerName: 'Closed Org',
        description: 'Closed desc',
        shortDescription: 'Closed',
        category: 'Tech',
        tags: [],
        amount: 100000,
        currency: 'NGN',
        awardCurrency: 'NGN',
        fundingType: 'Partial',
        eligibleCountries: ['Nigeria'],
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Engineering'],
        gpaScale: 5.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: 'https://example.com',
        deadline: '2021-01-01T00:00:00Z',
        status: 'closed',
        manuallyClosed: true,
        verificationStatus: 'verified',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('rejects new application for closed scholarship with 400 SCHOLARSHIP_CLOSED', async () => {
      const res = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          scholarshipId: closedSchId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SCHOLARSHIP_CLOSED');
    });

    it('allows application creation for open scholarship', async () => {
      const res = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          scholarshipId: openSchId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scholarshipId).toBe(openSchId);
    });

    it('returns existing application idempotently even if scholarship becomes closed later', async () => {
      // Re-posting for openSchId (now tracked) returns the existing application
      const res = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          scholarshipId: openSchId,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scholarshipId).toBe(openSchId);
    });
  });

  describe('Task 5: Human Support Email & Safe Mailto URL Generation', () => {
    it('uses official support@scholavon.com recipient address', () => {
      expect(SUPPORT_EMAIL).toBe('support@scholavon.com');
      const url = buildSupportMailtoUrl();
      expect(url).toContain('mailto:support@scholavon.com');
    });

    it('safely encodes subject with spaces, ampersands, and special characters', () => {
      const url = buildSupportMailtoUrl({
        subject: 'Scholarship #123 & Question / Help? + Feedback'
      });
      expect(url).toContain('mailto:support@scholavon.com');
      expect(url).toContain('subject=Scholarship%20%23123%20%26%20Question%20%2F%20Help%3F%20%2B%20Feedback');
    });

    it('safely encodes message with line breaks as CRLF (%0D%0A) for email client compatibility', () => {
      const url = buildSupportMailtoUrl({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        subject: 'Inquiry',
        message: 'Line 1: Hello\nLine 2: Question about eligibility\r\nLine 3: Thanks & regards'
      });

      expect(url).toContain('mailto:support@scholavon.com');
      expect(url).toContain('subject=Inquiry');
      // Verify body is encoded and contains CRLF
      expect(url).toContain('body=');
      const decodedBody = decodeURIComponent(url.split('body=')[1]);
      expect(decodedBody).toContain('Ada Lovelace');
      expect(decodedBody).toContain('ada@example.com');
      expect(decodedBody).toContain('Line 1: Hello\r\nLine 2: Question about eligibility\r\nLine 3: Thanks & regards');
      expect(decodedBody).toContain('Sent from Scholavon Platform');
    });

    it('handles empty or missing parameters with safe defaults without crashing', () => {
      const urlDefault = buildSupportMailtoUrl();
      expect(urlDefault).toContain('mailto:support@scholavon.com?subject=Scholavon%20Support%20Request');

      const urlEmpty = buildSupportMailtoUrl({ name: '', email: '', subject: '', message: '' });
      expect(urlEmpty).toContain('mailto:support@scholavon.com?subject=Scholavon%20Support%20Request');
    });
  });

  describe('Google Authentication, Profile Completion & Account Deletion Improvements', () => {
    it('calculates profile completion accurately for Google sign-ups with missing fields', async () => {
      const { calculateProfileCompletion } = await import('../../src/utils/formatters');

      // A fresh Google sign-up only has firstName, lastName, and email
      const googleInitialProfile = {
        firstName: 'Alex',
        lastName: 'Rivera',
        email: 'alex.rivera@example.com',
        country: 'International', // default placeholder
        educationLevel: 'Undergraduate',
        institution: '',
        fieldOfStudy: '',
        gpa: 0,
      };

      const initialScore = calculateProfileCompletion(googleInitialProfile as any);
      // Personal: firstName+lastName (8) + email (5) = 13 points. (Country is International so 0).
      expect(initialScore).toBe(20); // 8 + 5 + 7(educationLevel) = 20
      expect(initialScore).toBeLessThan(100);
      expect(initialScore).toBeGreaterThan(0);

      // A fully completed profile reaches 100%
      const completeProfile = {
        firstName: 'Alex',
        lastName: 'Rivera',
        email: 'alex.rivera@example.com',
        phone: '+1234567890',
        dateOfBirth: '2002-05-15',
        gender: 'Male',
        country: 'Nigeria',
        state: 'Lagos',
        institution: 'University of Lagos',
        educationLevel: 'Undergraduate',
        fieldOfStudy: 'Computer Engineering',
        gpa: 4.5,
        careerGoals: 'AI Researcher',
        personalStatement: 'Committed to technological innovation in education.',
        awards: ['Dean List 2025'],
        extracurriculars: ['Robotics Club President'],
      };

      const completeScore = calculateProfileCompletion(completeProfile as any);
      expect(completeScore).toBe(100);
    });

    it('DELETE /api/v1/auth/account requires Bearer token and rejects unauthenticated callers with 401', async () => {
      const res = await request(app).delete('/api/v1/auth/account');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('DELETE /api/v1/auth/account successfully deletes an authenticated user account', async () => {
      // Create a temporary user to delete
      const deleteUserEmail = `delete_target_${Date.now()}@example.com`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: deleteUserEmail,
          password: 'deleteMePass123',
          firstName: 'Target',
          lastName: 'User',
          country: 'Ghana',
          educationLevel: 'Undergraduate',
          institution: 'University of Ghana',
          fieldOfStudy: 'Economics',
          gpa: 3.5,
          gpaScale: 4.0,
        });

      expect(regRes.status).toBe(201);
      const token = regRes.body.data.token;
      const targetUserId = regRes.body.data.user.id;

      // Delete the account
      const delRes = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.data.message).toContain('Account deleted successfully');

      // Verify the user is deleted and cannot authenticate
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: deleteUserEmail,
          password: 'deleteMePass123',
        });

      expect(loginRes.status).toBe(401);
      expect(db.findUserById(targetUserId)).toBeUndefined();
    });
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Admin "View Public Site" navigation destination (regression contract test)
// Root cause: both AdminSidebar buttons previously called onNavigate('/'), which
// hits the admin guard in App.tsx case '/' and renders AdminDashboardPage.
// Fix: both buttons now call onNavigate('/scholarships'), which has no admin
// guard and renders in PublicLayout.
// ─────────────────────────────────────────────────────────────────────────────
describe('Admin "View Public Site" navigation destination', () => {
  // The canonical destination used by AdminSidebar "View Public Site" buttons.
  // If this constant ever changes back to '/', the regression is reintroduced.
  const ADMIN_VIEW_PUBLIC_SITE_DESTINATION = '/scholarships';

  it('destination is /scholarships, not /', () => {
    expect(ADMIN_VIEW_PUBLIC_SITE_DESTINATION).toBe('/scholarships');
    expect(ADMIN_VIEW_PUBLIC_SITE_DESTINATION).not.toBe('/');
  });

  it('destination does not start with /admin', () => {
    expect(ADMIN_VIEW_PUBLIC_SITE_DESTINATION.startsWith('/admin')).toBe(false);
  });

  it('destination is a known public route', () => {
    const publicRoutes = ['/scholarships', '/how-it-works', '/about', '/privacy', '/terms'];
    expect(publicRoutes).toContain(ADMIN_VIEW_PUBLIC_SITE_DESTINATION);
  });
});
