import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';
import {
  UpdateProfileSchema,
  CreateScholarshipSchema,
  ApplicantStage,
  OpportunityType,
  APPLICANT_STAGE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from '../src/types';

function createAuthToken(userId: string, email: string, role: string = 'student'): string {
  return jwt.sign({ id: userId, email, role }, config.jwtSecret, { expiresIn: '1h' });
}

beforeAll(async () => {
  await db.init();
});

describe('Phase 1: Multi-Audience Foundation Regression & Contract Suite', () => {
  const testStudentId = `usr-multi-aud-${Date.now()}`;
  const testStudentEmail = `multiaud_${Date.now()}@example.com`;
  const studentToken = createAuthToken(testStudentId, testStudentEmail, 'student');

  const adminToken = createAuthToken('usr-admin-001', 'admin@scholavon.org', 'admin');

  describe('1. Applicant Stages & Profile Schema Contracts', () => {
    it('defines and validates all 5 supported applicant stages', () => {
      const stages: ApplicantStage[] = [
        'secondary',
        'undergraduate',
        'postgraduate',
        'vocational',
        'early_career',
      ];

      stages.forEach((stage) => {
        expect(APPLICANT_STAGE_LABELS[stage]).toBeDefined();
        const res = UpdateProfileSchema.safeParse({ applicantStage: stage });
        expect(res.success).toBe(true);
      });
    });

    it('rejects unsupported applicant stages', () => {
      const res = UpdateProfileSchema.safeParse({ applicantStage: 'invalid_stage' });
      expect(res.success).toBe(false);
    });

    it('preserves backward compatibility: allows legacy profile payloads without applicantStage', () => {
      const legacyPayload = {
        firstName: 'Alex',
        lastName: 'Morgan',
        educationLevel: 'Undergraduate',
        institution: 'University of Oxford',
        fieldOfStudy: 'Philosophy',
        gpa: 3.85,
      };

      const res = UpdateProfileSchema.safeParse(legacyPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.applicantStage).toBeUndefined();
        expect(res.data.institution).toBe('University of Oxford');
      }
    });

    it('validates non-academic, vocational, and early-career profile extensions', () => {
      const earlyCareerPayload = {
        applicantStage: 'early_career' as const,
        graduationYear: 2025,
        yearsOfExperience: 2,
        targetIndustry: 'Software Engineering',
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        portfolioUrl: 'https://alexmorgan.dev',
        linkedinUrl: 'https://linkedin.com/in/alexmorgan',
        githubUrl: 'https://github.com/alexmorgan',
      };

      const res = UpdateProfileSchema.safeParse(earlyCareerPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.applicantStage).toBe('early_career');
        expect(res.data.yearsOfExperience).toBe(2);
        expect(res.data.skills).toContain('TypeScript');
      }
    });

    it('validates secondary school learner profile fields', () => {
      const secondaryPayload = {
        applicantStage: 'secondary' as const,
        educationLevel: 'High School' as const,
        secondarySchoolName: 'King\'s College Lagos',
        secondaryGraduationYear: 2027,
        targetMajor: 'Mechatronics Engineering',
      };

      const res = UpdateProfileSchema.safeParse(secondaryPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.secondarySchoolName).toBe('King\'s College Lagos');
        expect(res.data.targetMajor).toBe('Mechatronics Engineering');
      }
    });

    it('validates vocational trade learner profile fields', () => {
      const vocationalPayload = {
        applicantStage: 'vocational' as const,
        educationLevel: 'Vocational / Technical' as const,
        tradeSpecialization: 'Solar Energy & Electrical Systems',
        tradeCertifications: ['NABTEB Modular Certificate', 'Solar PV Installer Level 1'],
        skills: ['Electrical Wiring', 'Inverter Sizing', 'Circuit Testing'],
      };

      const res = UpdateProfileSchema.safeParse(vocationalPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tradeSpecialization).toBe('Solar Energy & Electrical Systems');
        expect(res.data.tradeCertifications).toHaveLength(2);
      }
    });

    it('validates yearsOfExperience as a non-negative integer and handles optional URL fields correctly', () => {
      // Fix 3: yearsOfExperience must be non-negative integer
      expect(UpdateProfileSchema.safeParse({ yearsOfExperience: -1 }).success).toBe(false);
      expect(UpdateProfileSchema.safeParse({ yearsOfExperience: 2.5 }).success).toBe(false);
      expect(UpdateProfileSchema.safeParse({ yearsOfExperience: 0 }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({ yearsOfExperience: 4 }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({}).success).toBe(true);

      // Fix 4: portfolioUrl, linkedinUrl, githubUrl validate format when non-empty, allow empty/undefined
      expect(UpdateProfileSchema.safeParse({ portfolioUrl: 'invalid-url' }).success).toBe(false);
      expect(UpdateProfileSchema.safeParse({ linkedinUrl: 'ftp://not-http.org' }).success).toBe(false);
      expect(UpdateProfileSchema.safeParse({ githubUrl: 'not_a_website' }).success).toBe(false);

      expect(UpdateProfileSchema.safeParse({ portfolioUrl: 'https://portfolio.com' }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({ linkedinUrl: 'http://linkedin.com/in/user' }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({ githubUrl: 'https://github.com/developer' }).success).toBe(true);

      expect(UpdateProfileSchema.safeParse({ portfolioUrl: '' }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({ linkedinUrl: '' }).success).toBe(true);
      expect(UpdateProfileSchema.safeParse({ githubUrl: '' }).success).toBe(true);
    });
  });

  describe('2. Opportunity Types & Creation Schema Contracts', () => {
    it('defines and validates all 7 supported opportunity types', () => {
      const opportunityTypes: OpportunityType[] = [
        'scholarship',
        'grant',
        'fellowship',
        'internship',
        'apprenticeship',
        'competition',
        'exchange',
      ];

      opportunityTypes.forEach((opType) => {
        expect(OPPORTUNITY_TYPE_LABELS[opType]).toBeDefined();

        const payload = {
          title: `Test ${opType} Opportunity`,
          providerName: 'Scholavon Foundation',
          description: 'A comprehensive opportunity for eligible applicants across all disciplines.',
          category: 'Technology',
          opportunityType: opType,
          deadline: '2026-12-31',
          applicationUrl: 'https://example.com/apply',
        };

        const res = CreateScholarshipSchema.safeParse(payload);
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.opportunityType).toBe(opType);
        }
      });
    });

    it('preserves backward compatibility: defaults opportunityType to "scholarship" when omitted', () => {
      const legacyScholarship = {
        title: 'Legacy University Merit Award',
        providerName: 'Alumni Trust',
        description: 'Traditional merit scholarship for high-achieving undergraduates.',
        category: 'Academic',
        deadline: '2026-11-30',
        applicationUrl: 'https://example.com/legacy-apply',
      };

      const res = CreateScholarshipSchema.safeParse(legacyScholarship);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.opportunityType).toBe('scholarship');
        expect(res.data.targetAudiences).toEqual(['undergraduate']);
      }
    });

    it('validates targetAudiences array containing multiple applicant stages', () => {
      const multiAudiencePayload = {
        title: 'Global Climate Innovation Fellowship',
        providerName: 'Earth Action Fund',
        description: 'Open to both undergraduate researchers and early-career founders.',
        category: 'Environment',
        opportunityType: 'fellowship' as const,
        targetAudiences: ['undergraduate', 'postgraduate', 'early_career'] as const,
        compensationType: 'stipend',
        duration: '6 months',
        deadline: '2026-10-15',
        applicationUrl: 'https://example.com/climate',
      };

      const res = CreateScholarshipSchema.safeParse(multiAudiencePayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.targetAudiences).toEqual(['undergraduate', 'postgraduate', 'early_career']);
        expect(res.data.compensationType).toBe('stipend');
        expect(res.data.duration).toBe('6 months');
      }
    });

    it('validates internship and apprenticeship opportunity attributes', () => {
      const internshipPayload = {
        title: 'Frontend Engineering Summer Internship',
        providerName: 'ApexNova Labs',
        description: 'Hands-on frontend engineering role working with React and TypeScript.',
        category: 'Engineering',
        opportunityType: 'internship' as const,
        targetAudiences: ['undergraduate', 'vocational', 'early_career'] as const,
        compensationType: 'salary',
        duration: '12 weeks',
        experienceLevel: 'entry_level',
        skillsRequired: ['React', 'TypeScript', 'Tailwind CSS'],
        workplaceType: 'hybrid',
        deadline: '2026-05-01',
        applicationUrl: 'https://example.com/careers/internship',
      };

      const res = CreateScholarshipSchema.safeParse(internshipPayload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.opportunityType).toBe('internship');
        expect(res.data.skillsRequired).toContain('Tailwind CSS');
        expect(res.data.workplaceType).toBe('hybrid');
      }
    });
  });

  describe('3. HTTP Endpoints Backward-Compatible Integration', () => {
    it('PUT /api/v1/student/profile — accepts and persists multi-audience applicant profile data', async () => {
      const res = await request(app)
        .put('/api/v1/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: 'Amara',
          lastName: 'Okonkwo',
          country: 'Nigeria',
          applicantStage: 'early_career',
          educationLevel: 'Undergraduate',
          graduationYear: 2025,
          yearsOfExperience: 1,
          targetIndustry: 'Product Design',
          skills: ['Figma', 'User Research', 'Wireframing'],
          portfolioUrl: 'https://amara.design',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicantStage).toBe('early_career');
      expect(res.body.data.targetIndustry).toBe('Product Design');
      expect(res.body.data.skills).toContain('Figma');
    });

    it('PUT /api/v1/student/profile — accepts secondary school learner profile without requiring GPA', async () => {
      const secondaryId = `usr-sec-${Date.now()}`;
      const secondaryToken = createAuthToken(secondaryId, `sec_${Date.now()}@example.com`, 'student');

      const res = await request(app)
        .put('/api/v1/student/profile')
        .set('Authorization', `Bearer ${secondaryToken}`)
        .send({
          firstName: 'Chidi',
          lastName: 'Eze',
          country: 'Nigeria',
          applicantStage: 'secondary',
          educationLevel: 'High School',
          secondarySchoolName: 'Federal Government College Enugu',
          secondaryGraduationYear: 2026,
          targetMajor: 'Computer Science',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicantStage).toBe('secondary');
      expect(res.body.data.secondarySchoolName).toBe('Federal Government College Enugu');
    });

    it('POST /api/v1/admin/scholarships — creates and stores an apprenticeship opportunity', async () => {
      const newOpportunity = {
        title: `Clean Energy Technician Apprenticeship ${Date.now()}`,
        providerName: 'Solar Skills Alliance',
        description: 'Comprehensive 6-month hands-on solar installation apprenticeship with certified placement.',
        category: 'Vocational & Technical',
        opportunityType: 'apprenticeship',
        targetAudiences: ['vocational', 'secondary', 'early_career'],
        compensationType: 'stipend',
        duration: '6 months',
        experienceLevel: 'no_experience',
        skillsRequired: ['Basic Tools Knowledge'],
        workplaceType: 'on_site',
        deadline: '2026-11-15',
        applicationUrl: 'https://example.com/apply-apprentice',
      };

      const res = await request(app)
        .post('/api/v1/admin/scholarships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newOpportunity);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.opportunityType).toBe('apprenticeship');
      expect(res.body.data.targetAudiences).toContain('vocational');
      expect(res.body.data.duration).toBe('6 months');
    });

    it('PUT /api/v1/admin/scholarships/:id — updates opportunity fields and preserves existing values on partial update', async () => {
      const oppId = `sch-test-put-${Date.now()}`;
      const initialOpportunity = {
        id: oppId,
        title: `Fullstack Fellowship ${Date.now()}`,
        providerName: 'Engineering Foundation',
        description: 'Comprehensive research and development fellowship.',
        category: 'Technology',
        opportunityType: 'fellowship',
        targetAudiences: ['postgraduate', 'early_career'],
        compensationType: 'salary',
        duration: '12 months',
        experienceLevel: 'mid_level',
        skillsRequired: ['TypeScript', 'Node.js', 'PostgreSQL'],
        workplaceType: 'hybrid',
        deadline: '2026-12-15',
        applicationUrl: 'https://example.com/apply-fellowship',
      };

      const createRes = await request(app)
        .post('/api/v1/admin/scholarships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(initialOpportunity);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.opportunityType).toBe('fellowship');
      expect(createRes.body.data.workplaceType).toBe('hybrid');

      // Update opportunity: partial update that only changes title and duration
      const partialUpdate = {
        title: `Updated Fellowship Title ${Date.now()}`,
        duration: '18 months',
      };

      const updateRes = await request(app)
        .put(`/api/v1/admin/scholarships/${oppId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(partialUpdate);

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      // Changed fields
      expect(updateRes.body.data.title).toBe(partialUpdate.title);
      expect(updateRes.body.data.duration).toBe('18 months');
      // Preserved fields that were omitted from partial update
      expect(updateRes.body.data.opportunityType).toBe('fellowship');
      expect(updateRes.body.data.targetAudiences).toEqual(['postgraduate', 'early_career']);
      expect(updateRes.body.data.compensationType).toBe('salary');
      expect(updateRes.body.data.experienceLevel).toBe('mid_level');
      expect(updateRes.body.data.skillsRequired).toEqual(['TypeScript', 'Node.js', 'PostgreSQL']);
      expect(updateRes.body.data.workplaceType).toBe('hybrid');

      // Verify flat-file DB state
      const persisted = db.findScholarshipById(oppId);
      expect(persisted?.opportunityType).toBe('fellowship');
      expect(persisted?.duration).toBe('18 months');
      expect(persisted?.workplaceType).toBe('hybrid');
    });
  });

  describe('4. Security & Role Privilege Protection Invariance', () => {
    it('strictly maintains technical user roles ("student" and "admin")', () => {
      // Confirm that the auth roles remain unaffected by the applicantStage expansion
      expect(config.jwtSecret).toBeDefined();

      const user = db.findUserById(testStudentId);
      if (user) {
        expect(['student', 'admin']).toContain(user.role);
      }
    });

    it('rejects attempts to inject elevated roles through the profile update schema', async () => {
      const res = await request(app)
        .put('/api/v1/student/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          role: 'admin', // Should be stripped or ignored by Zod schema
          firstName: 'Intruder',
        });

      expect(res.status).toBe(200);
      // Profile role must remain student or unchanged
      const profile = db.getProfile(testStudentId);
      const userRecord = db.findUserById(testStudentId);
      if (userRecord) {
        expect(userRecord.role).toBe('student');
      }
      expect((profile as any)?.role).not.toBe('admin');
    });
  });
});
