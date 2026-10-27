import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { emailService } from '../src/services/emailService';

describe('Phase E2: Application Event Emails & Deadline Reminders Suite', () => {
  let studentToken = '';
  let studentId = '';
  const studentEmail = `phase_e2_student_${Date.now()}@test.scholavon.org`;

  let optOutToken = '';
  let optOutId = '';
  const optOutEmail = `phase_e2_optout_${Date.now()}@test.scholavon.org`;

  const testScholarshipId = 'sch-phase-e2-test';
  const testScholarshipTitle = 'Merit Leadership Fellowship 2026';
  const testProviderName = 'Global Education Initiative';
  const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days in future

  beforeAll(async () => {
    await db.init();

    // Create a mock active scholarship with a known future deadline (7 days)
    db.createScholarship({
      id: testScholarshipId,
      title: testScholarshipTitle,
      providerId: 'prov-001',
      providerName: testProviderName,
      description: 'Prestigious fellowship for international students.',
      shortDescription: 'Fellowship award.',
      category: 'Fellowship',
      tags: ['Leadership', 'Fellowship'],
      fundingType: 'Full',
      amount: 15000,
      currency: 'USD',
      deadline: futureDeadline,
      status: 'verified',
      verificationStatus: 'verified',
      eligibleCountries: ['All'],
      educationLevels: ['Undergraduate'],
      fieldsOfStudy: ['All'],
      gpaScale: 4.0,
      applicationUrl: 'https://example.com/apply',
      applicationInstructions: 'Apply via portal',
      viewCount: 10,
      saveCount: 5,
      requiredDocuments: ['Resume', 'Transcript'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Register student with default email notifications (opted-in)
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password: 'Password123!',
        firstName: 'Marcus',
        lastName: 'Vance',
        country: 'Canada',
        educationLevel: 'Undergraduate',
        institution: 'University of Toronto',
        fieldOfStudy: 'Computer Engineering',
        gpa: 3.9,
        gpaScale: 4.0,
      });

    studentToken = regRes.body.data.token;
    studentId = regRes.body.data.user.id;

    // 2. Register student with email notifications opted OUT
    const optRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: optOutEmail,
        password: 'Password123!',
        firstName: 'NoEmail',
        lastName: 'Student',
        country: 'Canada',
        educationLevel: 'Undergraduate',
      });

    optOutToken = optRes.body.data.token;
    optOutId = optRes.body.data.user.id;

    // Explicitly set notification preferences email: false for optOut user
    const optProfile = db.getProfile(optOutId);
    if (optProfile) {
      db.upsertProfile({
        ...optProfile,
        notificationPreferences: {
          inApp: true,
          email: false,
          deadlineAlerts: true,
          matchingAlerts: false,
        },
      });
    }
  });

  describe('1. Application Started Event Email Dispatch', () => {
    it('dispatches application started email with correct opportunity details when user is opted in', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStarted');

      const res = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          scholarshipId: testScholarshipId,
          notes: 'Preparing recommendation letters',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify emailService was invoked with expected parameters
      expect(sendSpy).toHaveBeenCalledWith(
        studentEmail,
        'Marcus',
        testScholarshipTitle,
        futureDeadline,
        res.body.data.id,
        testProviderName
      );

      sendSpy.mockRestore();
    });

    it('suppresses application started email when student email preference is false', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStarted');

      const res = await request(app)
        .post('/api/v1/student/applications')
        .set('Authorization', `Bearer ${optOutToken}`)
        .send({
          scholarshipId: testScholarshipId,
          notes: 'Opt-out student application',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify email was NOT sent
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });
  });

  describe('2. Meaningful Application Status Change Events', () => {
    let testAppId = '';

    beforeAll(async () => {
      const apps = db.getApplicationsByUser(studentId);
      testAppId = apps[0].id;
    });

    it('dispatches status change email when status changes from Preparing to Applied', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStatusChange');

      const res = await request(app)
        .patch(`/api/v1/student/applications/${testAppId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          status: 'Applied',
          submissionMethod: 'external',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Applied');

      expect(sendSpy).toHaveBeenCalledWith(
        studentEmail,
        'Marcus',
        testScholarshipTitle,
        'Preparing',
        'Applied',
        testAppId,
        testProviderName
      );

      sendSpy.mockRestore();
    });

    it('does NOT send status change email on draft autosaves (notes, essayDraft, workspaceLastSavedAt)', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStatusChange');

      const res = await request(app)
        .patch(`/api/v1/student/applications/${testAppId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          notes: 'Updated my essay outline draft',
          essayDraft: 'Draft paragraph 1...',
          workspaceLastSavedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify no status change email was sent
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('does NOT send status change email when status in request matches existing status', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStatusChange');

      const res = await request(app)
        .patch(`/api/v1/student/applications/${testAppId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          status: 'Applied', // same as current
          notes: 'Still applied',
        });

      expect(res.status).toBe(200);
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('does NOT send email on checklist toggles via PUT /applications/:id/checklist', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendApplicationStatusChange');

      const res = await request(app)
        .put(`/api/v1/student/applications/${testAppId}/checklist`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          checklist: [
            { id: 'chk-1', label: 'Resume', completed: true, required: true },
          ],
        });

      expect(res.status).toBe(200);
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });
  });

  describe('3. Deadline Reminders & Business Rule Suppression', () => {
    const activeSchId = 'sch-active-rem-7d';
    const completedSchId = 'sch-completed-rem-7d';
    const expiredSchId = 'sch-expired-rem';

    beforeAll(async () => {
      // 1. Active scholarship due in exactly 7 days
      db.createScholarship({
        id: activeSchId,
        title: 'Active Opportunity Due in 7 Days',
        providerId: 'prov-002',
        providerName: 'STEM Trust',
        description: 'Award for undergraduate researchers.',
        shortDescription: 'Research grant.',
        category: 'Grant',
        tags: ['STEM'],
        fundingType: 'Full',
        deadline: futureDeadline,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['All'],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationUrl: 'https://example.com',
        applicationInstructions: 'Apply now',
        viewCount: 1,
        saveCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Student starts application in Preparing status
      db.createApplication({
        id: 'app-active-rem-test',
        userId: studentId,
        scholarshipId: activeSchId,
        scholarshipTitle: 'Active Opportunity Due in 7 Days',
        providerName: 'STEM Trust',
        deadline: futureDeadline,
        amount: 5000,
        currency: 'USD',
        status: 'Preparing',
        notes: '',
        checklist: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Scholarship for which the student has ALREADY APPLIED (completed)
      db.createScholarship({
        id: completedSchId,
        title: 'Completed Opportunity Due in 7 Days',
        providerId: 'prov-003',
        providerName: 'Arts Council',
        description: 'Arts scholarship.',
        shortDescription: 'Arts scholarship.',
        category: 'Scholarship',
        tags: ['Arts'],
        fundingType: 'Partial',
        deadline: futureDeadline,
        status: 'verified',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['All'],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationUrl: 'https://example.com',
        applicationInstructions: 'Apply now',
        viewCount: 1,
        saveCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.createApplication({
        id: 'app-completed-rem-test',
        userId: studentId,
        scholarshipId: completedSchId,
        scholarshipTitle: 'Completed Opportunity Due in 7 Days',
        providerName: 'Arts Council',
        deadline: futureDeadline,
        amount: 2500,
        currency: 'USD',
        status: 'Applied', // Already applied!
        notes: '',
        checklist: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 3. Expired scholarship (in the past)
      db.createScholarship({
        id: expiredSchId,
        title: 'Expired Opportunity Last Week',
        providerId: 'prov-004',
        providerName: 'Past Foundation',
        description: 'Past grant.',
        shortDescription: 'Past grant.',
        category: 'Grant',
        tags: ['Past'],
        fundingType: 'Full',
        deadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'expired',
        verificationStatus: 'verified',
        eligibleCountries: ['All'],
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['All'],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationUrl: 'https://example.com',
        applicationInstructions: 'Closed',
        viewCount: 1,
        saveCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.toggleSaved(studentId, expiredSchId);
    });

    it('sends reminder for active Preparing application approaching 7-day deadline', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder');

      const res = await request(app)
        .post('/api/v1/student/reminders/process')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentDate: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Must have triggered a reminder for the active scholarship
      expect(sendSpy).toHaveBeenCalledWith(
        studentEmail,
        'Marcus',
        'Active Opportunity Due in 7 Days',
        7,
        futureDeadline,
        activeSchId,
        'app-active-rem-test',
        '7_day'
      );

      sendSpy.mockRestore();
    });

    it('suppresses deadline reminders for completed applications (status: Applied)', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder');

      await request(app)
        .post('/api/v1/student/reminders/process')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentDate: new Date().toISOString(),
        });

      // Check all calls made to sendDeadlineReminder
      const calledTitles = sendSpy.mock.calls.map((c) => c[2]);
      expect(calledTitles).not.toContain('Completed Opportunity Due in 7 Days');

      sendSpy.mockRestore();
    });

    it('does NOT send deadline reminders for expired opportunities', async () => {
      const sendSpy = vi.spyOn(emailService, 'sendDeadlineReminder');

      await request(app)
        .post('/api/v1/student/reminders/process')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentDate: new Date().toISOString(),
        });

      const calledTitles = sendSpy.mock.calls.map((c) => c[2]);
      expect(calledTitles).not.toContain('Expired Opportunity Last Week');

      sendSpy.mockRestore();
    });
  });

  describe('4. Delivery Status & Accuracy Verification', () => {
    it('accurately distinguishes not_configured status and never claims confirmed inbox delivery', async () => {
      const res = await emailService.sendApplicationStarted(
        'recipient@example.com',
        'Taylor',
        'Sample Scholarship',
        new Date().toISOString(),
        'app-123'
      );

      expect(res.status).toBe('not_configured');
      expect(res.accepted).toBe(false);
      expect(res.delivered).toBe(false);
      expect(res.statusMessage).toContain('Email provider not configured');
    });
  });
});
