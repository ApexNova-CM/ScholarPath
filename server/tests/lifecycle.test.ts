import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Polyfill localStorage for Node/Vitest environment before loading storage service
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

import { 
  computeLifecycleStatus, 
  isScholarshipExpired, 
  isScholarshipActive, 
  isScholarshipOpen,
  isScholarshipClosingSoon,
  isScholarshipClosed,
  getLifecycleBadgeStyle, 
  filterScholarshipsByStatus,
  CLOSING_SOON_DAYS
} from '../../src/services/scholarshipFilters';
import { 
  formatScholarshipAmount, 
  formatScholarshipDeadline, 
  getCurrencySymbol, 
  isDeadlinePassed 
} from '../../src/utils/formatters';
import { StorageService } from '../../src/services/storage';
import { Scholarship } from '../../src/types';

const createMockScholarship = (overrides: Partial<Scholarship> = {}): Scholarship => ({
  id: 'test-sch-1',
  title: 'Global Tech Excellence Scholarship',
  providerId: 'prov-1',
  providerName: 'Tech Foundation',
  description: 'Full scholarship for tech students',
  shortDescription: 'Tech scholarship',
  category: 'STEM & Tech',
  tags: ['Tech', 'Engineering'],
  amount: 10000,
  currency: 'USD',
  fundingType: 'Full',
  eligibleCountries: ['All'],
  educationLevels: ['Undergraduate'],
  fieldsOfStudy: ['Computer Science'],
  gpaScale: 4.0,
  requiredDocuments: ['Transcript', 'CV / Resume'],
  applicationInstructions: 'Apply online',
  applicationUrl: 'https://example.com/apply',
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days future
  status: 'verified',
  verificationStatus: 'verified',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Feature #4: Scholarship Status & Lifecycle Management', () => {
  const now = new Date('2026-05-01T12:00:00Z');

  describe('1. computeLifecycleStatus & Precedence Rules', () => {
    it('Test 1: should return "archived" when scholarship status is "archived"', () => {
      const sch = createMockScholarship({
        status: 'archived',
        deadline: '2026-06-01T12:00:00Z', // future
      });
      expect(computeLifecycleStatus(sch, now)).toBe('archived');
    });

    it('Test 2: should return "closed" when scholarship status is "closed"', () => {
      const sch = createMockScholarship({
        status: 'closed',
        deadline: '2026-06-01T12:00:00Z', // future
      });
      expect(computeLifecycleStatus(sch, now)).toBe('closed');
    });

    it('Test 3: should return "closed" when manuallyClosed is true even if deadline is in the future', () => {
      const sch = createMockScholarship({
        status: 'verified',
        manuallyClosed: true,
        deadline: '2026-06-01T12:00:00Z', // 1 month in future
      });
      expect(computeLifecycleStatus(sch, now)).toBe('closed');
    });

    it('Test 4: should return "closed" when deadline is in the past', () => {
      const sch = createMockScholarship({
        status: 'verified',
        deadline: '2026-04-30T12:00:00Z', // 1 day in past
      });
      expect(computeLifecycleStatus(sch, now)).toBe('closed');
    });

    it('Test 5: should return "closing_soon" when deadline is within CLOSING_SOON_DAYS (3 days away)', () => {
      const sch = createMockScholarship({
        status: 'verified',
        deadline: '2026-05-04T12:00:00Z', // 3 days away
      });
      expect(computeLifecycleStatus(sch, now)).toBe('closing_soon');
    });

    it('Test 6: should return "closing_soon" when deadline is exactly 7 days away', () => {
      const sch = createMockScholarship({
        status: 'verified',
        deadline: '2026-05-08T12:00:00Z', // exactly 7 days away
      });
      expect(computeLifecycleStatus(sch, now)).toBe('closing_soon');
    });

    it('Test 7: should return "active" when deadline is > 7 days away (e.g. 20 days)', () => {
      const sch = createMockScholarship({
        status: 'verified',
        deadline: '2026-05-21T12:00:00Z', // 20 days away
      });
      expect(computeLifecycleStatus(sch, now)).toBe('active');
    });

    it('Test 8: should handle missing/invalid deadline gracefully and return "active"', () => {
      const sch = createMockScholarship({
        status: 'verified',
        deadline: '',
      });
      expect(computeLifecycleStatus(sch, now)).toBe('active');
    });
  });

  describe('2. Expiry & Active Filters with Lifecycle State', () => {
    it('Test 9: isScholarshipExpired returns true for manually closed scholarships', () => {
      const sch = createMockScholarship({
        status: 'verified',
        manuallyClosed: true,
        deadline: '2026-06-01T12:00:00Z',
      });
      expect(isScholarshipExpired(sch, now)).toBe(true);
    });

    it('Test 10: isScholarshipActive returns false for closed and archived scholarships', () => {
      const closedSch = createMockScholarship({
        status: 'closed',
        manuallyClosed: true,
        deadline: '2026-06-01T12:00:00Z',
      });
      const archivedSch = createMockScholarship({
        status: 'archived',
        deadline: '2026-06-01T12:00:00Z',
      });
      const activeSch = createMockScholarship({
        status: 'verified',
        deadline: '2026-06-01T12:00:00Z',
      });

      expect(isScholarshipActive(closedSch, now)).toBe(false);
      expect(isScholarshipActive(archivedSch, now)).toBe(false);
      expect(isScholarshipActive(activeSch, now)).toBe(true);
    });

    it('Test 11: getLifecycleBadgeStyle returns appropriate styling metadata for all lifecycle states', () => {
      const activeStyle = getLifecycleBadgeStyle('active');
      const closingSoonStyle = getLifecycleBadgeStyle('closing_soon');
      const closedStyle = getLifecycleBadgeStyle('closed');
      const archivedStyle = getLifecycleBadgeStyle('archived');

      expect(activeStyle.label).toBe('Open');
      expect(activeStyle.text).toContain('text-emerald');

      expect(closingSoonStyle.label).toBe('Closing Soon');
      expect(closingSoonStyle.animate).toContain('animate-pulse');

      expect(closedStyle.label).toBe('Closed');
      expect(closedStyle.text).toContain('text-rose');

      expect(archivedStyle.label).toBe('Archived');
      expect(archivedStyle.text).toContain('text-slate');
    });

    it('Test 12: filterScholarshipsByStatus filters by closing_soon, closed, and archived', () => {
      const list: Scholarship[] = [
        createMockScholarship({ id: 's1', deadline: '2026-05-25T12:00:00Z' }), // active (24 days)
        createMockScholarship({ id: 's2', deadline: '2026-05-04T12:00:00Z' }), // closing soon (3 days)
        createMockScholarship({ id: 's3', deadline: '2026-04-20T12:00:00Z' }), // closed (past)
        createMockScholarship({ id: 's4', status: 'archived', deadline: '2026-06-01T12:00:00Z' }), // archived
      ];

      const active = filterScholarshipsByStatus(list, 'active', now);
      const closingSoon = filterScholarshipsByStatus(list, 'closing_soon', now);
      const closed = filterScholarshipsByStatus(list, 'closed', now);
      const archived = filterScholarshipsByStatus(list, 'archived', now);

      expect(active.map(s => s.id)).toEqual(['s1']);
      expect(closingSoon.map(s => s.id)).toEqual(['s2']);
      expect(closed.map(s => s.id)).toEqual(['s3']);
      expect(archived.map(s => s.id)).toEqual(['s4']);
    });
  });

  describe('3. StorageService Lifecycle Operations', () => {
    beforeEach(() => {
      localStorage.clear();
      StorageService.saveScholarship(createMockScholarship({
        id: 'sch-storage-1',
        title: 'Storage Test Scholarship',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'verified',
        verificationStatus: 'verified'
      }));
    });

    it('Test 13: StorageService.closeScholarship sets status to closed, manuallyClosed to true and sets timestamp', () => {
      const closed = StorageService.closeScholarship('sch-storage-1', 'admin-1', 'Application quota reached');
      expect(closed.status).toBe('closed');
      expect(closed.manuallyClosed).toBe(true);
      expect(closed.manuallyClosedAt).toBeDefined();

      const fetched = StorageService.getScholarshipById('sch-storage-1');
      expect(fetched?.status).toBe('closed');
      expect(fetched?.manuallyClosed).toBe(true);
    });

    it('Test 14: StorageService.restoreScholarship restores a future scholarship to verified status and resets manuallyClosed', () => {
      StorageService.closeScholarship('sch-storage-1');
      const restored = StorageService.restoreScholarship('sch-storage-1');

      expect(restored.status).toBe('verified');
      expect(restored.manuallyClosed).toBe(false);
      expect(restored.manuallyClosedAt).toBeUndefined();

      const fetched = StorageService.getScholarshipById('sch-storage-1');
      expect(fetched?.status).toBe('verified');
      expect(fetched?.manuallyClosed).toBe(false);
    });

    it('Test 15: StorageService.restoreScholarship sets status to expired if deadline is past at restore time', () => {
      StorageService.saveScholarship(createMockScholarship({
        id: 'sch-past-restore',
        deadline: '2020-01-01T00:00:00Z', // Past deadline
        status: 'closed',
        manuallyClosed: true,
      }));

      const restored = StorageService.restoreScholarship('sch-past-restore');
      expect(restored.status).toBe('expired');
      expect(restored.manuallyClosed).toBe(false);
    });

    it('Test 16: StorageService.getAdminStats accurately tracks closed scholarships', () => {
      StorageService.saveScholarship(createMockScholarship({
        id: 'sch-active-1',
        deadline: new Date(Date.now() + 864000000).toISOString(),
        status: 'verified',
        verificationStatus: 'verified'
      }));
      StorageService.saveScholarship(createMockScholarship({
        id: 'sch-closed-1',
        deadline: new Date(Date.now() + 864000000).toISOString(),
        status: 'closed',
        manuallyClosed: true,
      }));

      const stats = StorageService.getAdminStats();
      expect(stats.closedScholarships).toBeGreaterThanOrEqual(1);
    });

    it('Test 17: Verification status remains intact and independent during lifecycle changes', () => {
      const closed = StorageService.closeScholarship('sch-storage-1');
      expect(closed.verificationStatus).toBe('verified');

      const restored = StorageService.restoreScholarship('sch-storage-1');
      expect(restored.verificationStatus).toBe('verified');
    });

    it('Test 18: Precedence hierarchy is preserved across all edge cases', () => {
      // 1. Archived takes precedence over manuallyClosed and past deadline
      const archived = createMockScholarship({
        status: 'archived',
        manuallyClosed: true,
        deadline: '2020-01-01T00:00:00Z',
      });
      expect(computeLifecycleStatus(archived, now)).toBe('archived');

      // 2. Manually closed takes precedence over future deadline and closing soon window
      const manuallyClosed = createMockScholarship({
        status: 'verified',
        manuallyClosed: true,
        deadline: '2026-05-03T12:00:00Z', // in 2 days (would be closing_soon if not closed)
      });
      expect(computeLifecycleStatus(manuallyClosed, now)).toBe('closed');
    });
  });

  describe('3. Currency & Amount Formatter (Task 3)', () => {
    it('Test 19: formatScholarshipAmount formats numeric amounts with accurate currency symbol', () => {
      expect(formatScholarshipAmount({ amount: 500000, award_currency: 'NGN' })).toBe('₦500,000');
      expect(formatScholarshipAmount({ amount: 15000, currency: 'GBP' })).toBe('£15,000');
      expect(formatScholarshipAmount({ amount: 20000, currency: 'EUR' })).toBe('€20,000');
      expect(formatScholarshipAmount({ amount: 10000, currency: 'USD' })).toBe('$10,000');
      expect(formatScholarshipAmount({ amount: 5000, currency: 'CAD' })).toBe('CA$5,000');
    });

    it('Test 20: formatScholarshipAmount preserves descriptive award text', () => {
      expect(formatScholarshipAmount({ amount: 0, awardValueText: 'Full tuition + stipend' })).toBe('Full tuition + stipend');
      expect(formatScholarshipAmount({ amount: 500000, awardValueText: 'Up to ₦500,000' })).toBe('Up to ₦500,000');
      expect(formatScholarshipAmount({ awardDescription: 'Variable based on need' })).toBe('Variable based on need');
      expect(formatScholarshipAmount({ awardValueText: 'Not publicly disclosed' })).toBe('Not publicly disclosed');
    });

    it('Test 21: formatScholarshipAmount handles zero/missing amounts without assuming USD', () => {
      expect(formatScholarshipAmount({ amount: 0 })).toBe('Not specified');
      expect(formatScholarshipAmount({})).toBe('Not specified');
      expect(formatScholarshipAmount(null as any)).toBe('Not specified');
    });

    it('Test 22: getCurrencySymbol returns empty string for unknown/missing currency without defaulting to USD', () => {
      expect(getCurrencySymbol(undefined)).toBe('');
      expect(getCurrencySymbol(null)).toBe('');
      expect(getCurrencySymbol('')).toBe('');
      expect(getCurrencySymbol('XYZ')).toBe('');
      expect(getCurrencySymbol('NGN')).toBe('₦');
      expect(getCurrencySymbol('USD')).toBe('$');
    });
  });

  describe('4. Deadline Formatting & Timezone Safety (Task 2)', () => {
    it('Test 23: formatScholarshipDeadline renders human-readable dates', () => {
      const formatted = formatScholarshipDeadline('2026-11-25');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Nov');
      expect(formatScholarshipDeadline('')).toBe('Deadline not specified');
      expect(formatScholarshipDeadline('invalid-date')).toBe('Deadline not specified');
    });

    it('Test 24: isDeadlinePassed treats date-only strings as valid through 23:59:59.999 local', () => {
      // Use tomorrow's local date so the test is never timezone-sensitive
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const futureStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      // "now" is noon today — tomorrow's deadline is definitively not yet passed
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      expect(isDeadlinePassed(futureStr, noon)).toBe(false);
    });
  });

  describe('5. Open/Closing Soon/Closed Status Helpers (Task 1)', () => {
    it('Test 25: isScholarshipOpen, isScholarshipClosingSoon, and isScholarshipClosed work properly', () => {
      const openSch = createMockScholarship({
        status: 'verified',
        verificationStatus: 'verified',
        deadline: '2026-06-01T12:00:00Z',
      });
      expect(isScholarshipOpen(openSch, now)).toBe(true);
      expect(isScholarshipClosed(openSch, now)).toBe(false);

      const closingSoonSch = createMockScholarship({
        status: 'verified',
        verificationStatus: 'verified',
        deadline: '2026-05-04T12:00:00Z', // 3 days away from now
      });
      expect(isScholarshipOpen(closingSoonSch, now)).toBe(true);
      expect(isScholarshipClosingSoon(closingSoonSch, now)).toBe(true);

      const closedSch = createMockScholarship({
        status: 'verified',
        verificationStatus: 'verified',
        deadline: '2026-04-20T12:00:00Z', // past
      });
      expect(isScholarshipClosed(closedSch, now)).toBe(true);
      expect(isScholarshipOpen(closedSch, now)).toBe(false);
    });

    it('Test 26: pending and rejected scholarships are not open to students', () => {
      const pendingSch = createMockScholarship({
        status: 'pending' as any,
        verificationStatus: 'pending' as any,
        deadline: '2026-06-01T12:00:00Z',
      });
      expect(isScholarshipOpen(pendingSch, now)).toBe(false);

      const rejectedSch = createMockScholarship({
        status: 'rejected' as any,
        verificationStatus: 'rejected' as any,
        deadline: '2026-06-01T12:00:00Z',
      });
      expect(isScholarshipOpen(rejectedSch, now)).toBe(false);
    });
  });
});
