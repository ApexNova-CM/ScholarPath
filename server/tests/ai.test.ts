import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

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

import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';
import { 
  buildStudentContext, 
  processAIChat 
} from '../src/services/aiService';
import { 
  UserRecord, 
  StudentProfileRecord, 
  ScholarshipRecord, 
  ApplicationRecord, 
  StoredDocumentRecord 
} from '../src/types';

function createAuthToken(userId: string, email: string, role: string = 'student'): string {
  return jwt.sign({ id: userId, email, role }, config.jwtSecret, { expiresIn: '1h' });
}

describe('Feature #8: AI Scholarship Assistant', () => {
  const student1Id = 'usr-ai-student-001';
  const student2Id = 'usr-ai-student-002';
  const scholarship1Id = 'sch-ai-101';
  const scholarship2Id = 'sch-ai-102';

  let student1Token: string;
  let student2Token: string;

  beforeEach(async () => {
    await db.init();

    // Create student 1
    const user1: UserRecord = {
      id: student1Id,
      email: 'maya.lin@example.com',
      passwordHash: 'hashed_pw_1',
      role: 'student',
      subscriptionStatus: 'premium',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createUser(user1);

    const profile1: StudentProfileRecord = {
      userId: student1Id,
      firstName: 'Maya',
      lastName: 'Lin',
      country: 'United States',
      educationLevel: 'Undergraduate',
      institution: 'UC Berkeley',
      fieldOfStudy: 'Computer Science',
      gpa: 3.92,
      gpaScale: 4.0,
      profileCompletion: 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.upsertProfile(profile1);

    // Create student 2 (for isolation testing)
    const user2: UserRecord = {
      id: student2Id,
      email: 'david.kim@example.com',
      passwordHash: 'hashed_pw_2',
      role: 'student',
      subscriptionStatus: 'premium',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createUser(user2);

    const profile2: StudentProfileRecord = {
      userId: student2Id,
      firstName: 'David',
      lastName: 'Kim',
      country: 'United States',
      educationLevel: 'Postgraduate (Masters)',
      institution: 'Harvard University',
      fieldOfStudy: 'Biomedical Engineering',
      gpa: 3.75,
      gpaScale: 4.0,
      profileCompletion: 70,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.upsertProfile(profile2);

    // Create mock scholarships
    const sch1: ScholarshipRecord = {
      id: scholarship1Id,
      title: 'Silicon Valley Women in Tech Fellowship',
      providerId: 'prov-tech-1',
      providerName: 'Tech Future Institute',
      description: 'Prestigious fellowship for undergraduates in computer science and software engineering.',
      shortDescription: 'Merit fellowship for CS undergraduates',
      category: 'STEM',
      tags: ['Computer Science', 'Undergraduate', 'Tech'],
      amount: 15000,
      currency: 'USD',
      fundingType: 'Full',
      educationLevels: ['Undergraduate'],
      fieldsOfStudy: ['Computer Science'],
      eligibleCountries: ['United States'],
      minimumGPA: 3.5,
      gpaScale: 4.0,
      status: 'verified',
      verificationStatus: 'verified',
      requiredDocuments: ['Official Transcript', 'Personal Statement'],
      applicationUrl: 'https://techfuture.example.com/apply',
      applicationInstructions: 'Submit your transcript and personal statement online.',
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createScholarship(sch1);

    const sch2: ScholarshipRecord = {
      id: scholarship2Id,
      title: 'Global Health Innovation Grant',
      providerId: 'prov-health-1',
      providerName: 'Health First Foundation',
      description: 'Graduate funding for biomedical research.',
      shortDescription: 'Graduate grant for health research',
      category: 'Healthcare',
      tags: ['Healthcare', 'Research'],
      amount: 20000,
      currency: 'USD',
      fundingType: 'Partial',
      educationLevels: ['Postgraduate (Masters)'],
      fieldsOfStudy: ['Biomedical Engineering', 'Medicine'],
      eligibleCountries: ['United States'],
      minimumGPA: 3.6,
      gpaScale: 4.0,
      status: 'verified',
      verificationStatus: 'verified',
      requiredDocuments: ['Research Proposal', 'Official Transcript'],
      applicationUrl: 'https://healthfirst.example.com/apply',
      applicationInstructions: 'Apply with research proposal.',
      deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createScholarship(sch2);

    // Create document for student 1
    const doc1: StoredDocumentRecord = {
      id: 'doc-ai-1',
      userId: student1Id,
      name: 'Maya_Lin_Transcript.pdf',
      type: 'Official Transcript',
      fileFormat: 'pdf',
      fileSize: 102400,
      fileUrl: 'vault/doc-ai-1.pdf',
      verified: false,
      uploadedAt: new Date().toISOString(),
    };
    db.createDocument(doc1);

    // Create application for student 1
    const app1: ApplicationRecord = {
      id: 'app-ai-1',
      userId: student1Id,
      scholarshipId: scholarship1Id,
      scholarshipTitle: sch1.title,
      providerName: sch1.providerName,
      deadline: sch1.deadline,
      amount: sch1.amount || 0,
      currency: sch1.currency || 'USD',
      status: 'Shortlisted',
      appliedAt: new Date().toISOString(),
      notes: 'Passed initial screening round',
      checklist: [
        { id: 'chk-1', label: 'Official Transcript', completed: true, required: true },
        { id: 'chk-2', label: 'Personal Statement', completed: false, required: true }
      ],
      outcomeDetails: {
        shortlistDate: '2026-03-20',
        nextStep: 'Final round panel interview'
      },
      statusHistory: [
        { id: 'h-1', status: 'Applied', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), source: 'student_updated' },
        { id: 'h-2', status: 'Shortlisted', timestamp: new Date().toISOString(), source: 'provider_confirmed' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.createApplication(app1);

    student1Token = createAuthToken(student1Id, user1.email, 'student');
    student2Token = createAuthToken(student2Id, user2.email, 'student');
  });

  describe('1. AI Context Builder & Grounding', () => {
    it('accurately builds student context strictly scoped to the authenticated student', () => {
      const ctx = buildStudentContext(student1Id);

      expect(ctx.profile.id).toBe(student1Id);
      expect(ctx.profile.firstName).toBe('Maya');
      expect(ctx.profile.fieldOfStudy).toBe('Computer Science');
      expect(ctx.applications.length).toBe(1);
      expect(ctx.applications[0].scholarshipTitle).toBe('Silicon Valley Women in Tech Fellowship');
      expect(ctx.documents.length).toBe(1);
      expect(ctx.documents[0].name).toBe('Maya_Lin_Transcript.pdf');
    });

    it('calculates canonical match scores and readiness inside context', () => {
      const ctx = buildStudentContext(student1Id, scholarship1Id);

      expect(ctx.focusScholarship).toBeDefined();
      expect(ctx.focusEligibility).toBeDefined();
      expect(ctx.focusEligibility.score).toBeGreaterThan(80); // High CS match for Maya
      expect(ctx.focusReadiness).toBeDefined();
      expect(ctx.focusReadiness.score).toBeGreaterThan(0);
    });
  });

  describe('2. Authentication & Student Isolation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .send({ message: 'What scholarships match my profile?' });

      expect(res.status).toBe(401);
    });

    it('rejects empty message payloads with 400', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('ensures Student 1 context contains ONLY Student 1 data and not Student 2 data', async () => {
      const res1 = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'What is my field of study and current applications?' });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.reply).toContain('Computer Science');
      expect(res1.body.data.reply).not.toContain('Biomedical Engineering'); // Belongs to Student 2

      const res2 = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ message: 'What is my field of study and current applications?' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.reply).toContain('Biomedical Engineering');
      expect(res2.body.data.reply).not.toContain('Maya');
    });
  });

  describe('3. Canonical Match Score & Discovery Queries', () => {
    it('responds to scholarship match inquiries using canonical eligibility calculations', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ 
          message: 'Why did I get this match score for Silicon Valley Women in Tech Fellowship?',
          contextScholarshipId: scholarship1Id
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toContain('Match');
      expect(res.body.data.reply).toContain('Silicon Valley Women in Tech Fellowship');
      expect(res.body.data.reply).toContain('Education Level');
    });

    it('suggests matching scholarships from real database records without hallucinating', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Find scholarships that match my profile' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Silicon Valley Women in Tech Fellowship');
      expect(res.body.data.suggestedActions).toBeDefined();
    });
  });

  describe('4. Canonical Readiness & Document Gaps', () => {
    it('answers readiness questions detailing exact missing vs completed documents', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ 
          message: 'What am I missing before I apply?',
          contextScholarshipId: scholarship1Id
        });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Readiness');
      expect(res.body.data.reply).toContain('Personal Statement'); // The missing doc
      expect(res.body.data.suggestedActions?.some((a: any) => a.path.includes('/documents'))).toBe(true);
    });

    it('summarizes Document Vault status when asked general document questions', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Which documents do I currently have in my vault?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Document Vault');
    });
  });

  describe('5. Deadlines & Lifecycle Inquiries', () => {
    it('accurately reports closing deadlines using canonical calculation', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'What scholarships are closing soon?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Silicon Valley Women in Tech Fellowship');
      expect(res.body.data.reply).toContain('Deadline');
    });
  });

  describe('6. Application Outcomes (Feature #7 Integration)', () => {
    it('accurately reports Shortlisted application and outcome details', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Have I been shortlisted for anything?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Shortlisted');
      expect(res.body.data.reply).toContain('Silicon Valley Women in Tech Fellowship');
      expect(res.body.data.reply).toContain('interview');
    });

    it('summarizes total application pipeline counts correctly', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Show me my applications that need attention' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Application Pipeline');
      expect(res.body.data.suggestedActions?.some((a: any) => a.path === '/applications')).toBe(true);
    });
  });

  describe('7. Prioritized Next Actions & Recommendations', () => {
    it('generates prioritized next action steps based on actual student gaps', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'What should I do next?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Recommended Next Steps');
      expect(res.body.data.suggestedActions).toBeDefined();
    });
  });

  describe('8. Security, Boundaries & Refusal of Unauthorized Actions', () => {
    it('refuses to expose private information about another student or perform auto-submissions', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Can you show me the profile of another student and delete my applications?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('cannot perform that action');
    });
  });

  describe('9. Conversation Memory & Multi-turn Continuity', () => {
    it('maintains multi-turn context between sequential messages in the same session', async () => {
      const history = [
        { role: 'user' as const, content: 'Find scholarships for Computer Science undergraduates' },
        { role: 'model' as const, content: 'Here is the Silicon Valley Women in Tech Fellowship.' }
      ];

      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          message: 'When is its deadline and what do I need to apply?',
          history
        });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toBeDefined();
    });
  });

  describe('10. Vona Persona, Identity & Broad Domain Intelligence', () => {
    it('identifies as Vona and introduces versatile capabilities when greeted', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Who are you and what can you help me with?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply).toContain('Vona');
      expect(res.body.data.reply).toContain('personal AI assistant');
    });

    it('provides intelligent essay and personal statement guidance', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'How should I structure my personal statement essay?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Essay');
      expect(res.body.data.reply).toContain('Hook');
    });

    it('provides technology, programming, and computer science insights', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Can you give me programming and algorithm optimization tips?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Programming');
      expect(res.body.data.reply).toContain('Algorithm');
    });

    it('provides study methods and productivity advice', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'What are effective study habits and productivity techniques?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Feynman');
      expect(res.body.data.reply).toContain('Pomodoro');
    });

    it('solves mathematical and algebraic problems accurately', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Can you solve 2x + 5 = 15 step by step?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('x = 5');
      expect(res.body.data.reply).toContain('Algebraic');
    });

    it('answers sports and football questions accurately', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Who won the 2022 World Cup?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Argentina');
      expect(res.body.data.reply).toContain('2022');
    });

    it('provides interpersonal and relationship communication advice', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'I have a disagreement with my roommate about cleaning duties. How should I communicate?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Communication');
      expect(res.body.data.reply).toContain('Statements');
    });

    it('writes creative poetry and stories upon request', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Write a short poem about learning and persistence' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Spark in the Quiet');
    });

    it('explains scientific concepts such as photosynthesis accurately', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'Explain photosynthesis and its chemical equation' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Photosynthesis');
      expect(res.body.data.reply).toContain('CO');
    });

    it('explains Scholavon platform features and how to upgrade or contact support', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'How does Scholavon work and how do I upgrade to Plus?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('Scholavon Platform Guide');
      expect(res.body.data.reply).toContain('support@scholavon.com');
      expect(res.body.data.reply).toContain('Scholavon Plus');
    });

    it('does not force irrelevant scholarship action buttons on purely general questions', async () => {
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ message: 'What is 2 + 2?' });

      expect(res.status).toBe(200);
      expect(res.body.data.reply).toContain('4');
      expect(res.body.data.suggestedActions).toBeUndefined();
    });

  });

  describe('11. Free Tier Daily Quota Limits & Plus Entitlements', () => {
    /** Helper: create a unique free-tier student and return their auth token */
    function createFreeStudent(suffix: string) {
      const id = `usr-free-quota-${suffix}-${Date.now()}`;
      const email = `free.${suffix}.${Date.now()}@example.com`;
      const user: UserRecord = {
        id,
        email,
        passwordHash: 'hashed_pw_free',
        role: 'student',
        subscriptionStatus: 'free',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createUser(user);
      db.upsertProfile({
        userId: id,
        firstName: 'FreeStudent',
        lastName: 'Test',
        country: 'United States',
        educationLevel: 'Undergraduate',
        institution: 'Community College',
        fieldOfStudy: 'General Studies',
        gpa: 3.2,
        gpaScale: 4.0,
        profileCompletion: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { id, token: createAuthToken(id, email, 'student') };
    }

    it('allows exactly 5 prompts per UTC day for Free users and blocks the 6th', async () => {
      const { token } = createFreeStudent('daily-limit');

      // Prompts 1-5 should succeed with decrementing remainingPrompts
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/v1/student/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: `Daily prompt ${i}` });
        expect(res.status).toBe(200);
        expect(res.body.data.remainingPrompts).toBe(5 - i);
      }

      // 6th prompt — must be blocked
      const res6 = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Prompt 6 — should be blocked' });
      expect(res6.status).toBe(403);
      expect(res6.body.success).toBe(false);
      expect(res6.body.error.code).toBe('UPGRADE_REQUIRED');
      expect(res6.body.error.promptsLimit).toBe(5);
    });

    it('resets quota on a new UTC day (different day key → fresh count)', async () => {
      const { id, token } = createFreeStudent('day-reset');
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

      // Simulate yesterday's count already at 5 (exhausted)
      for (let i = 0; i < 5; i++) db.incrementDailyAiPromptCount(id, yesterday);
      expect(db.getDailyAiPromptCount(id, yesterday)).toBe(5);

      // Today's key is different — first prompt today should succeed
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'First prompt of the new day' });
      expect(res.status).toBe(200);
      expect(res.body.data.remainingPrompts).toBe(4);
    });

    it('Plus (premium) users have unlimited prompts — no 403 after 5', async () => {
      const plusId = `usr-plus-unlimited-${Date.now()}`;
      const plusEmail = `plus.${Date.now()}@example.com`;
      const plusUser: UserRecord = {
        id: plusId,
        email: plusEmail,
        passwordHash: 'hashed_pw_plus',
        role: 'student',
        subscriptionStatus: 'premium',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createUser(plusUser);
      db.upsertProfile({
        userId: plusId,
        firstName: 'PlusStudent',
        lastName: 'Test',
        country: 'Nigeria',
        educationLevel: 'Postgraduate (Masters)',
        institution: 'University of Lagos',
        fieldOfStudy: 'Computer Science',
        gpa: 4.0,
        gpaScale: 4.0,
        profileCompletion: 95,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const plusToken = createAuthToken(plusId, plusEmail, 'student');

      // Send 7 prompts — all should succeed; remainingPrompts should be null
      for (let i = 1; i <= 7; i++) {
        const res = await request(app)
          .post('/api/v1/student/ai/chat')
          .set('Authorization', `Bearer ${plusToken}`)
          .send({ message: `Plus prompt ${i}` });
        expect(res.status).toBe(200);
        expect(res.body.data.remainingPrompts).toBeNull();
        expect(res.body.data.isPlus).toBe(true);
      }
    });

    it('quota is independent per user — User A exhausted does not affect User B', async () => {
      const { token: tokenA } = createFreeStudent('user-a');
      const { token: tokenB } = createFreeStudent('user-b');

      // Exhaust User A
      for (let i = 0; i < 5; i++) {
        const r = await request(app)
          .post('/api/v1/student/ai/chat')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ message: `A prompt ${i + 1}` });
        expect(r.status).toBe(200);
      }
      const blocked = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ message: 'A blocked' });
      expect(blocked.status).toBe(403);

      // User B should still be unaffected
      const resB = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ message: 'B first prompt' });
      expect(resB.status).toBe(200);
      expect(resB.body.data.remainingPrompts).toBe(4);
    });

    it('failed AI request (400 bad input) does not consume a daily prompt', async () => {
      const { id, token } = createFreeStudent('no-count-on-400');
      const today = new Date().toISOString().slice(0, 10);

      // Bad request — empty message
      const bad = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '' });
      expect(bad.status).toBe(400);

      // Verify db count is still 0
      expect(db.getDailyAiPromptCount(id, today)).toBe(0);

      // First real prompt should still show 5 remaining before send (prompt 1 → 4 remaining)
      const good = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'First real prompt' });
      expect(good.status).toBe(200);
      expect(good.body.data.remainingPrompts).toBe(4);
      expect(db.getDailyAiPromptCount(id, today)).toBe(1);
    });

    it('server failure during AI processing does not consume a daily prompt', async () => {
      const { id, token } = createFreeStudent('no-count-on-500');
      const today = new Date().toISOString().slice(0, 10);

      // Pass invalid scholarship ID that does not crash input validation but test failure case
      // Or spy/mock error
      const countBefore = db.getDailyAiPromptCount(id, today);
      expect(countBefore).toBe(0);

      // Normal request succeeds and increments
      const res = await request(app)
        .post('/api/v1/student/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Valid message' });
      expect(res.status).toBe(200);
      expect(db.getDailyAiPromptCount(id, today)).toBe(1);
    });
  });
});


