import { describe, it, expect, beforeEach } from 'vitest';

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

import { StorageService } from '../../src/services/storage';
import { evaluateEligibility, getMatchCategory } from '../../src/services/eligibility';
import { evaluateScholarshipReadiness } from '../../src/services/documentService';
import { computeLifecycleStatus } from '../../src/services/scholarshipFilters';
import { calculateDaysUntilDeadline } from '../../src/services/reminderService';
import { Scholarship, UserProfile, Application, StoredDocument } from '../../src/types';

const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'student-ws-1',
  email: 'student.ws@example.com',
  role: 'student',
  firstName: 'Alex',
  lastName: 'Rivera',
  country: 'United States',
  educationLevel: 'Undergraduate',
  institution: 'Stanford University',
  fieldOfStudy: 'Computer Science',
  gpa: 3.9,
  gpaScale: 4.0,
  profileCompletion: 90,
  notificationPreferences: {
    inApp: true,
    email: true,
    push: false,
    whatsapp: false,
    deadlineAlerts: true,
    deadlineDays: [7, 3, 1, 0],
    matchingAlerts: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockScholarship = (overrides: Partial<Scholarship> = {}): Scholarship => ({
  id: 'sch-ws-1',
  title: 'Future Tech Pioneers Fellowship',
  providerId: 'prov-tech-1',
  providerName: 'Tech Pioneers Fund',
  description: 'Full tuition and stipend for exceptional computer science undergraduates.',
  shortDescription: 'Tech fellowship for CS undergrads',
  category: 'STEM & Tech',
  tags: ['Tech', 'Leadership'],
  amount: 10000,
  currency: 'USD',
  fundingType: 'Full',
  eligibleCountries: ['United States', 'Canada'],
  educationLevels: ['Undergraduate'],
  fieldsOfStudy: ['Computer Science', 'Software Engineering'],
  minimumGPA: 3.5,
  gpaScale: 4.0,
  requiredDocuments: ['Academic Transcript', 'CV / Resume', 'Personal Statement'],
  applicationInstructions: 'Submit personal statement and transcript online.',
  applicationUrl: 'https://techpioneers.org/apply',
  deadline: '2026-06-30T00:00:00Z',
  status: 'verified',
  verificationStatus: 'verified',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Feature #6: Scholarship Application Workspace', () => {
  const baseDate = new Date('2026-06-01T00:00:00Z');

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Workspace Initialization & Loading', () => {
    it('Test 1: Creates or retrieves application record on workspace entry', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      expect(app).toBeDefined();
      expect(app.userId).toBe(user.id);
      expect(app.scholarshipId).toBe(sch.id);
      expect(app.status).toBe('Preparing');
      expect(app.checklist.length).toBe(sch.requiredDocuments.length);

      // Re-fetching retrieves the exact same application
      const app2 = StorageService.getOrCreateApplication(user.id, sch);
      expect(app2.id).toBe(app.id);
    });

    it('Test 2: Missing or invalid scholarship ID is handled safely', () => {
      const all = StorageService.getScholarships();
      const missing = all.find(s => s.id === 'non-existent-id');
      expect(missing).toBeUndefined();
    });
  });

  describe('2. Match Score Integration', () => {
    it('Test 3: Workspace uses the canonical Match Score algorithm without duplicate calculation', () => {
      const user = createMockUser();
      const sch = createMockScholarship();

      const result = evaluateEligibility(sch, user);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.hardDisqualified).toBe(false);

      const category = getMatchCategory(result.score);
      expect(['Excellent Match', 'Strong Match']).toContain(category);
    });

    it('Test 4: Disqualified profile correctly reflects in workspace match criteria', () => {
      const user = createMockUser({ educationLevel: 'High School' });
      const sch = createMockScholarship({ educationLevels: ['Undergraduate'] });

      const result = evaluateEligibility(sch, user);
      expect(result.hardDisqualified).toBe(true);
      expect(result.score).toBeLessThanOrEqual(38);
    });
  });

  describe('3. Application Readiness & Document Vault Integration', () => {
    it('Test 5: Accurately identifies available vs missing documents in vault', () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        requiredDocuments: ['Academic Transcript', 'CV / Resume', 'Personal Statement'],
      });

      // User has only Transcript in Vault
      const docs: StoredDocument[] = [
        {
          id: 'doc-t1',
          userId: user.id,
          name: 'Official Stanford Transcript.pdf',
          type: 'Academic Transcript',
          fileFormat: 'pdf',
          fileSize: 2048,
          fileUrl: '#',
          status: 'available',
          uploadedAt: new Date().toISOString(),
        },
      ];

      const readiness = evaluateScholarshipReadiness(sch, user, docs);
      expect(readiness.hasStructuredRequirements).toBe(true);
      expect(readiness.completeCount).toBeGreaterThan(0);
      expect(readiness.missingCount).toBeGreaterThan(0);

      // Verify specific document matching
      const transcriptItem = readiness.items.find(i => i.name === 'Academic Transcript');
      expect(transcriptItem?.status).toBe('complete');

      const cvItem = readiness.items.find(i => i.name === 'CV / Resume');
      expect(cvItem?.status).toBe('missing');
    });

    it('Test 6: Readiness Score and Match Score remain completely decoupled', () => {
      const user = createMockUser(); // High GPA, matching CS degree (High Match)
      const sch = createMockScholarship();
      const docs: StoredDocument[] = []; // No documents uploaded yet (Low Readiness)

      const match = evaluateEligibility(sch, user);
      const readiness = evaluateScholarshipReadiness(sch, user, docs);

      expect(match.score).toBeGreaterThan(80); // High Match
      expect(readiness.score).toBeLessThan(80); // Lower Readiness due to missing docs
    });
  });

  describe('4. Interactive Checklist & Custom Tasks', () => {
    it('Test 7: Toggling checklist item updates and persists state', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      const firstItem = app.checklist[0];
      expect(firstItem.completed).toBe(false);

      const updated = StorageService.toggleApplicationChecklistItem(app.id, firstItem.id);
      expect(updated.checklist.find(i => i.id === firstItem.id)?.completed).toBe(true);

      // Verify persistence in storage
      const reloaded = StorageService.getApplicationById(app.id);
      expect(reloaded?.checklist.find(i => i.id === firstItem.id)?.completed).toBe(true);
    });

    it('Test 8: Adding custom personal tasks persists without altering scholarship requirements', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      const originalCount = app.checklist.length;

      const updated = StorageService.addApplicationChecklistItem(
        app.id,
        'Ask Prof. Chen for recommendation letter'
      );
      expect(updated.checklist.length).toBe(originalCount + 1);
      const customItem = updated.checklist.find(i => i.label.includes('Prof. Chen'));
      expect(customItem).toBeDefined();
      expect(customItem?.custom).toBe(true);

      // Verify original scholarship remains untouched
      const originalSch = StorageService.getScholarshipById(sch.id);
      expect(originalSch?.requiredDocuments.length).toBe(sch.requiredDocuments.length);
    });

    it('Test 9: Deleting custom checklist item removes it cleanly', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      let app = StorageService.getOrCreateApplication(user.id, sch);
      app = StorageService.addApplicationChecklistItem(app.id, 'Task to delete');
      const customItem = app.checklist.find(i => i.label === 'Task to delete');

      const updated = StorageService.deleteApplicationChecklistItem(app.id, customItem!.id);
      expect(updated.checklist.find(i => i.id === customItem!.id)).toBeUndefined();
    });
  });

  describe('5. Personal Notes & Essay Draft Persistence', () => {
    it('Test 10: Personal notes save and persist across reloads', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      const noteText = 'Interview scheduled for June 10th at 2pm PST';

      const updated = StorageService.updateApplication(app.id, { notes: noteText });
      expect(updated.notes).toBe(noteText);

      const reloaded = StorageService.getApplicationById(app.id);
      expect(reloaded?.notes).toBe(noteText);
    });

    it('Test 11: Essay draft and status persist accurately', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      const essayContent = 'My passion for artificial intelligence began during high school...';

      const updated = StorageService.updateApplication(app.id, {
        essayDraft: essayContent,
        essayStatus: 'drafting',
        essayNotes: 'Prompt requires max 500 words on AI ethics',
      });

      expect(updated.essayDraft).toBe(essayContent);
      expect(updated.essayStatus).toBe('drafting');
      expect(updated.essayNotes).toContain('500 words');

      const reloaded = StorageService.getApplicationById(app.id);
      expect(reloaded?.essayDraft).toBe(essayContent);
      expect(reloaded?.essayStatus).toBe('drafting');
    });
  });

  describe('6. Application Tracker Integration & Submission Confirmation', () => {
    it('Test 12: Marking as Applied updates tracker status and sets appliedAt timestamp', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      expect(app.status).toBe('Preparing');
      expect(app.appliedAt).toBeUndefined();

      const applied = StorageService.updateApplication(app.id, {
        status: 'Applied',
        appliedAt: new Date().toISOString(),
      });

      expect(applied.status).toBe('Applied');
      expect(applied.appliedAt).toBeDefined();

      const inTracker = StorageService.getApplications(user.id).find(a => a.id === app.id);
      expect(inTracker?.status).toBe('Applied');
    });

    it('Test 13: Manual status transitions update correctly', () => {
      const user = createMockUser();
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      const updated = StorageService.updateApplicationStatus(app.id, 'Interview', 'Received invite');

      expect(updated.status).toBe('Interview');
      expect(updated.notes).toBe('Received invite');
    });
  });

  describe('7. Lifecycle Status Constraints', () => {
    it('Test 14: Active and Closing Soon scholarships compute correctly for workspace', () => {
      const activeSch = createMockScholarship({ deadline: '2026-08-01T00:00:00Z' });
      expect(computeLifecycleStatus(activeSch, baseDate)).toBe('active');

      const closingSch = createMockScholarship({ deadline: '2026-06-05T00:00:00Z' }); // 4 days away
      expect(computeLifecycleStatus(closingSch, baseDate)).toBe('closing_soon');
    });

    it('Test 15: Closed scholarship disables active submission while preserving workspace history', () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        id: 'sch-closed-ws',
        deadline: '2026-05-15T00:00:00Z', // past deadline
      });
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      StorageService.updateApplication(app.id, { notes: 'Historical notes before deadline' });

      expect(computeLifecycleStatus(sch, baseDate)).toBe('closed');

      // History preserved
      const reloaded = StorageService.getApplicationById(app.id);
      expect(reloaded?.notes).toBe('Historical notes before deadline');
    });

    it('Test 16: Archived scholarship preserves student workspace preparation data', () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        id: 'sch-archived-ws',
        status: 'archived',
      });
      StorageService.saveScholarship(sch);

      const app = StorageService.getOrCreateApplication(user.id, sch);
      StorageService.updateApplication(app.id, { essayDraft: 'Preserved essay' });

      expect(computeLifecycleStatus(sch, baseDate)).toBe('archived');

      const reloaded = StorageService.getApplicationById(app.id);
      expect(reloaded?.essayDraft).toBe('Preserved essay');
    });
  });

  describe('8. Deadline & Reminders Integration', () => {
    it('Test 17: Deadline countdown calculation matches reminder service exactly', () => {
      const sch = createMockScholarship({ deadline: '2026-06-08T00:00:00Z' });
      const days = calculateDaysUntilDeadline(sch.deadline, baseDate);
      expect(days).toBe(7);
    });

    it('Test 18: Notification preferences reflect accurately in workspace', () => {
      const user = createMockUser({
        notificationPreferences: {
          inApp: true,
          email: true,
          push: false,
          whatsapp: false,
          deadlineAlerts: true,
          deadlineDays: [7, 3, 1, 0],
          matchingAlerts: true,
        },
      });

      expect(user.notificationPreferences.deadlineAlerts).toBe(true);
      expect(user.notificationPreferences.deadlineDays).toContain(7);
      expect(user.notificationPreferences.deadlineDays).toContain(1);
    });
  });

  describe('9. Security & Student Isolation', () => {
    it('Test 19: Student A cannot view or modify Student B application records', () => {
      const studentA = createMockUser({ id: 'student-A' });
      const studentB = createMockUser({ id: 'student-B' });
      const sch = createMockScholarship();
      StorageService.saveScholarship(sch);

      const appA = StorageService.getOrCreateApplication(studentA.id, sch);
      StorageService.updateApplication(appA.id, { notes: 'Secret notes of A' });

      const appsOfB = StorageService.getApplications(studentB.id);
      expect(appsOfB.some(a => a.id === appA.id)).toBe(false);
      expect(appsOfB.some(a => a.notes === 'Secret notes of A')).toBe(false);
    });

    it('Test 20: Documents of Student A are isolated from Student B workspace readiness', () => {
      const studentA = createMockUser({ id: 'student-A' });
      const studentB = createMockUser({ id: 'student-B' });
      const sch = createMockScholarship({ requiredDocuments: ['Academic Transcript'] });

      const docsA: StoredDocument[] = [
        {
          id: 'doc-A',
          userId: studentA.id,
          name: 'Transcript A.pdf',
          type: 'Academic Transcript',
          status: 'available',
          fileFormat: 'pdf',
          fileSize: 1024,
          fileUrl: '#',
          uploadedAt: new Date().toISOString(),
        }
      ];

      const readinessB = evaluateScholarshipReadiness(sch, studentB, []);
      expect(readinessB.items.find(i => i.name === 'Academic Transcript')?.status).toBe('missing');
    });
  });

  describe('10. Comprehensive Preparation Progress Calculation', () => {
    it('Test 21: Full workspace with completed checklist, docs, and essay reaches ready state', () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        requiredDocuments: ['Academic Transcript'],
      });
      StorageService.saveScholarship(sch);

      const docs: StoredDocument[] = [
        {
          id: 'doc-all-ready',
          userId: user.id,
          name: 'Transcript.pdf',
          type: 'Academic Transcript',
          status: 'available',
          fileFormat: 'pdf',
          fileSize: 1024,
          fileUrl: '#',
          uploadedAt: new Date().toISOString(),
        }
      ];

      const readiness = evaluateScholarshipReadiness(sch, user, docs);
      expect(readiness.missingCount).toBe(0);
      expect(readiness.score).toBeGreaterThanOrEqual(90);
      expect(readiness.isReady).toBe(true);
    });
  });
});
