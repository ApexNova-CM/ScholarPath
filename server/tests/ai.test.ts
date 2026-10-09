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
});
