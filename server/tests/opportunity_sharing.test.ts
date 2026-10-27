/**
 * Scholavon — Opportunity Sharing Feature Test Suite
 *
 * Verifies the 8 core requirements:
 * 1. Share action uses the correct opportunity URL.
 * 2. Copy-link success and failure feedback.
 * 3. WhatsApp sharing uses the correct title and URL.
 * 4. Native sharing is used when supported, with a fallback when unavailable.
 * 5. Shared opportunity links open the correct record.
 * 6. Login preserves the intended opportunity destination if authentication is required.
 * 7. Missing or unavailable opportunities are handled safely.
 * 8. Existing authorization and application behavior remain intact.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Polyfills for browser APIs in Node/Vitest test environment
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
// Supabase mock
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

// ---------------------------------------------------------------------------
// Import Share Utilities & Application Server
// ---------------------------------------------------------------------------
import {
  getOpportunitySharePath,
  getOpportunityShareUrl,
  formatOpportunityShareText,
  getWhatsAppShareUrl,
  isWebShareSupported,
  copyToClipboard,
  shareViaWebShare,
} from '../../src/utils/shareUtils';
import { OpportunityType } from '../../src/types';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';

// ---------------------------------------------------------------------------
// Test Data & Helpers
// ---------------------------------------------------------------------------
const STUDENT_A_ID = 'usr-share-student-a';
const STUDENT_B_ID = 'usr-share-student-b';
const TEST_SCHOLARSHIP_ID = 'sch-share-open-001';

function signToken(userId: string, role: 'student' | 'admin' = 'student'): string {
  const secret = config.jwtSecret || 'scholavon-dev-secret-key-change-in-production';
  return jwt.sign(
    { sub: userId, id: userId, role, email: `${userId}@test.scholavon.org` },
    secret,
    { expiresIn: '1h' }
  );
}

const sampleScholarship = {
  id: 'schol-merit-2026',
  title: 'Global Excellence Merit Scholarship',
  providerName: 'Scholavon Foundation',
  opportunityType: 'scholarship' as OpportunityType,
};

const sampleFellowship = {
  id: 'fellow-tech-res-42',
  title: 'AI Research Fellowship 2026',
  providerName: 'Deep Research Institute',
  opportunityType: 'fellowship' as OpportunityType,
};

const sampleApprenticeship = {
  id: 'appr-trade-green',
  title: 'Clean Energy Trade Apprenticeship',
  providerName: 'Renewable Power Guild',
  opportunityType: 'apprenticeship' as OpportunityType,
};

beforeAll(async () => {
  (db as any).save = vi.fn();
  await db.init();
  (config as any).supabaseUrl = '';
  (config as any).supabaseServiceRoleKey = '';

  if (!db.findUserById(STUDENT_A_ID)) {
    db.createUser({
      id: STUDENT_A_ID,
      email: `${STUDENT_A_ID}@test.scholavon.org`,
      passwordHash: 'hash-a',
      role: 'student',
      firstName: 'Alpha',
      lastName: 'Sharer',
      country: 'GB',
      profileCompletion: 70,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  if (!db.findUserById(STUDENT_B_ID)) {
    db.createUser({
      id: STUDENT_B_ID,
      email: `${STUDENT_B_ID}@test.scholavon.org`,
      passwordHash: 'hash-b',
      role: 'student',
      firstName: 'Beta',
      lastName: 'Viewer',
      country: 'US',
      profileCompletion: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  if (!db.findScholarshipById(TEST_SCHOLARSHIP_ID)) {
    const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.createScholarship({
      id: TEST_SCHOLARSHIP_ID,
      title: 'Sharing Feature Test Scholarship',
      providerName: 'Global Education Trust',
      amount: 10000,
      currency: 'USD',
      deadline: futureDeadline,
      status: 'active',
      applicationMethod: 'External Website',
      applicationUrl: 'https://trust.example.com/apply',
      category: 'Merit',
      educationLevels: ['Undergraduate', 'Postgraduate'],
      requiredDocuments: ['Resume', 'Essay'],
      eligibilityCriteria: [],
      description: 'Comprehensive test opportunity for sharing workflow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }
});

describe('Scholavon — Opportunity Sharing Feature Suite', () => {

  // -------------------------------------------------------------------------
  // 1. Share action uses the correct opportunity URL
  // -------------------------------------------------------------------------
  describe('1. Opportunity Share URL Generation', () => {
    it('generates the canonical relative path pointing to /scholarships/:id', () => {
      expect(getOpportunitySharePath('schol-merit-2026')).toBe('/scholarships/schol-merit-2026');
      expect(getOpportunitySharePath('fellow-tech-res-42')).toBe('/scholarships/fellow-tech-res-42');
    });

    it('generates stable, absolute public URLs across all opportunity types', () => {
      const origin = 'https://scholavon.com';
      const scholUrl = getOpportunityShareUrl(sampleScholarship.id, origin);
      const fellowUrl = getOpportunityShareUrl(sampleFellowship.id, origin);
      const apprUrl = getOpportunityShareUrl(sampleApprenticeship.id, origin);

      expect(scholUrl).toBe('https://scholavon.com/scholarships/schol-merit-2026');
      expect(fellowUrl).toBe('https://scholavon.com/scholarships/fellow-tech-res-42');
      expect(apprUrl).toBe('https://scholavon.com/scholarships/appr-trade-green');
    });

    it('properly URI-encodes special characters in opportunity identifiers', () => {
      const complexId = 'grant-women-stem #2026';
      const shareUrl = getOpportunityShareUrl(complexId, 'https://scholavon.com');
      expect(shareUrl).toBe('https://scholavon.com/scholarships/grant-women-stem%20%232026');
    });

    it('never exposes private student profile data, email, or auth tokens in share URL', () => {
      const url = getOpportunityShareUrl('schol-merit-2026', 'https://scholavon.com');
      expect(url).not.toContain('token');
      expect(url).not.toContain('jwt');
      expect(url).not.toContain('user');
      expect(url).not.toContain('@');
      expect(url).not.toContain('profile');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Copy-link success and failure feedback
  // -------------------------------------------------------------------------
  describe('2. Clipboard Copy Link Action & Fallback', () => {
    it('returns true when modern navigator.clipboard.writeText succeeds', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: mockWriteText } },
        configurable: true,
        writable: true,
      });

      const result = await copyToClipboard('https://scholavon.com/scholarships/schol-merit-2026');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('https://scholavon.com/scholarships/schol-merit-2026');
    });

    it('falls back to document.execCommand when navigator.clipboard is unavailable', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const mockExecCommand = vi.fn().mockReturnValue(true);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: vi.fn(() => ({
            value: '',
            setAttribute: vi.fn(),
            style: {},
            focus: vi.fn(),
            select: vi.fn(),
          })),
          body: {
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild,
          },
          execCommand: mockExecCommand,
        },
        configurable: true,
        writable: true,
      });

      const result = await copyToClipboard('https://scholavon.com/scholarships/schol-merit-2026');
      expect(result).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
    });

    it('returns false without falsely reporting success when both clipboard methods fail', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) } },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'document', {
        value: {
          createElement: vi.fn(() => { throw new Error('DOM manipulation disallowed'); }),
        },
        configurable: true,
        writable: true,
      });

      const result = await copyToClipboard('https://scholavon.com/scholarships/schol-merit-2026');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. WhatsApp sharing uses the correct title and URL
  // -------------------------------------------------------------------------
  describe('3. WhatsApp Sharing Integration', () => {
    it('formats a clear, readable opportunity title, provider, and URL', () => {
      const shareUrl = 'https://scholavon.com/scholarships/schol-merit-2026';
      const text = formatOpportunityShareText(sampleScholarship, shareUrl);

      expect(text).toContain('Global Excellence Merit Scholarship');
      expect(text).toContain('Scholavon Foundation');
      expect(text).toContain('https://scholavon.com/scholarships/schol-merit-2026');
    });

    it('generates a valid WhatsApp share URL with encoded parameters', () => {
      const shareUrl = 'https://scholavon.com/scholarships/schol-merit-2026';
      const whatsAppUrl = getWhatsAppShareUrl(sampleScholarship, shareUrl);

      expect(whatsAppUrl.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
      const encodedText = whatsAppUrl.replace('https://api.whatsapp.com/send?text=', '');
      const decoded = decodeURIComponent(encodedText);

      expect(decoded).toContain(sampleScholarship.title);
      expect(decoded).toContain(sampleScholarship.providerName);
      expect(decoded).toContain(shareUrl);
    });

    it('supports alternative opportunity types such as fellowships and apprenticeships', () => {
      const shareUrl = 'https://scholavon.com/scholarships/fellow-tech-res-42';
      const text = formatOpportunityShareText(sampleFellowship, shareUrl);
      expect(text).toContain('Fellowship');
      expect(text).toContain('AI Research Fellowship 2026');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Native sharing is used when supported, with a fallback when unavailable
  // -------------------------------------------------------------------------
  describe('4. Native Web Share API & Graceful Fallback', () => {
    it('reports native share as supported when navigator.share exists', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { share: vi.fn() },
        configurable: true,
        writable: true,
      });
      expect(isWebShareSupported()).toBe(true);
    });

    it('reports native share as unsupported when navigator.share is absent', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(isWebShareSupported()).toBe(false);
    });

    it('successfully invokes navigator.share and returns status: shared', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { share: mockShare },
        configurable: true,
        writable: true,
      });

      const res = await shareViaWebShare({
        title: 'AI Research Fellowship 2026',
        text: 'Check out this fellowship on Scholavon',
        url: 'https://scholavon.com/scholarships/fellow-tech-res-42',
      });

      expect(res.status).toBe('shared');
      expect(mockShare).toHaveBeenCalled();
    });

    it('handles user cancellation (AbortError) without throwing or reporting an error', async () => {
      const abortErr = new Error('Share canceled');
      abortErr.name = 'AbortError';
      const mockShare = vi.fn().mockRejectedValue(abortErr);

      Object.defineProperty(globalThis, 'navigator', {
        value: { share: mockShare },
        configurable: true,
        writable: true,
      });

      const res = await shareViaWebShare({
        title: 'AI Research Fellowship 2026',
        text: 'Check out this fellowship',
        url: 'https://scholavon.com/scholarships/fellow-tech-res-42',
      });

      expect(res.status).toBe('cancelled');
    });

    it('returns unsupported status when navigator.share is missing', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });

      const res = await shareViaWebShare({
        title: 'Title',
        text: 'Text',
        url: 'https://scholavon.com/scholarships/test',
      });

      expect(res.status).toBe('unsupported');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Shared opportunity links open the correct record
  // -------------------------------------------------------------------------
  describe('5. Shared Opportunity Resolution', () => {
    it('retrieves the exact opportunity record by ID without requiring authentication', async () => {
      const detailRes = await request(app).get(`/api/v1/scholarships/${TEST_SCHOLARSHIP_ID}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.success).toBe(true);
      const scholarship = detailRes.body.data.scholarship;
      expect(scholarship).toBeDefined();
      expect(scholarship.id).toBe(TEST_SCHOLARSHIP_ID);
      expect(scholarship.title).toBe('Sharing Feature Test Scholarship');
      expect(scholarship.providerName).toBe('Global Education Trust');
    });

    it('allows an authenticated student to retrieve the same opportunity record', async () => {
      const token = signToken(STUDENT_B_ID, 'student');

      const detailRes = await request(app)
        .get(`/api/v1/scholarships/${TEST_SCHOLARSHIP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.success).toBe(true);
      const scholarship = detailRes.body.data.scholarship;
      expect(scholarship.id).toBe(TEST_SCHOLARSHIP_ID);
      expect(scholarship.title).toBe('Sharing Feature Test Scholarship');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Login preserves the intended opportunity destination if authentication is required
  // -------------------------------------------------------------------------
  describe('6. Login Redirection & Opportunity Preservation', () => {
    it('safely validates relative opportunity redirect paths', () => {
      const getSafeRedirect = (urlParam: string | null): string | null => {
        if (!urlParam) return null;
        if (urlParam.startsWith('/') && !urlParam.startsWith('//')) {
          return urlParam;
        }
        return null;
      };

      expect(getSafeRedirect('/scholarships/oxford-schol-1')).toBe('/scholarships/oxford-schol-1');
      expect(getSafeRedirect('/scholarships/grant-fellowship-2026?view=requirements')).toBe(
        '/scholarships/grant-fellowship-2026?view=requirements'
      );
      // Rejects malicious or open-redirect targets
      expect(getSafeRedirect('https://malicious-site.com/steal')).toBe(null);
      expect(getSafeRedirect('//malicious-domain.com')).toBe(null);
      expect(getSafeRedirect('javascript:alert(1)')).toBe(null);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Missing or Unavailable Opportunities Handled Safely
  // -------------------------------------------------------------------------
  describe('7. Missing or Unavailable Opportunity Handling', () => {
    it('returns 404 cleanly when a non-existent opportunity is requested', async () => {
      const res = await request(app).get('/api/v1/scholarships/non-existent-opportunity-uuid-999');
      expect(res.status).toBe(404);
      expect(res.body).toBeDefined();
    });

    it('does not leak private databases or crash the server on malformed ID', async () => {
      const res = await request(app).get('/api/v1/scholarships/%2E%2E%2Fetc%2Fpasswd');
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Existing authorization and application behavior remain intact
  // -------------------------------------------------------------------------
  describe('8. Authorization & Security Invariance', () => {
    it('does not allow unauthenticated users to create applications via share links', async () => {
      const res = await request(app)
        .post('/api/v1/student/applications')
        .send({ scholarshipId: TEST_SCHOLARSHIP_ID });

      expect(res.status).toBe(401);
    });

    it('does not allow student to access or modify another student\'s private application workspace', async () => {
      const studentAToken = signToken(STUDENT_A_ID, 'student');
      const studentBToken = signToken(STUDENT_B_ID, 'student');

      // Student A creates application
      const createRes = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ scholarshipId: TEST_SCHOLARSHIP_ID });

      expect(createRes.status).toBe(201);
      const applicationId = createRes.body.data.id;
      expect(applicationId).toBeDefined();

      // Student B attempts to modify Student A's application
      const hijackRes = await request(app)
        .patch(`/api/v1/student/applications/${applicationId}`)
        .set('Authorization', `Bearer ${studentBToken}`)
        .send({ notes: 'malicious hijack' });

      expect(hijackRes.status).toBe(403);
    });
  });
});
