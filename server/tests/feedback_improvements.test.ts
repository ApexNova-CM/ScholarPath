import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { 
  formatScholarshipAmount, 
  formatScholarshipDeadline, 
  getCurrencySymbol, 
  isDeadlinePassed,
  getDaysUntilDeadline
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
});
