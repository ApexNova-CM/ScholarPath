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
import { 
  Scholarship, 
  UserProfile, 
  ApplicationOutcomeDetails,
  StoredDocument
} from '../../src/types';

const createMockUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'student-outcome-1',
  email: 'student.outcome@example.com',
  role: 'student',
  firstName: 'Elena',
  lastName: 'Rostova',
  country: 'United States',
  educationLevel: 'Undergraduate',
  institution: 'MIT',
  fieldOfStudy: 'Computer Science',
  gpa: 3.95,
  gpaScale: 4.0,
  profileCompletion: 95,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  notificationPreferences: {
    inApp: true,
    email: true,
    push: false,
    whatsapp: false,
    deadlineAlerts: true,
    deadlineDays: [7, 3, 1, 0]
  },
  ...overrides,
});

const createMockScholarship = (overrides: Partial<Scholarship> = {}): Scholarship => ({
  id: 'sch-outcome-100',
  title: 'Global Tech Leadership Fellowship',
  providerId: 'prov-tech-1',
  providerName: 'Future Tech Foundation',
  description: 'A merit-based award for high-achieving undergraduates in computer science and STEM.',
  shortDescription: 'Merit award for CS undergrads',
  category: 'STEM',
  tags: ['Tech', 'Leadership', 'Merit'],
  amount: 25000,
  currency: 'USD',
  fundingType: 'Full',
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  educationLevels: ['Undergraduate'],
  fieldsOfStudy: ['Computer Science', 'STEM'],
  eligibleCountries: ['United States'],
  minimumGPA: 3.5,
  gpaScale: 4.0,
  status: 'verified',
  verificationStatus: 'verified',
  applicationUrl: 'https://futuretech.example.com/apply',
  applicationInstructions: 'Apply via the portal and attach all required documents.',
  requiredDocuments: ['Official Transcript', 'Personal Statement'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Feature #7: Application Outcome & Results Management', () => {
  let mockScholarship: Scholarship;
  let mockUser: UserProfile;

  beforeEach(() => {
    localStorage.clear();
    mockScholarship = createMockScholarship();
    mockUser = createMockUser();
    StorageService.saveScholarship(mockScholarship);
  });

  describe('1. Application Lifecycle & Status Transitions', () => {
    it('initializes application in Preparing state with initial status history milestone', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      expect(app).toBeDefined();
      expect(app.status).toBe('Preparing');
      expect(app.statusHistory).toBeDefined();
      expect(app.statusHistory?.length).toBe(1);
      expect(app.statusHistory?.[0].status).toBe('Preparing');
      expect(app.statusHistory?.[0].source).toBe('student_updated');
    });

    it('transitions through full journey: Preparing -> Applied -> Under Review -> Shortlisted -> Interview -> Awarded', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      
      // 1. Mark Applied
      const appliedApp = StorageService.updateApplicationStatus(app.id, 'Applied', 'Submitted on provider portal', undefined, 'student_updated');
      expect(appliedApp?.status).toBe('Applied');
      expect(appliedApp?.statusHistory?.length).toBe(2);

      // 2. Mark Under Review
      const underReviewApp = StorageService.updateApplicationStatus(app.id, 'Under Review', 'Application under review by committee', undefined, 'provider_confirmed');
      expect(underReviewApp?.status).toBe('Under Review');
      expect(underReviewApp?.statusHistory?.length).toBe(3);

      // 3. Mark Shortlisted
      const shortlistedApp = StorageService.updateApplicationStatus(app.id, 'Shortlisted', 'Shortlisted among top 20 candidates', undefined, 'provider_confirmed');
      expect(shortlistedApp?.status).toBe('Shortlisted');
      expect(shortlistedApp?.statusHistory?.length).toBe(4);

      // 4. Mark Interview
      const interviewApp = StorageService.updateApplicationStatus(app.id, 'Interview', 'Finalist interview scheduled', undefined, 'provider_confirmed');
      expect(interviewApp?.status).toBe('Interview');
      expect(interviewApp?.statusHistory?.length).toBe(5);

      // 5. Mark Awarded
      const awardedApp = StorageService.updateApplicationStatus(app.id, 'Awarded', 'Received official offer letter', undefined, 'student_updated');
      expect(awardedApp?.status).toBe('Awarded');
      expect(awardedApp?.statusHistory?.length).toBe(6);

      // Verify sequence of statuses in history
      const statuses = awardedApp?.statusHistory?.map(h => h.status);
      expect(statuses).toEqual(['Preparing', 'Applied', 'Under Review', 'Shortlisted', 'Interview', 'Awarded']);
    });

    it('supports Not Selected and Withdrawn terminal outcomes', () => {
      const app1 = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      const rejectedApp = StorageService.updateApplicationStatus(app1.id, 'Not Selected', 'Competitive applicant pool this cycle', undefined, 'provider_confirmed');
      expect(rejectedApp?.status).toBe('Not Selected');

      const sch2 = createMockScholarship({ id: 'sch-outcome-200' });
      StorageService.saveScholarship(sch2);
      const app2 = StorageService.createApplication(mockUser.id, sch2, 'Preparing');
      const withdrawnApp = StorageService.updateApplicationStatus(app2.id, 'Withdrawn', 'Decided to focus on another fellowship', undefined, 'student_updated');
      expect(withdrawnApp?.status).toBe('Withdrawn');
    });

    it('persists appliedAt timestamp when status transitions to Applied', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      expect(app.appliedAt).toBeUndefined();

      const updated = StorageService.updateApplicationStatus(app.id, 'Applied', 'Form submitted');
      expect(updated.appliedAt).toBeDefined();
      expect(new Date(updated.appliedAt!).getTime()).toBeGreaterThan(0);
    });
  });

  describe('2. Status History Tracking & Sources', () => {
    it('accurately captures source attribution (student_updated, admin_updated, provider_confirmed)', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      
      StorageService.updateApplicationStatus(app.id, 'Applied', 'Student submitted form', undefined, 'student_updated');
      StorageService.updateApplicationStatus(app.id, 'Under Review', 'Admin verified submission with provider', undefined, 'admin_updated');
      const finalApp = StorageService.updateApplicationStatus(app.id, 'Shortlisted', 'Provider portal confirmed shortlist', undefined, 'provider_confirmed');

      const history = finalApp?.statusHistory || [];
      expect(history.length).toBe(4);
      expect(history[0].source).toBe('student_updated');
      expect(history[1].source).toBe('student_updated');
      expect(history[2].source).toBe('admin_updated');
      expect(history[3].source).toBe('provider_confirmed');
    });

    it('preserves timestamps and chronological ordering in status history', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      
      const app2 = StorageService.updateApplicationStatus(app.id, 'Applied', 'Applied on time');
      const app3 = StorageService.updateApplicationStatus(app.id, 'Shortlisted', 'Shortlisted');

      const history = app3?.statusHistory || [];
      expect(history.length).toBe(3);
      
      const t0 = new Date(history[0].timestamp).getTime();
      const t1 = new Date(history[1].timestamp).getTime();
      const t2 = new Date(history[2].timestamp).getTime();
      
      expect(t1).toBeGreaterThanOrEqual(t0);
      expect(t2).toBeGreaterThanOrEqual(t1);
    });

    it('does not duplicate history entries if updateApplication does not change the status', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      expect(app.statusHistory?.length).toBe(1);

      // Update notes or checklist without changing status
      const updated = StorageService.updateApplication(app.id, {
        notes: 'Updated personal workspace notes'
      });

      expect(updated?.statusHistory?.length).toBe(1);
      expect(updated?.notes).toBe('Updated personal workspace notes');
    });

    it('preserves checklist toggling without resetting status history or outcome details', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      expect(app.checklist.length).toBeGreaterThan(0);
      const firstCheckId = app.checklist[0].id;

      // Update outcome
      StorageService.recordApplicationOutcome(app.id, 'Interview', { interviewType: 'online' });
      
      // Toggle checklist
      const toggled = StorageService.toggleApplicationChecklistItem(app.id, firstCheckId);
      expect(toggled.checklist[0].completed).toBe(true);
      expect(toggled.status).toBe('Interview');
      expect(toggled.outcomeDetails?.interviewType).toBe('online');
      expect(toggled.statusHistory?.length).toBe(2);
    });
  });

  describe('3. Outcome Details Metadata Recording', () => {
    it('records and persists Awarded outcome details (amount, date, duration, notes)', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      
      const outcomeDetails: ApplicationOutcomeDetails = {
        awardAmount: 25000,
        awardDate: '2026-05-15',
        awardDuration: '4 Years (Renewable)',
        awardNotes: 'Covers full tuition and annual stipend.'
      };

      const updated = StorageService.recordApplicationOutcome(app.id, 'Awarded', outcomeDetails, 'Awarded full funding', 'student_updated');
      
      expect(updated?.status).toBe('Awarded');
      expect(updated?.outcomeDetails?.awardAmount).toBe(25000);
      expect(updated?.outcomeDetails?.awardDate).toBe('2026-05-15');
      expect(updated?.outcomeDetails?.awardDuration).toBe('4 Years (Renewable)');
      expect(updated?.outcomeDetails?.awardNotes).toBe('Covers full tuition and annual stipend.');

      // Verify retrieval from getApplications
      const loaded = StorageService.getApplications(mockUser.id).find(a => a.id === app.id);
      expect(loaded?.outcomeDetails?.awardAmount).toBe(25000);
    });

    it('records and persists Interview outcome details (interview date, type, location, notes)', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Shortlisted');
      
      const interviewDetails: ApplicationOutcomeDetails = {
        interviewDate: '2026-04-10T14:00:00Z',
        interviewType: 'online',
        interviewLocation: 'https://zoom.us/j/123456789',
        interviewNotes: 'Panel interview with 3 STEM faculty members.'
      };

      const updated = StorageService.recordApplicationOutcome(app.id, 'Interview', interviewDetails, 'Interview invitation received');
      
      expect(updated?.status).toBe('Interview');
      expect(updated?.outcomeDetails?.interviewDate).toBe('2026-04-10T14:00:00Z');
      expect(updated?.outcomeDetails?.interviewType).toBe('online');
      expect(updated?.outcomeDetails?.interviewLocation).toBe('https://zoom.us/j/123456789');
    });

    it('records and persists Shortlisted details (next steps, decision date)', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Under Review');
      
      const shortlistDetails: ApplicationOutcomeDetails = {
        shortlistDate: '2026-03-20',
        nextStep: 'Submit 2 reference letters by April 1st',
        nextStepDate: '2026-04-01'
      };

      const updated = StorageService.recordApplicationOutcome(app.id, 'Shortlisted', shortlistDetails, 'Advanced to round 2');
      
      expect(updated?.status).toBe('Shortlisted');
      expect(updated?.outcomeDetails?.nextStep).toBe('Submit 2 reference letters by April 1st');
      expect(updated?.outcomeDetails?.nextStepDate).toBe('2026-04-01');
    });

    it('records and persists Not Selected outcome reasons and feedback', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      
      const rejectionDetails: ApplicationOutcomeDetails = {
        rejectionReason: 'Exceeded maximum annual funding allocation',
        rejectionNotes: 'Encouraged to re-apply next academic year.'
      };

      const updated = StorageService.recordApplicationOutcome(app.id, 'Not Selected', rejectionDetails, 'Outcome received');
      
      expect(updated?.status).toBe('Not Selected');
      expect(updated?.outcomeDetails?.rejectionReason).toBe('Exceeded maximum annual funding allocation');
      expect(updated?.outcomeDetails?.rejectionNotes).toBe('Encouraged to re-apply next academic year.');
    });

    it('records and persists Withdrawn reason', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Preparing');
      
      const withdrawalDetails: ApplicationOutcomeDetails = {
        withdrawnReason: 'Accepted an alternative fellowship with full funding',
        withdrawnNotes: 'Withdrew via provider portal.'
      };

      const updated = StorageService.recordApplicationOutcome(app.id, 'Withdrawn', withdrawalDetails, 'Withdrawn by student');
      
      expect(updated?.status).toBe('Withdrawn');
      expect(updated?.outcomeDetails?.withdrawnReason).toBe('Accepted an alternative fellowship with full funding');
    });

    it('allows updating outcome details incrementally without losing existing metadata', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      
      // Step 1: Add initial shortlist info
      StorageService.recordApplicationOutcome(app.id, 'Shortlisted', {
        shortlistDate: '2026-03-15',
        nextStep: 'Complete technical assessment'
      });

      // Step 2: Progress to interview while preserving history
      const interviewApp = StorageService.recordApplicationOutcome(app.id, 'Interview', {
        interviewDate: '2026-03-25T10:00:00Z',
        interviewType: 'in_person',
        interviewLocation: 'Room 402, Building 10'
      });

      expect(interviewApp.status).toBe('Interview');
      expect(interviewApp.outcomeDetails?.interviewLocation).toBe('Room 402, Building 10');
      expect(interviewApp.statusHistory?.length).toBe(3);
    });
  });

  describe('4. Backward Compatibility & Resilience', () => {
    it('handles legacy applications without statusHistory gracefully', () => {
      // Create an application first
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      
      // Manually remove statusHistory to simulate a legacy record
      delete (app as any).statusHistory;

      // Update status on legacy app
      const updated = StorageService.updateApplicationStatus(app.id, 'Under Review', 'Review started');
      
      expect(updated?.status).toBe('Under Review');
      expect(updated?.statusHistory).toBeDefined();
      expect(updated?.statusHistory?.length).toBe(2);
      expect(updated?.statusHistory?.[0].status).toBe('Applied'); // Backfilled legacy milestone
      expect(updated?.statusHistory?.[1].status).toBe('Under Review'); // New milestone
    });

    it('returns empty array when user has no applications', () => {
      const apps = StorageService.getApplications('non-existent-user');
      expect(apps).toEqual([]);
    });

    it('preserves submitted snapshot fields when updating outcomes', () => {
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Applied');
      
      // Attach a frozen snapshot
      const updatedWithSnapshot = StorageService.updateApplication(app.id, {
        submittedProfileSnapshot: { gpa: 3.95, major: 'Computer Science' },
        submittedAt: new Date().toISOString()
      });

      expect(updatedWithSnapshot.submittedProfileSnapshot).toBeDefined();

      // Record Awarded outcome
      const awardedApp = StorageService.recordApplicationOutcome(app.id, 'Awarded', { awardAmount: 25000 });
      expect(awardedApp.submittedProfileSnapshot).toEqual({ gpa: 3.95, major: 'Computer Science' });
    });
  });

  describe('5. Student Isolation & Data Integrity', () => {
    it('maintains strict isolation between different students applications and outcomes', () => {
      const app1 = StorageService.createApplication('student-1', mockScholarship, 'Preparing');
      const app2 = StorageService.createApplication('student-2', mockScholarship, 'Preparing');

      StorageService.recordApplicationOutcome(app1.id, 'Awarded', { awardAmount: 10000 }, 'Awarded to student 1');

      const student1Apps = StorageService.getApplications('student-1');
      const student2Apps = StorageService.getApplications('student-2');

      expect(student1Apps.length).toBe(1);
      expect(student1Apps[0].status).toBe('Awarded');
      expect(student1Apps[0].outcomeDetails?.awardAmount).toBe(10000);

      expect(student2Apps.length).toBe(1);
      expect(student2Apps[0].status).toBe('Preparing');
      expect(student2Apps[0].outcomeDetails).toBeUndefined();
    });

    it('retrieves distinct applications for each student by ID', () => {
      const app1 = StorageService.createApplication('student-A', mockScholarship, 'Applied');
      const app2 = StorageService.createApplication('student-B', mockScholarship, 'Shortlisted');

      const retrieved1 = StorageService.getApplicationById(app1.id);
      const retrieved2 = StorageService.getApplicationById(app2.id);

      expect(retrieved1?.userId).toBe('student-A');
      expect(retrieved1?.status).toBe('Applied');
      expect(retrieved2?.userId).toBe('student-B');
      expect(retrieved2?.status).toBe('Shortlisted');
    });
  });

  describe('6. System Decoupling (Match Score, Readiness, Lifecycle, Reminders)', () => {
    it('does NOT alter or distort personalized Match Score calculation when application is Awarded or Rejected', () => {
      const user = createMockUser({ gpa: 3.9, fieldOfStudy: 'Computer Science' });
      const scholarship = createMockScholarship({ minimumGPA: 3.5, fieldsOfStudy: ['Computer Science'] });

      // Calculate baseline match score before application
      const baselineMatch = evaluateEligibility(scholarship, user);
      expect(baselineMatch.score).toBeGreaterThan(80);

      // Create application and set to Awarded
      const app = StorageService.createApplication(user.id, scholarship, 'Applied');
      StorageService.recordApplicationOutcome(app.id, 'Awarded', { awardAmount: 25000 }, 'Won scholarship');

      // Re-evaluate match score
      const postMatch = evaluateEligibility(scholarship, user);
      expect(postMatch.score).toBe(baselineMatch.score);
      expect(postMatch.hardDisqualified).toBe(baselineMatch.hardDisqualified);
      expect(getMatchCategory(postMatch.score)).toBe(getMatchCategory(baselineMatch.score));
    });

    it('does NOT alter Document Vault readiness check when application outcome changes', () => {
      const user = createMockUser();
      const scholarship = createMockScholarship();
      const docs: StoredDocument[] = [
        {
          id: 'doc-1',
          userId: user.id,
          name: 'MIT_Official_Transcript.pdf',
          type: 'transcript',
          fileSize: 102400,
          storagePath: '/vault/doc-1.pdf',
          status: 'available',
          uploadedAt: new Date().toISOString()
        }
      ];

      const baselineReadiness = evaluateScholarshipReadiness(scholarship, user, docs);
      expect(baselineReadiness.score).toBeGreaterThan(0);

      // Change application outcome to Not Selected
      const app = StorageService.createApplication(user.id, scholarship, 'Applied');
      StorageService.recordApplicationOutcome(app.id, 'Not Selected', { rejectionReason: 'Funding limit' }, 'Rejected');

      // Verify Document Readiness remains strictly identical
      const postReadiness = evaluateScholarshipReadiness(scholarship, user, docs);
      expect(postReadiness.score).toBe(baselineReadiness.score);
      expect(postReadiness.completeCount).toBe(baselineReadiness.completeCount);
      expect(postReadiness.missingCount).toBe(baselineReadiness.missingCount);
    });

    it('does NOT alter Scholarship Lifecycle status (active/closing_soon/closed) when application outcome changes', () => {
      const futureDeadline = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
      const scholarship = createMockScholarship({ deadline: futureDeadline, status: 'verified' });

      const baselineLifecycle = computeLifecycleStatus(scholarship);
      expect(baselineLifecycle).toBe('closing_soon'); // within 7 days (CLOSING_SOON_DAYS)

      // Update application outcome to Shortlisted
      const app = StorageService.createApplication(mockUser.id, scholarship, 'Applied');
      StorageService.recordApplicationOutcome(app.id, 'Shortlisted', { shortlistDate: '2026-03-01' });

      // Lifecycle status must remain closing_soon
      const postLifecycle = computeLifecycleStatus(scholarship);
      expect(postLifecycle).toBe('closing_soon');
    });

    it('allows applicants to view and update outcomes for closed/archived scholarships without reactivating the scholarship', () => {
      const pastDeadline = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const closedScholarship = createMockScholarship({ deadline: pastDeadline, status: 'verified' });

      // Verify scholarship is computed as closed
      expect(computeLifecycleStatus(closedScholarship)).toBe('closed');

      // Existing applicant updates outcome
      const app = StorageService.createApplication(mockUser.id, closedScholarship, 'Applied');
      const updatedApp = StorageService.recordApplicationOutcome(
        app.id, 
        'Awarded', 
        { awardAmount: 25000, awardDate: '2026-03-25' },
        'Notified of grant award after closure'
      );

      expect(updatedApp?.status).toBe('Awarded');
      expect(updatedApp?.outcomeDetails?.awardAmount).toBe(25000);

      // Verify scholarship lifecycle is STILL closed
      expect(computeLifecycleStatus(closedScholarship)).toBe('closed');
    });

    it('maintains independent deadline calculations regardless of application outcome', () => {
      const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const days = calculateDaysUntilDeadline(deadline);
      expect(days).toBe(5);

      // Even if application is Withdrawn or Awarded, deadline math is unchanged
      const app = StorageService.createApplication(mockUser.id, mockScholarship, 'Withdrawn');
      expect(app.status).toBe('Withdrawn');
      expect(calculateDaysUntilDeadline(deadline)).toBe(5);
    });
  });
});
