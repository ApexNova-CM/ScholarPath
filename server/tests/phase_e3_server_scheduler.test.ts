import { describe, it, expect, beforeAll, beforeEach, vi, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { emailService } from '../src/services/emailService';
import {
  getMsUntilNextTargetUtcHour,
  processDueRemindersForUser,
  processAllStudentReminders,
  startReminderScheduler,
  stopReminderScheduler,
  isReminderSchedulerActive,
} from '../src/services/reminderScheduler';

describe('Phase E3: Server-Side Reminder Scheduler Suite', () => {
  let freeStudentId = '';
  const freeStudentEmail = `e3_free_${Date.now()}@test.scholavon.org`;

  let plusStudentId = '';
  const plusStudentEmail = `e3_plus_${Date.now()}@test.scholavon.org`;

  let optOutStudentId = '';
  const optOutStudentEmail = `e3_optout_${Date.now()}@test.scholavon.org`;

  let completedAppStudentId = '';
  const completedAppStudentEmail = `e3_completed_${Date.now()}@test.scholavon.org`;

  const baseScholarshipId = 'sch-e3-test';

  beforeAll(async () => {
    await db.init();

    // 1. Free Student (defaults: 7d, 1d)
    const freeRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: freeStudentEmail,
        password: 'Password123!',
        firstName: 'Fiona',
        lastName: 'Free',
        country: 'Ghana',
        educationLevel: 'Undergraduate',
        institution: 'University of Ghana',
        fieldOfStudy: 'Computer Science',
        gpa: 3.7,
        gpaScale: 4.0,
      });
    freeStudentId = freeRes.body.data.user.id;

    // 2. Plus Student (intervals: 30d, 14d, 7d, 3d, 1d, 0d)
    const plusRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: plusStudentEmail,
        password: 'Password123!',
        firstName: 'Peter',
        lastName: 'Plus',
        country: 'Nigeria',
        educationLevel: 'Undergraduate',
        institution: 'University of Lagos',
        fieldOfStudy: 'Data Science',
        gpa: 3.9,
        gpaScale: 4.0,
      });
    plusStudentId = plusRes.body.data.user.id;
    // Set plus subscription in user store
    db.updateUser(plusStudentId, { subscriptionStatus: 'premium' } as any);

    // 3. Opt-out student (deadlineAlerts disabled)
    const optRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: optOutStudentEmail,
        password: 'Password123!',
        firstName: 'Oliver',
        lastName: 'OptOut',
        country: 'Kenya',
        educationLevel: 'Undergraduate',
        institution: 'University of Nairobi',
        fieldOfStudy: 'Economics',
        gpa: 3.6,
        gpaScale: 4.0,
      });
    optOutStudentId = optRes.body.data.user.id;
    const optProfile = db.getProfile(optOutStudentId);
    if (optProfile) {
      db.upsertProfile({
        ...optProfile,
        notificationPreferences: {
          ...optProfile.notificationPreferences,
          deadlineAlerts: false, // completely opt out of reminders
        },
      });
    }

    // 4. Completed Application student
    const completedRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: completedAppStudentEmail,
        password: 'Password123!',
        firstName: 'Chloe',
        lastName: 'Complete',
        country: 'Rwanda',
        educationLevel: 'Undergraduate',
        institution: 'University of Rwanda',
        fieldOfStudy: 'Civil Engineering',
        gpa: 3.8,
        gpaScale: 4.0,
      });
    completedAppStudentId = completedRes.body.data.user.id;
  });

  afterAll(() => {
    stopReminderScheduler();
  });

  // --- 1. Target UTC hour calculation ---
  describe('Scheduler timing & target hour calculation', () => {
    it('calculates correct milliseconds when current time is before 08:00 UTC', () => {
      // 03:00 UTC on 2026-10-27
      const morningTime = new Date(Date.UTC(2026, 9, 27, 3, 0, 0));
      const ms = getMsUntilNextTargetUtcHour(8, morningTime);
      const fiveHoursInMs = 5 * 60 * 60 * 1000;
      expect(ms).toBe(fiveHoursInMs);
    });

    it('calculates correct milliseconds when current time is after 08:00 UTC (schedules tomorrow)', () => {
      // 12:00 UTC on 2026-10-27
      const afternoonTime = new Date(Date.UTC(2026, 9, 27, 12, 0, 0));
      const ms = getMsUntilNextTargetUtcHour(8, afternoonTime);
      const twentyHoursInMs = 20 * 60 * 60 * 1000;
      expect(ms).toBe(twentyHoursInMs);
    });

    it('activates and deactivates gracefully via startReminderScheduler and stopReminderScheduler', () => {
      expect(isReminderSchedulerActive()).toBe(false);
      startReminderScheduler({ targetHourUtc: 8 });
      expect(isReminderSchedulerActive()).toBe(true);

      // Multiple start calls are idempotent
      startReminderScheduler({ targetHourUtc: 8 });
      expect(isReminderSchedulerActive()).toBe(true);

      stopReminderScheduler();
      expect(isReminderSchedulerActive()).toBe(false);
    });
  });

  // --- 2. Plan Intervals (Free vs Plus) ---
  describe('Plan interval enforcement', () => {
    it('sends 7-day reminder to Free student, but suppresses 14-day reminder', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder').mockResolvedValue({
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: 'Accepted by test provider',
        messageId: 'msg-test-free-7d',
      });

      const sch7dId = `${baseScholarshipId}-free-7d`;
      const sch14dId = `${baseScholarshipId}-free-14d`;

      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline7d = new Date(Date.UTC(2026, 10, 3, 8, 0, 0)).toISOString(); // exactly 7 days
      const deadline14d = new Date(Date.UTC(2026, 10, 10, 8, 0, 0)).toISOString(); // exactly 14 days

      db.createScholarship({
        id: sch7dId,
        title: 'Free 7-Day Target Grant',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Grant',
        fundingType: 'Partial',
        amount: 5000,
        currency: 'USD',
        deadline: deadline7d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.createScholarship({
        id: sch14dId,
        title: 'Free 14-Day Target Grant',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Grant',
        fundingType: 'Partial',
        amount: 5000,
        currency: 'USD',
        deadline: deadline14d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Student saves both scholarships
      db.toggleSaved(freeStudentId, sch7dId);
      db.toggleSaved(freeStudentId, sch14dId);

      // Process reminders for Free student
      const result = await processDueRemindersForUser(freeStudentId, simDate);

      // Free student should only receive the 7-day reminder, NOT the 14-day reminder
      expect(result.sentCount).toBe(1);
      expect(result.reminders[0].scholarshipId).toBe(sch7dId);
      expect(result.reminders[0].reminderType).toBe('7_day');
      expect(sendSpy).toHaveBeenCalledWith(
        freeStudentEmail,
        'Fiona',
        'Free 7-Day Target Grant',
        7,
        deadline7d,
        sch7dId,
        undefined,
        '7_day'
      );

      sendSpy.mockRestore();
    });

    it('sends 14-day reminder to Plus student', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder').mockResolvedValue({
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: 'Accepted by test provider',
        messageId: 'msg-test-plus-14d',
      });

      const schPlus14dId = `${baseScholarshipId}-plus-14d`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline14d = new Date(Date.UTC(2026, 10, 10, 8, 0, 0)).toISOString(); // 14 days

      db.createScholarship({
        id: schPlus14dId,
        title: 'Plus 14-Day Fellowship',
        providerId: 'p1',
        providerName: 'Plus Foundation',
        category: 'Fellowship',
        fundingType: 'Full',
        amount: 20000,
        currency: 'USD',
        deadline: deadline14d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.toggleSaved(plusStudentId, schPlus14dId);

      const result = await processDueRemindersForUser(plusStudentId, simDate);

      expect(result.sentCount).toBe(1);
      expect(result.reminders[0].scholarshipId).toBe(schPlus14dId);
      expect(result.reminders[0].reminderType).toBe('14_day');
      expect(sendSpy).toHaveBeenCalledWith(
        plusStudentEmail,
        'Peter',
        'Plus 14-Day Fellowship',
        14,
        deadline14d,
        schPlus14dId,
        undefined,
        '14_day'
      );

      sendSpy.mockRestore();
    });
  });

  // --- 3. Preference & Opt-out enforcement ---
  describe('Notification preference enforcement', () => {
    it('completely suppresses reminders when deadlineAlerts is false', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder').mockResolvedValue({
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: 'Accepted by test provider',
        messageId: 'msg-test-optout',
      });

      const schOptId = `${baseScholarshipId}-optout-7d`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline7d = new Date(Date.UTC(2026, 10, 3, 8, 0, 0)).toISOString();

      db.createScholarship({
        id: schOptId,
        title: 'Opt-Out Student Scholarship',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Scholarship',
        fundingType: 'Full',
        amount: 10000,
        currency: 'USD',
        deadline: deadline7d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.toggleSaved(optOutStudentId, schOptId);

      const result = await processDueRemindersForUser(optOutStudentId, simDate);

      expect(result.sentCount).toBe(0);
      expect(result.skippedReason).toBe('deadline_alerts_disabled');
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('creates in-app reminder but suppresses email when email preference is false', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder').mockResolvedValue({
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: 'Accepted by test provider',
        messageId: 'msg-test-inapp-only',
      });

      // Update Free student to disable email notifications specifically
      const profile = db.getProfile(freeStudentId);
      db.upsertProfile({
        ...profile!,
        notificationPreferences: {
          ...profile!.notificationPreferences,
          email: false,
          deadlineAlerts: true,
        },
      });

      const sch1dId = `${baseScholarshipId}-free-1d`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline1d = new Date(Date.UTC(2026, 9, 28, 8, 0, 0)).toISOString(); // 1 day

      db.createScholarship({
        id: sch1dId,
        title: 'Tomorrow Deadline Grant',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Grant',
        fundingType: 'Full',
        amount: 7000,
        currency: 'USD',
        deadline: deadline1d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.toggleSaved(freeStudentId, sch1dId);

      const result = await processDueRemindersForUser(freeStudentId, simDate);

      // In-app reminder generated, but email suppressed
      expect(result.inAppCount).toBe(1);
      expect(result.emailCount).toBe(0);
      expect(sendSpy).not.toHaveBeenCalled();

      // Restore email preference
      db.upsertProfile({
        ...profile!,
        notificationPreferences: {
          ...profile!.notificationPreferences,
          email: true,
        },
      });

      sendSpy.mockRestore();
    });
  });

  // --- 4. Completed applications & Expired scholarships suppression ---
  describe('Suppression of completed applications and expired opportunities', () => {
    it('suppresses reminders for applications with status Applied, Awarded, Withdrawn, etc.', async () => {
      const schCompletedId = `${baseScholarshipId}-completed-app`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline7d = new Date(Date.UTC(2026, 10, 3, 8, 0, 0)).toISOString();

      db.createScholarship({
        id: schCompletedId,
        title: 'Completed Application Grant',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Grant',
        fundingType: 'Full',
        amount: 8000,
        currency: 'USD',
        deadline: deadline7d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create an application marked as 'Applied'
      db.createApplication({
        id: `app-completed-${Date.now()}`,
        userId: completedAppStudentId,
        scholarshipId: schCompletedId,
        scholarshipTitle: 'Completed Application Grant',
        providerName: 'Test Foundation',
        deadline: deadline7d,
        amount: 8000,
        currency: 'USD',
        status: 'Applied',
        submissionMethod: 'native',
        submissionStage: 'submitted',
        notes: '',
        checklist: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await processDueRemindersForUser(completedAppStudentId, simDate);
      expect(result.sentCount).toBe(0);
    });

    it('suppresses reminders for past/expired deadlines (daysLeft < 0)', async () => {
      const schExpiredId = `${baseScholarshipId}-expired`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const pastDeadline = new Date(Date.UTC(2026, 9, 20, 8, 0, 0)).toISOString(); // 7 days in past

      db.createScholarship({
        id: schExpiredId,
        title: 'Expired Past Grant',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Grant',
        fundingType: 'Full',
        amount: 5000,
        currency: 'USD',
        deadline: pastDeadline,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.toggleSaved(plusStudentId, schExpiredId);

      const result = await processDueRemindersForUser(plusStudentId, simDate);
      const expiredReminder = result.reminders.find((r) => r.scholarshipId === schExpiredId);
      expect(expiredReminder).toBeUndefined();
    });
  });

  // --- 5. Batch processing & Deduplication ---
  describe('Batch processing & Deduplication', () => {
    it('executes processAllStudentReminders unattended for all students', async () => {
      vi.spyOn(emailService, 'sendDeadlineReminder').mockResolvedValue({
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: 'Accepted by test provider',
        messageId: 'msg-batch-ok',
      });

      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const summary = await processAllStudentReminders(simDate);

      expect(summary.totalStudents).toBeGreaterThan(0);
      expect(summary.processedStudents).toBeGreaterThan(0);
      expect(Array.isArray(summary.errors)).toBe(true);

      // Second identical run must deduplicate and send 0 new reminders
      const deduplicatedSummary = await processAllStudentReminders(simDate);
      expect(deduplicatedSummary.sentInAppCount).toBe(0);
      expect(deduplicatedSummary.sentEmailCount).toBe(0);
    });
  });

  // --- 6. Concurrency lock & Error resilience ---
  describe('Concurrency protection and failure resilience', () => {
    it('handles transient email service error without aborting execution', async () => {
      // Simulate transient email failure
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder').mockRejectedValueOnce(
        new Error('Network timeout connecting to mail provider')
      );

      const schErrorTestId = `${baseScholarshipId}-error-resilience`;
      const simDate = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
      const deadline7d = new Date(Date.UTC(2026, 10, 3, 8, 0, 0)).toISOString();

      db.createScholarship({
        id: schErrorTestId,
        title: 'Error Handling Resilience Scholarship',
        providerId: 'p1',
        providerName: 'Test Foundation',
        category: 'Scholarship',
        fundingType: 'Full',
        amount: 10000,
        currency: 'USD',
        deadline: deadline7d,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['High School', 'Undergraduate', 'Postgraduate (Masters)', 'Doctorate (PhD)', 'Vocational / Technical', 'Postdoctoral'],
        fieldsOfStudy: ['All'],
        tags: [],
        description: 'Test scholarship description',
        shortDescription: 'Test scholarship',
        gpaScale: 4,
        requiredDocuments: [],
        applicationInstructions: 'Follow the official application instructions.',
        applicationUrl: 'https://example.org/apply',
        viewCount: 0,
        saveCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.toggleSaved(plusStudentId, schErrorTestId);

      // Must not throw exception
      const result = await processDueRemindersForUser(plusStudentId, simDate);

      // In-app alert was recorded
      expect(result.inAppCount).toBeGreaterThan(0);
      // Error was safely captured in operational error log without leaking secrets
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to send deadline email');
      expect(result.errors[0]).not.toContain('Password');
      expect(result.errors[0]).not.toContain(plusStudentEmail); // sanitized

      sendSpy.mockRestore();
    });

    it('REST endpoint POST /api/v1/student/reminders/process delegates to processDueRemindersForUser', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: plusStudentEmail, password: 'Password123!' });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .post('/api/v1/student/reminders/process')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentDate: '2026-10-27T08:00:00.000Z' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('processedCount');
      expect(res.body.data).toHaveProperty('sentCount');
      expect(res.body.data).toHaveProperty('reminders');
    });
  });
});
