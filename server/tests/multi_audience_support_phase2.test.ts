import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/index';
import { db } from '../src/db/store';
import { config } from '../src/config';
import { RegisterSchema } from '../src/types';
import { calculateProfileCompletion } from '../../src/utils/formatters';
import { evaluateEligibility } from '../../src/services/eligibility';
import { 
  UserProfile, Scholarship, ApplicantStage, OpportunityType 
} from '../../src/types';

function createAuthToken(userId: string, email: string, role: string = 'student'): string {
  return jwt.sign({ id: userId, email, role }, config.jwtSecret, { expiresIn: '1h' });
}

beforeAll(async () => {
  await db.init();
});

describe('Phase 2: Multi-Audience Support Regression & Contract Suite', () => {

  describe('1. Multi-Audience Registration & Profile Validation', () => {
    it('successfully registers a secondary school learner without requiring university or GPA', async () => {
      const email = `secondary_${Date.now()}@test.scholavon.org`;
      const payload = {
        firstName: 'Chioma',
        lastName: 'Eze',
        email,
        password: 'Password123!',
        country: 'Nigeria',
        applicantStage: 'secondary' as const,
        secondarySchoolName: 'Queen\'s College Lagos',
        secondaryGraduationYear: 2026,
        targetMajor: 'Computer Engineering',
      };

      // Zod schema check
      const parseResult = RegisterSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);

      // HTTP endpoint check
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      const token = res.body.data?.token || res.body.token;
      const user = res.body.data?.user || res.body.user;
      expect(token).toBeDefined();
      expect(user).toBeDefined();
      expect(user.role).toBe('student'); // Technical role unchanged

      // Verify stored profile record
      const stored = db.getProfile(user.id);
      expect(stored).toBeDefined();
      expect(stored?.applicantStage).toBe('secondary');
      expect(stored?.secondarySchoolName).toBe('Queen\'s College Lagos');
      expect(stored?.secondaryGraduationYear).toBe(2026);
      expect(stored?.targetMajor).toBe('Computer Engineering');
      // Verify no fabricated GPA or university was forced
      expect(stored?.gpa).toBeUndefined();
      expect(stored?.institution).toBeFalsy();
    });

    it('successfully registers a vocational / trade learner without requiring university or GPA', async () => {
      const email = `trade_${Date.now()}@test.scholavon.org`;
      const payload = {
        firstName: 'Marcus',
        lastName: 'Vance',
        email,
        password: 'Password123!',
        country: 'Ghana',
        applicantStage: 'vocational' as const,
        institution: 'Apex Vocational Technical Institute',
        tradeSpecialization: 'Precision Welding & Fabrication',
        tradeCertifications: ['AWS Certified Welder (CW)', 'OSHA-10'],
        skills: ['TIG Welding', 'MIG Welding', 'Blueprint Reading', 'Metal Fabrication'],
      };

      const parseResult = RegisterSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      const user = res.body.data?.user || res.body.user;
      const stored = db.getProfile(user.id);
      expect(stored?.applicantStage).toBe('vocational');
      expect(stored?.tradeSpecialization).toBe('Precision Welding & Fabrication');
      expect(stored?.tradeCertifications).toContain('OSHA-10');
      expect(stored?.skills).toContain('TIG Welding');
      expect(stored?.gpa).toBeUndefined();
    });

    it('successfully registers an early-career / graduate applicant without university enrollment', async () => {
      const email = `earlycareer_${Date.now()}@test.scholavon.org`;
      const payload = {
        firstName: 'Elena',
        lastName: 'Rostova',
        email,
        password: 'Password123!',
        country: 'Kenya',
        applicantStage: 'early_career' as const,
        yearsOfExperience: 2,
        targetIndustry: 'Cloud Infrastructure & DevOps',
        skills: ['Kubernetes', 'Docker', 'Terraform', 'Go'],
        portfolioUrl: 'https://elena.cloud',
        linkedinUrl: 'https://linkedin.com/in/elena-rostova',
        githubUrl: 'https://github.com/elena-rostova',
      };

      const parseResult = RegisterSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      const user = res.body.data?.user || res.body.user;
      const stored = db.getProfile(user.id);
      expect(stored?.applicantStage).toBe('early_career');
      expect(stored?.yearsOfExperience).toBe(2);
      expect(stored?.targetIndustry).toBe('Cloud Infrastructure & DevOps');
      expect(stored?.portfolioUrl).toBe('https://elena.cloud');
      expect(stored?.skills).toContain('Kubernetes');
    });

    it('preserves backward compatibility: allows legacy registration without applicantStage', async () => {
      const email = `legacy_${Date.now()}@test.scholavon.org`;
      const payload = {
        firstName: 'Daniel',
        lastName: 'Craig',
        email,
        password: 'Password123!',
        country: 'United Kingdom',
        educationLevel: 'Undergraduate' as const,
        institution: 'University of Edinburgh',
        fieldOfStudy: 'Literature',
        gpa: 3.7,
      };

      const parseResult = RegisterSchema.safeParse(payload);
      expect(parseResult.success).toBe(true);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      const user = res.body.data?.user || res.body.user;
      const stored = db.getProfile(user.id);
      expect(stored?.applicantStage).toBeUndefined();
      expect(stored?.institution).toBe('University of Edinburgh');
      expect(stored?.gpa).toBe(3.7);
    });

    it('updates applicant profile without re-injecting fabricated GPA or university', async () => {
      const email = `update_test_${Date.now()}@test.scholavon.org`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Amara',
          lastName: 'Kanu',
          email,
          password: 'Password123!',
          country: 'Nigeria',
          applicantStage: 'vocational',
          tradeSpecialization: 'Solar Photovoltaic Installation',
        });

      const token = regRes.body.data?.token || regRes.body.token;

      const updateRes = await request(app)
        .put('/api/v1/student/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tradeSpecialization: 'Advanced Solar & Wind Power Systems',
          skills: ['Solar PV', 'Battery Systems', 'Inverter Sizing'],
          yearsOfExperience: 1,
        });

      expect(updateRes.status).toBe(200);
      const profileData = updateRes.body.data || updateRes.body.profile;
      expect(profileData.tradeSpecialization).toBe('Advanced Solar & Wind Power Systems');
      expect(profileData.skills).toContain('Solar PV');
      expect(profileData.gpa).toBeUndefined();
    });
  });

  describe('2. Audience-Aware Profile Completion Scoring', () => {
    it('awards 100% completion to a secondary school learner without requiring GPA or university', () => {
      const secondaryProfile: UserProfile = {
        id: 'usr-sec-1',
        email: 'secondary@test.org',
        role: 'student',
        firstName: 'Zainab',
        lastName: 'Ali',
        phone: '+2348012345678',
        dateOfBirth: '2008-04-12',
        gender: 'Female',
        country: 'Nigeria',
        city: 'Abuja',
        applicantStage: 'secondary',
        secondarySchoolName: 'Federal Government Girls College',
        secondaryGraduationYear: 2026,
        targetMajor: 'Biomedical Science',
        careerGoals: 'Lead healthcare innovation across West Africa.',
        personalStatement: 'Passionate about biotechnology and community health.',
        awards: ['National Science Olympiad Finalist'],
        skills: ['Biology', 'Mathematics'],
        profileCompletion: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const score = calculateProfileCompletion(secondaryProfile);
      expect(score).toBe(100);
    });

    it('awards 100% completion to a vocational learner without requiring GPA or university degree', () => {
      const vocationalProfile: UserProfile = {
        id: 'usr-voc-1',
        email: 'vocational@test.org',
        role: 'student',
        firstName: 'Kofi',
        lastName: 'Mensah',
        phone: '+233201234567',
        dateOfBirth: '2004-09-20',
        gender: 'Male',
        country: 'Ghana',
        city: 'Accra',
        applicantStage: 'vocational',
        institution: 'Accra Technical Training Centre',
        tradeSpecialization: 'Automotive Mechatronics',
        tradeCertifications: ['ASE Certified', 'City & Guilds Level 3'],
        careerGoals: 'Establish modern electric vehicle maintenance centers.',
        personalStatement: 'Bridging practical mechanics with smart electric drivetrains.',
        awards: ['Regional Skills Competition Gold Medal'],
        skills: ['Diagnostics', 'Engine Rebuilds', 'CAN-bus', 'Hybrid Tech'],
        profileCompletion: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const score = calculateProfileCompletion(vocationalProfile);
      expect(score).toBe(100);
    });

    it('awards 100% completion to an early-career applicant without requiring GPA or university', () => {
      const earlyCareerProfile: UserProfile = {
        id: 'usr-ec-1',
        email: 'early@test.org',
        role: 'student',
        firstName: 'Devon',
        lastName: 'Taylor',
        phone: '+14155550199',
        dateOfBirth: '2001-02-14',
        gender: 'Non-Binary',
        country: 'United States',
        city: 'San Francisco',
        applicantStage: 'early_career',
        targetIndustry: 'Artificial Intelligence',
        yearsOfExperience: 3,
        graduationYear: 2023,
        skills: ['Python', 'PyTorch', 'Data Pipelines', 'FastAPI'],
        portfolioUrl: 'https://devon-taylor.dev',
        careerGoals: 'Build trustworthy AI infrastructure for open access science.',
        personalStatement: 'Software engineer dedicated to high throughput data systems.',
        awards: ['Open Source Fellowship Award'],
        profileCompletion: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const score = calculateProfileCompletion(earlyCareerProfile);
      expect(score).toBe(100);
    });

    it('correctly calculates profile completion for traditional undergraduate students', () => {
      const undergradProfile: UserProfile = {
        id: 'usr-ug-1',
        email: 'undergrad@test.org',
        role: 'student',
        firstName: 'Sarah',
        lastName: 'Connor',
        phone: '+15551234567',
        dateOfBirth: '2004-11-05',
        gender: 'Female',
        country: 'United States',
        city: 'Boston',
        applicantStage: 'undergraduate',
        educationLevel: 'Undergraduate',
        institution: 'MIT',
        fieldOfStudy: 'Computer Science',
        gpa: 3.9,
        careerGoals: 'Advance distributed systems and fault-tolerant computing.',
        personalStatement: 'Eager to build reliable computing infrastructure.',
        awards: ['Dean\'s Honors List'],
        skills: ['Algorithms', 'TypeScript'],
        profileCompletion: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const score = calculateProfileCompletion(undergradProfile);
      expect(score).toBe(100);
    });
  });

  describe('3. Audience-Aware Eligibility & Compatibility Matching', () => {
    it('matches a secondary school student with a secondary-targeted competition without GPA penalty', () => {
      const secondaryScholarship: Scholarship = {
        id: 'sch-sec-001',
        title: 'Global High School STEM Innovation Challenge',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Future Innovators Foundation',
        description: 'Global competition open to secondary school learners.',
        opportunityType: 'competition',
        targetAudiences: ['secondary'],
        amount: 5000,
        deadline: '2026-12-31',
        educationLevels: ['High School'],
        fieldsOfStudy: ['STEM', 'Engineering', 'Computer Science'],
        eligibleCountries: ['All'],
        fundingType: 'Partial',
        status: 'verified',
      };

      const secondaryUser: UserProfile = {
        id: 'usr-sec-match',
        email: 'sec@test.org',
        role: 'student',
        firstName: 'Tariq',
        lastName: 'Mansoor',
        profileCompletion: 85,
        applicantStage: 'secondary',
        secondarySchoolName: 'Cairo STEM School',
        targetMajor: 'Computer Science',
        country: 'Egypt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(secondaryScholarship, secondaryUser);
      expect(result.status).not.toBe('not_eligible');
      expect(result.status).not.toBe('profile_incomplete');
      expect(result.hardDisqualified).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('matches a vocational learner with an apprenticeship opportunity and awards skills bonus', () => {
      const apprenticeship: Scholarship = {
        id: 'sch-appr-001',
        title: 'Industrial Automation Apprenticeship Fellowship',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Siemens Technical Academy',
        description: 'Hands-on technical apprenticeship program.',
        opportunityType: 'apprenticeship',
        targetAudiences: ['vocational'],
        amount: 25000,
        deadline: '2026-11-30',
        educationLevels: ['Vocational / Technical'],
        fieldsOfStudy: ['Mechatronics', 'Electrical Engineering'],
        skillsRequired: ['PLC Programming', 'Circuit Design', 'Robotics'],
        workplaceType: 'on_site',
        eligibleCountries: ['All'],
        fundingType: 'Full',
        status: 'verified',
      };

      const vocationalUser: UserProfile = {
        id: 'usr-voc-match',
        email: 'voc@test.org',
        role: 'student',
        firstName: 'Lars',
        lastName: 'Mueller',
        profileCompletion: 90,
        applicantStage: 'vocational',
        institution: 'Berlin Technical School',
        tradeSpecialization: 'Mechatronics & Robotics',
        skills: ['PLC Programming', 'Robotics', 'Pneumatics'],
        country: 'Germany',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(apprenticeship, vocationalUser);
      expect(result.status).not.toBe('not_eligible');
      expect(result.status).not.toBe('profile_incomplete');
      expect(result.hardDisqualified).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('matches an early-career applicant with a fellowship and does not penalize absence of GPA', () => {
      const fellowship: Scholarship = {
        id: 'sch-fel-001',
        title: 'Open Source Cloud Architecture Fellowship',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Cloud Native Computing Foundation',
        description: 'Professional fellowship for early-career developers.',
        opportunityType: 'fellowship',
        targetAudiences: ['early_career', 'postgraduate'],
        amount: 15000,
        deadline: '2026-12-15',
        educationLevels: ['Undergraduate', 'Postgraduate (Masters)'],
        fieldsOfStudy: ['Computer Science', 'Software Engineering'],
        skillsRequired: ['Rust', 'Distributed Systems', 'Kubernetes'],
        workplaceType: 'remote',
        eligibleCountries: ['All'],
        fundingType: 'Full',
        status: 'verified',
      };

      const earlyCareerUser: UserProfile = {
        id: 'usr-ec-match',
        email: 'dev@test.org',
        role: 'student',
        firstName: 'Siddharth',
        lastName: 'Rao',
        profileCompletion: 85,
        applicantStage: 'early_career',
        targetIndustry: 'Software Engineering',
        yearsOfExperience: 2,
        skills: ['Rust', 'Distributed Systems', 'Go'],
        country: 'India',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(fellowship, earlyCareerUser);
      expect(result.status).not.toBe('not_eligible');
      expect(result.status).not.toBe('profile_incomplete');
      expect(result.hardDisqualified).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('seamlessly matches legacy users and legacy scholarships', () => {
      const legacyScholarship: Scholarship = {
        id: 'sch-leg-001',
        title: 'Merit Undergraduate Excellence Award',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Global Education Trust',
        description: 'Annual scholarship for undergraduate scholars.',
        amount: 10000,
        deadline: '2026-12-31',
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Economics'],
        minimumGPA: 3.5,
        eligibleCountries: ['All'],
        fundingType: 'Partial',
        status: 'verified',
      };

      const legacyUser: UserProfile = {
        id: 'usr-leg-match',
        email: 'legacy_user@test.org',
        role: 'student',
        firstName: 'Fiona',
        lastName: 'Gallagher',
        profileCompletion: 95,
        educationLevel: 'Undergraduate',
        institution: 'London School of Economics',
        fieldOfStudy: 'Economics',
        gpa: 3.8,
        gpaScale: 4.0,
        country: 'United Kingdom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(legacyScholarship, legacyUser);
      expect(result.status).not.toBe('not_eligible');
      expect(result.status).not.toBe('profile_incomplete');
      expect(result.hardDisqualified).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('correctly disqualifies when hard requirements are not met (e.g. GPA below minimum when minimum is required)', () => {
      const strictScholarship: Scholarship = {
        id: 'sch-strict-001',
        title: 'Prestigious Research Grant',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Honor Society',
        description: 'Requires high GPA.',
        opportunityType: 'grant',
        targetAudiences: ['undergraduate', 'postgraduate'],
        amount: 20000,
        deadline: '2026-12-31',
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Physics'],
        minimumGPA: 3.8,
        eligibleCountries: ['All'],
        fundingType: 'Full',
        status: 'verified',
      };

      const lowGpaUser: UserProfile = {
        id: 'usr-low-gpa',
        email: 'lowgpa@test.org',
        role: 'student',
        firstName: 'Tom',
        lastName: 'Hanks',
        profileCompletion: 80,
        applicantStage: 'undergraduate',
        educationLevel: 'Undergraduate',
        fieldOfStudy: 'Physics',
        gpa: 3.2,
        country: 'United States',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(strictScholarship, lowGpaUser);
      expect(result.hardDisqualified).toBe(true);
      expect(result.status).toBe('not_eligible');
      expect(result.hardDisqualificationReason).toMatch(/GPA/i);
    });

    it('does not hard-disqualify an applicant when GPA is missing for an opportunity with minimum GPA', () => {
      const gpaScholarship: Scholarship = {
        id: 'sch-gpa-check-001',
        title: 'Academic Excellence Award',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'University Foundation',
        description: 'Requires 3.5 GPA.',
        opportunityType: 'scholarship',
        targetAudiences: ['undergraduate'],
        amount: 15000,
        deadline: '2026-12-31',
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Computer Science'],
        minimumGPA: 3.5,
        eligibleCountries: ['All'],
        fundingType: 'Full',
        status: 'verified',
      };

      const missingGpaUser: UserProfile = {
        id: 'usr-missing-gpa',
        email: 'nogpa@test.org',
        role: 'student',
        firstName: 'Alex',
        lastName: 'Rivers',
        profileCompletion: 75,
        applicantStage: 'undergraduate',
        educationLevel: 'Undergraduate',
        fieldOfStudy: 'Computer Science',
        country: 'United Kingdom',
        // Note: gpa is undefined / missing
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(gpaScholarship, missingGpaUser);
      // Must NOT be hard disqualified solely for missing GPA
      expect(result.hardDisqualified).toBe(false);
      expect(result.status).not.toBe('not_eligible');
      expect(result.status).toBe('partial_match');
      expect(result.summary).toMatch(/Potentially eligible.*Add your GPA/i);

      // Verify the GPA criterion is present as non-hard requirement
      const gpaCriterion = result.criteria.find(c => c.factor === 'GPA');
      expect(gpaCriterion).toBeDefined();
      expect(gpaCriterion?.met).toBe(false);
      expect(gpaCriterion?.isHardRequirement).toBe(false);
      expect(gpaCriterion?.detail).toMatch(/Add your GPA/i);
    });

    it('qualifies an applicant when GPA meets or exceeds the minimum requirement', () => {
      const gpaScholarship: Scholarship = {
        id: 'sch-gpa-check-002',
        title: 'Academic Excellence Award',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'University Foundation',
        description: 'Requires 3.5 GPA.',
        opportunityType: 'scholarship',
        targetAudiences: ['undergraduate'],
        amount: 15000,
        deadline: '2026-12-31',
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Computer Science'],
        minimumGPA: 3.5,
        eligibleCountries: ['All'],
        fundingType: 'Full',
        status: 'verified',
      };

      const highGpaUser: UserProfile = {
        id: 'usr-high-gpa',
        email: 'highgpa@test.org',
        role: 'student',
        firstName: 'Sam',
        lastName: 'Taylor',
        profileCompletion: 85,
        applicantStage: 'undergraduate',
        educationLevel: 'Undergraduate',
        fieldOfStudy: 'Computer Science',
        gpa: 3.8,
        country: 'United Kingdom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(gpaScholarship, highGpaUser);
      expect(result.hardDisqualified).toBe(false);
      expect(result.status).toMatch(/eligible|strong_match/);
      const gpaCriterion = result.criteria.find(c => c.factor === 'GPA');
      expect(gpaCriterion?.met).toBe(true);
      expect(gpaCriterion?.isHardRequirement).toBe(true);
    });

    it('preserves separate hard disqualification (e.g. location) even when GPA is missing', () => {
      const countrySpecificScholarship: Scholarship = {
        id: 'sch-country-gpa-001',
        title: 'Canada-Only Merit Grant',
        providerId: '',
        shortDescription: '',
        category: '',
        tags: [],
        gpaScale: 4.0,
        requiredDocuments: [],
        applicationInstructions: '',
        applicationUrl: '',
        verificationStatus: 'unverified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        providerName: 'Canadian Academic Council',
        description: 'Requires Canada residence and 3.5 GPA.',
        opportunityType: 'grant',
        targetAudiences: ['undergraduate'],
        amount: 10000,
        deadline: '2026-12-31',
        educationLevels: ['Undergraduate'],
        fieldsOfStudy: ['Computer Science'],
        minimumGPA: 3.5,
        eligibleCountries: ['Canada'],
        fundingType: 'Full',
        status: 'verified',
      };

      const ukUserMissingGpa: UserProfile = {
        id: 'usr-uk-no-gpa',
        email: 'uknogpa@test.org',
        role: 'student',
        firstName: 'Emma',
        lastName: 'Watson',
        profileCompletion: 70,
        applicantStage: 'undergraduate',
        educationLevel: 'Undergraduate',
        fieldOfStudy: 'Computer Science',
        country: 'United Kingdom', // Fails country constraint
        // gpa is undefined
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = evaluateEligibility(countrySpecificScholarship, ukUserMissingGpa);
      // Hard disqualifier (Location) must still trigger
      expect(result.hardDisqualified).toBe(true);
      expect(result.status).toBe('not_eligible');
      expect(result.hardDisqualificationReason).toMatch(/country/i);
    });
  });

  describe('4. Security & Role Privilege Invariance', () => {
    it('does not allow privilege escalation to admin during multi-audience registration', async () => {
      const email = `exploit_${Date.now()}@test.scholavon.org`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Hacker',
          lastName: 'Attempt',
          email,
          password: 'Password123!',
          applicantStage: 'early_career',
          role: 'admin', // Malicious attempt to escalate role
        });

      expect(res.status).toBe(201);
      const user = res.body.data?.user || res.body.user;
      expect(user.role).toBe('student'); // Must strictly remain student

      const stored = db.findUserByEmail(email);
      expect(stored?.role).toBe('student');
    });

    it('does not alter technical permissions via applicantStage updates', async () => {
      const email = `role_check_${Date.now()}@test.scholavon.org`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Regular',
          lastName: 'User',
          email,
          password: 'Password123!',
          applicantStage: 'undergraduate',
        });

      const token = regRes.body.data?.token || regRes.body.token;

      // Attempt to access admin routes with student token
      const adminRes = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(adminRes.status).toBe(403);
    });
  });
});
