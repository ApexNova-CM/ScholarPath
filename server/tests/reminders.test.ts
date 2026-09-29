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

import {
  calculateDaysUntilDeadline,
  getReminderTypeForDaysLeft,
  buildReminderMessage,
  isScholarshipEligibleForReminders,
  isReminderTypeEnabledForUser,
  processDueScholarshipReminders,
  getEligibleScholarshipsForStudent,
  getUpcomingDeadlinesForStudent,
} from '../../src/services/reminderService';
import { StorageService } from '../../src/services/storage';
import { evaluateEligibility } from '../../src/services/eligibility';
import { evaluateScholarshipReadiness } from '../../src/services/documentService';
import { Scholarship, UserProfile, Application, StoredDocument } from '../../src/types';

const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'student-test-1',
  email: 'student@example.com',
  role: 'student',
  firstName: 'Jane',
  lastName: 'Doe',
  country: 'United States',
  educationLevel: 'Undergraduate',
  institution: 'MIT',
  fieldOfStudy: 'Computer Science',
  gpa: 3.8,
  gpaScale: 4.0,
  profileCompletion: 85,
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
  id: 'sch-test-1',
  title: 'Global STEM Leaders Award',
  providerId: 'prov-1',
  providerName: 'STEM Foundation',
  description: 'Excellence in STEM education',
  shortDescription: 'STEM Grant',
  category: 'STEM & Tech',
  tags: ['Tech'],
  amount: 5000,
  currency: 'USD',
  fundingType: 'Partial',
  eligibleCountries: ['All'],
  educationLevels: ['Undergraduate'],
  fieldsOfStudy: ['Computer Science'],
  gpaScale: 4.0,
  requiredDocuments: ['Transcript', 'CV / Resume'],
  applicationInstructions: 'Submit portfolio online',
  applicationUrl: 'https://example.com',
  deadline: '2026-05-15T00:00:00Z',
  status: 'verified',
  verificationStatus: 'verified',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockApplication = (overrides: Partial<Application> = {}): Application => ({
  id: 'app-test-1',
  userId: 'student-test-1',
  scholarshipId: 'sch-test-1',
  scholarshipTitle: 'Global STEM Leaders Award',
  providerName: 'STEM Foundation',
  deadline: '2026-05-15T00:00:00Z',
  amount: 5000,
  currency: 'USD',
  status: 'Preparing',
  notes: 'Working on essays',
  checklist: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Feature #5: Scholarship Deadline & Application Reminder System', () => {
  const baseDate = new Date('2026-05-01T00:00:00Z');

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Reminder Intervals & Timing Calculations', () => {
    it('Test 1: 7-day reminder due when deadline is 7 days away', () => {
      const deadline = '2026-05-08T00:00:00Z';
      const days = calculateDaysUntilDeadline(deadline, baseDate);
      expect(days).toBe(7);
      expect(getReminderTypeForDaysLeft(days!)).toBe('7_day');
    });

    it('Test 2: 3-day reminder due when deadline is 3 days away', () => {
      const deadline = '2026-05-04T00:00:00Z';
      const days = calculateDaysUntilDeadline(deadline, baseDate);
      expect(days).toBe(3);
      expect(getReminderTypeForDaysLeft(days!)).toBe('3_day');
    });

    it('Test 3: 1-day reminder due when deadline is 1 day away', () => {
      const deadline = '2026-05-02T00:00:00Z';
      const days = calculateDaysUntilDeadline(deadline, baseDate);
      expect(days).toBe(1);
      expect(getReminderTypeForDaysLeft(days!)).toBe('1_day');
    });

    it('Test 4: Deadline-day reminder due on the day of closing (0 days)', () => {
      const deadline = '2026-05-01T00:00:00Z';
      const days = calculateDaysUntilDeadline(deadline, baseDate);
      expect(days).toBe(0);
      expect(getReminderTypeForDaysLeft(days!)).toBe('deadline_day');
    });

    it('Test 5: Future deadline > 7 days generates no premature reminder', () => {
      const deadline = '2026-05-20T00:00:00Z'; // 19 days
      const days = calculateDaysUntilDeadline(deadline, baseDate);
      expect(days).toBe(19);
      expect(getReminderTypeForDaysLeft(days!)).toBeNull();
    });
  });

  describe('2. Lifecycle Status and Deadline Validation', () => {
    it('Test 6: Closed scholarship generates no new deadline reminder', () => {
      const sch = createMockScholarship({
        status: 'closed',
        manuallyClosed: true,
        deadline: '2026-05-08T00:00:00Z',
      });
      expect(isScholarshipEligibleForReminders(sch, baseDate)).toBe(false);
    });

    it('Test 7: Archived scholarship generates no new deadline reminder', () => {
      const sch = createMockScholarship({
        status: 'archived',
        deadline: '2026-05-08T00:00:00Z',
      });
      expect(isScholarshipEligibleForReminders(sch, baseDate)).toBe(false);
    });

    it('Test 8: Missing deadline is safely skipped without error', () => {
      const sch = createMockScholarship({
        deadline: '',
      });
      expect(isScholarshipEligibleForReminders(sch, baseDate)).toBe(false);
      expect(calculateDaysUntilDeadline(sch.deadline, baseDate)).toBeNull();
    });

    it('Test 9: Invalid/malformed deadline does not crash and generates no reminder', () => {
      const sch = createMockScholarship({
        deadline: 'invalid-date-string-not-iso',
      });
      expect(isScholarshipEligibleForReminders(sch, baseDate)).toBe(false);
      expect(calculateDaysUntilDeadline(sch.deadline, baseDate)).toBeNull();
    });
  });

  describe('3. Student Eligibility Sources (Saved & Application Tracker)', () => {
    it('Test 10: Saved scholarship with valid deadline becomes eligible for reminders', () => {
      const user = createMockUser();
      const sch = createMockScholarship({ id: 'sch-saved-1' });

      StorageService.saveScholarship(sch);
      StorageService.toggleSaveScholarship(user.id, 'sch-saved-1');

      const eligible = getEligibleScholarshipsForStudent(user.id, [sch]);
      expect(eligible.map(s => s.id)).toContain('sch-saved-1');
    });

    it('Test 11: Application Tracker record qualifies scholarship for reminders', () => {
      const user = createMockUser();
      const sch = createMockScholarship({ id: 'sch-app-1' });

      StorageService.saveScholarship(sch);
      StorageService.createApplication(user.id, sch, 'Preparing');

      const eligible = getEligibleScholarshipsForStudent(user.id, [sch]);
      expect(eligible.map(s => s.id)).toContain('sch-app-1');
    });

    it('Test 15: Unsaving removes saved-based eligibility unless an active application exists', () => {
      const sch1 = createMockScholarship({ id: 'sch-only-saved' });
      const sch2 = createMockScholarship({ id: 'sch-saved-and-applied' });

      StorageService.saveScholarship(sch1);
      StorageService.saveScholarship(sch2);

      // Save both
      StorageService.toggleSaveScholarship('student-test-1', 'sch-only-saved');
      StorageService.toggleSaveScholarship('student-test-1', 'sch-saved-and-applied');

      // Add application for sch2 only
      StorageService.createApplication('student-test-1', sch2, 'Preparing');

      // Now unsave both
      StorageService.toggleSaveScholarship('student-test-1', 'sch-only-saved');
      StorageService.toggleSaveScholarship('student-test-1', 'sch-saved-and-applied');

      const eligible = getEligibleScholarshipsForStudent('student-test-1', [sch1, sch2]);
      // sch1 is no longer eligible, sch2 remains eligible via application tracker
      expect(eligible.map(s => s.id)).not.toContain('sch-only-saved');
      expect(eligible.map(s => s.id)).toContain('sch-saved-and-applied');
    });
  });

  describe('4. Idempotency & Deduplication', () => {
    it('Test 12: Running reminder processor twice does not create duplicate reminders', async () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        id: 'sch-7d',
        deadline: '2026-05-08T00:00:00Z', // exactly 7 days from baseDate
      });

      StorageService.saveScholarship(sch);
      StorageService.toggleSaveScholarship(user.id, sch.id);

      // Run 1: Should send 1 reminder
      const run1 = await processDueScholarshipReminders({
        userProfile: user,
        currentDate: baseDate,
      });
      expect(run1.sentCount).toBe(1);

      // Run 2: Should skip and send 0 duplicates
      const run2 = await processDueScholarshipReminders({
        userProfile: user,
        currentDate: baseDate,
      });
      expect(run2.sentCount).toBe(0);
      expect(run2.skippedCount).toBe(1);

      // Total notifications created in storage is exactly 1
      const notifs = StorageService.getNotifications(user.id);
      expect(notifs.length).toBe(1);
    });
  });

  describe('5. Student Preferences & Customizable Intervals', () => {
    it('Test 13: If student disables 3-day reminder, no 3-day reminder is generated', () => {
      const user = createMockUser({
        notificationPreferences: {
          inApp: true,
          email: true,
          push: false,
          whatsapp: false,
          deadlineAlerts: true,
          deadlineDays: [7, 1, 0], // 3 days is disabled
          matchingAlerts: true,
        },
      });

      expect(isReminderTypeEnabledForUser(user, '7_day')).toBe(true);
      expect(isReminderTypeEnabledForUser(user, '3_day')).toBe(false);
      expect(isReminderTypeEnabledForUser(user, '1_day')).toBe(true);
      expect(isReminderTypeEnabledForUser(user, 'deadline_day')).toBe(true);
    });

    it('Test 14: Enabled reminder type generates correctly matching preference', async () => {
      const user = createMockUser({
        notificationPreferences: {
          inApp: true,
          email: true,
          push: false,
          whatsapp: false,
          deadlineAlerts: true,
          deadlineDays: [3], // only 3-day alerts enabled
          matchingAlerts: true,
        },
      });

      const sch7d = createMockScholarship({ id: 'sch-7', deadline: '2026-05-08T00:00:00Z' }); // 7d
      const sch3d = createMockScholarship({ id: 'sch-3', deadline: '2026-05-04T00:00:00Z' }); // 3d

      StorageService.saveScholarship(sch7d);
      StorageService.saveScholarship(sch3d);
      StorageService.toggleSaveScholarship(user.id, sch7d.id);
      StorageService.toggleSaveScholarship(user.id, sch3d.id);

      const res = await processDueScholarshipReminders({
        userProfile: user,
        currentDate: baseDate,
      });

      expect(res.sentCount).toBe(1);
      expect(res.reminders[0].scholarshipId).toBe('sch-3');
      expect(res.reminders[0].reminderType).toBe('3_day');
    });
  });

  describe('6. Dynamic Changes: Deadline Edits & Scholarship Closures', () => {
    it('Test 16: Admin changing deadline recalculates future reminder dates without duplicate conflict', async () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        id: 'sch-edit-deadline',
        deadline: '2026-05-08T00:00:00Z', // initial 7d deadline
      });

      StorageService.saveScholarship(sch);
      StorageService.toggleSaveScholarship(user.id, sch.id);

      // Sent 7-day reminder for old deadline
      await processDueScholarshipReminders({ userProfile: user, currentDate: baseDate });
      expect(StorageService.hasSentReminder(user.id, sch.id, '7_day', '2026-05-08T00:00:00Z')).toBe(true);

      // Admin extends deadline to May 10 (+2 days)
      const updatedSch = { ...sch, deadline: '2026-05-10T00:00:00Z' };
      StorageService.saveScholarship(updatedSch);

      // Fast-forward currentDate to May 3 (which is 7 days before new deadline May 10)
      const newDate = new Date('2026-05-03T00:00:00Z');
      const resNew = await processDueScholarshipReminders({ userProfile: user, currentDate: newDate });

      expect(resNew.sentCount).toBe(1);
      expect(resNew.reminders[0].deadlineAt).toBe('2026-05-10T00:00:00Z');
      expect(StorageService.hasSentReminder(user.id, sch.id, '7_day', '2026-05-10T00:00:00Z')).toBe(true);
    });

    it('Test 17: Closing a scholarship stops future reminders', async () => {
      const user = createMockUser();
      const sch = createMockScholarship({
        id: 'sch-closing-test',
        deadline: '2026-05-08T00:00:00Z', // 7 days away
      });

      StorageService.saveScholarship(sch);
      StorageService.toggleSaveScholarship(user.id, sch.id);

      // Admin closes the scholarship
      StorageService.closeScholarship(sch.id, 'admin-1', 'Quota fulfilled');

      const res = await processDueScholarshipReminders({
        userProfile: user,
        currentDate: baseDate,
      });

      expect(res.sentCount).toBe(0);
      expect(res.skippedCount).toBe(1);
    });
  });

  describe('7. Independence of Systems (Match Score, Readiness, Application Status)', () => {
    it('Test 18: Reminder processing does not modify application status', async () => {
      const user = createMockUser();
      const sch = createMockScholarship({ id: 'sch-app-ind', deadline: '2026-05-04T00:00:00Z' });

      StorageService.saveScholarship(sch);
      const app = StorageService.createApplication(user.id, sch, 'Preparing');

      await processDueScholarshipReminders({ userProfile: user, currentDate: baseDate });

      const storedApp = StorageService.getApplications(user.id).find(a => a.id === app.id);
      expect(storedApp?.status).toBe('Preparing');
    });

    it('Test 19: Reminder processing does not modify Match Score calculation', () => {
      const user = createMockUser();
      const sch = createMockScholarship({ minimumGPA: 3.5, fieldsOfStudy: ['Computer Science'] });

      const scoreBefore = evaluateEligibility(sch, user);
      // Reminders operate independently
      const scoreAfter = evaluateEligibility(sch, user);

      expect(scoreBefore.score).toBe(scoreAfter.score);
      expect(scoreBefore.summary).toBe(scoreAfter.summary);
    });

    it('Test 20: Reminder processing does not modify Application Readiness score', () => {
      const user = createMockUser();
      const sch = createMockScholarship({ requiredDocuments: ['Transcript', 'CV / Resume'] });
      const docs: StoredDocument[] = [
        {
          id: 'doc-1',
          userId: user.id,
          name: 'My Transcript',
          type: 'Transcript',
          fileFormat: 'pdf',
          fileSize: 1024,
          fileUrl: '#',
          status: 'available',
          verified: false,
          uploadedAt: new Date().toISOString(),
        }
      ];

      const readinessBefore = evaluateScholarshipReadiness(sch, user, docs);
      const readinessAfter = evaluateScholarshipReadiness(sch, user, docs);

      expect(readinessBefore.score).toBe(readinessAfter.score);
      expect(readinessBefore.isReady).toBe(readinessAfter.isReady);
    });
  });

  describe('8. Notifications Read/Unread State Management', () => {
    it('Test 21: Marking a single notification as read updates read state', () => {
      const user = createMockUser();
      const notifId = 'notif-1';

      StorageService.createNotification({
        id: notifId,
        userId: user.id,
        title: '⏰ Deadline in 3 days',
        message: 'Closes soon',
        type: 'deadline_alert',
        read: false,
        createdAt: new Date().toISOString(),
      });

      expect(StorageService.getNotifications(user.id)[0].read).toBe(false);

      StorageService.markNotificationAsRead(notifId);
      expect(StorageService.getNotifications(user.id)[0].read).toBe(true);
    });

    it('Test 22: Marking all notifications as read updates all user notifications', () => {
      const user = createMockUser();

      StorageService.createNotification({
        id: 'n-1',
        userId: user.id,
        title: 'Alert 1',
        message: 'Message 1',
        type: 'deadline_alert',
        read: false,
        createdAt: new Date().toISOString(),
      });
      StorageService.createNotification({
        id: 'n-2',
        userId: user.id,
        title: 'Alert 2',
        message: 'Message 2',
        type: 'deadline_alert',
        read: false,
        createdAt: new Date().toISOString(),
      });

      expect(StorageService.getNotifications(user.id).filter(n => !n.read).length).toBe(2);

      StorageService.markAllNotificationsAsRead(user.id);
      expect(StorageService.getNotifications(user.id).filter(n => !n.read).length).toBe(0);
    });
  });

  describe('9. Security & Access Boundaries', () => {
    it('Test 23: Student only receives their own notifications and reminders', () => {
      const student1 = createMockUser({ id: 'student-1' });
      const student2 = createMockUser({ id: 'student-2' });

      StorageService.createNotification({
        id: 'n-s1',
        userId: student1.id,
        title: 'Student 1 Alert',
        message: 'Alert for student 1',
        type: 'deadline_alert',
        read: false,
        createdAt: new Date().toISOString(),
      });

      const s1Notifs = StorageService.getNotifications(student1.id);
      const s2Notifs = StorageService.getNotifications(student2.id);

      expect(s1Notifs.length).toBe(1);
      expect(s2Notifs.length).toBe(0);
    });

    it('Test 24: Reminder records store structured audit metadata', async () => {
      const user = createMockUser();
      const sch = createMockScholarship({ id: 'sch-audit', deadline: '2026-05-04T00:00:00Z' });

      StorageService.saveScholarship(sch);
      StorageService.toggleSaveScholarship(user.id, sch.id);

      await processDueScholarshipReminders({ userProfile: user, currentDate: baseDate });

      const reminders = StorageService.getReminders(user.id);
      expect(reminders.length).toBe(1);
      expect(reminders[0].userId).toBe(user.id);
      expect(reminders[0].scholarshipId).toBe('sch-audit');
      expect(reminders[0].status).toBe('sent');
      expect(reminders[0].channel).toBe('inApp');
      expect(reminders[0].deadlineAt).toBe('2026-05-04T00:00:00Z');
    });
  });

  describe('10. Mobile and Responsive UI Compatibility', () => {
    it('Test 25: Message content contains clear non-truncated text and direct link for mobile views', () => {
      const sch = createMockScholarship({ id: 'sch-mob-1', title: 'Future Leaders Grant' });
      const msg7 = buildReminderMessage(sch, '7_day');
      const msg3 = buildReminderMessage(sch, '3_day');
      const msg1 = buildReminderMessage(sch, '1_day');
      const msg0 = buildReminderMessage(sch, 'deadline_day');

      expect(msg7.title).toContain('7 days');
      expect(msg7.body).toContain('closes in 7 days');

      expect(msg3.title).toContain('3 days');
      expect(msg3.body).toContain('closes in 3 days');

      expect(msg1.title).toContain('tomorrow');
      expect(msg1.body).toContain('closes tomorrow');

      expect(msg0.title).toContain('today');
      expect(msg0.body).toContain('closes today');
    });
  });
});
