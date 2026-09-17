import { z } from 'zod';

export type UserRole = 'student' | 'admin';

export type EducationLevel =
  | 'High School'
  | 'Undergraduate'
  | 'Postgraduate (Masters)'
  | 'Doctorate (PhD)'
  | 'Vocational / Technical'
  | 'Postdoctoral';

export type FundingType =
  | 'Full'
  | 'Partial'
  | 'Stipend'
  | 'Grant'
  | 'Unspecified'
  | 'Fully funded'
  | 'Partial funding'
  | 'Tuition only'
  | 'Other';

export type AmountPeriod =
  | 'One-time'
  | 'Monthly'
  | 'Annual'
  | 'Renewable'
  | 'Per Semester'
  | 'Unspecified';

export type ScholarshipStatus =
  | 'draft'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'archived';

export type VerificationStatus =
  | 'unverified'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'changes_requested';

export type ApplicationStatus =
  | 'Interested'
  | 'Preparing'
  | 'Applied'
  | 'Under Review'
  | 'Interview'
  | 'Successful'
  | 'Unsuccessful'
  | 'Withdrawn'
  | 'Awarded'
  | 'Not Selected';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileRecord {
  userId: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  country: string;
  state?: string;
  city?: string;
  educationLevel: EducationLevel;
  institution: string;
  course?: string;
  fieldOfStudy: string;
  yearLevel?: string;
  graduationYear?: number;
  gpa: number;
  gpaScale: number;
  financialNeed?: boolean;
  gender?: 'Male' | 'Female' | 'Non-Binary' | 'Prefer not to say';
  awards?: string[];
  achievements?: string[];
  extracurriculars?: string[];
  certifications?: string[];
  leadership?: string[];
  volunteering?: string[];
  workExperience?: string[];
  profileCompletion: number;
  notificationPreferences?: {
    inApp?: boolean;
    email?: boolean;
    push?: boolean;
    whatsapp?: boolean;
    deadlineAlerts?: boolean;
    matchingAlerts?: boolean;
    deadlineDays?: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRecord {
  id: string;
  name: string;
  type?: string;
  logo?: string;
  website: string;
  description: string;
  contactEmail: string;
  contactPhone?: string;
  country: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
  scholarshipCount?: number;
}

export interface ScholarshipRecord {
  id: string;
  title: string;
  providerId: string;
  providerName: string;
  providerLogo?: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  amount?: number;
  currency?: string;
  fundingType: FundingType;
  amountPeriod?: AmountPeriod | string;
  amountDisplay?: string;
  eligibleCountries: string[];
  eligibleStates?: string[];
  educationLevels: EducationLevel[];
  fieldsOfStudy: string[];
  minimumAge?: number;
  maximumAge?: number;
  minimumGPA?: number;
  gpaScale: number;
  genderRequirement?: 'Any' | 'Female' | 'Male';
  financialNeedRequired?: boolean;
  otherRequirements?: string[];
  requiredDocuments: string[];
  applicationInstructions: string;
  applicationUrl: string;
  openingDate?: string;
  deadline: string;
  expectedResultDate?: string;
  status: ScholarshipStatus;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  viewCount: number;
  saveCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  documentId?: string;
  required: boolean;
}

export interface ApplicationRecord {
  id: string;
  userId: string;
  scholarshipId: string;
  scholarshipTitle: string;
  providerName: string;
  deadline: string;
  amount: number;
  currency: string;
  status: ApplicationStatus;
  appliedAt?: string;
  resultDate?: string;
  notes: string;
  checklist: ApplicationChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedScholarshipRecord {
  id: string;
  userId: string;
  scholarshipId: string;
  savedAt: string;
}

export interface StoredDocumentRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  fileFormat: string;
  fileSize: number;
  fileUrl: string;
  verified: boolean;
  uploadedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message?: string;
  body?: string;
  type: string;
  read: boolean;
  link?: string;
  relatedScholarshipId?: string;
  relatedApplicationId?: string;
  createdAt: string;
}

export interface VerificationLogRecord {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  adminId: string;
  adminEmail: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  notes?: string;
  timestamp: string;
}

export interface AdminUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Content Reviewer' | 'Verification Officer';
  status: 'Active' | 'Invited' | 'Suspended';
  assignedDepartment?: string;
  createdAt: string;
  lastActiveAt?: string;
}

// Zod Schemas for Validation
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  country: z.string().default('International'),
  educationLevel: z.enum([
    'High School',
    'Undergraduate',
    'Postgraduate (Masters)',
    'Doctorate (PhD)',
    'Vocational / Technical',
    'Postdoctoral'
  ]).default('Undergraduate'),
  institution: z.string().default(''),
  fieldOfStudy: z.string().default(''),
  gpa: z.number().min(0).max(5).default(0),
  gpaScale: z.number().default(4.0),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Non-Binary', 'Prefer not to say']).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  educationLevel: z.enum([
    'High School',
    'Undergraduate',
    'Postgraduate (Masters)',
    'Doctorate (PhD)',
    'Vocational / Technical',
    'Postdoctoral'
  ]).optional(),
  institution: z.string().optional(),
  course: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  yearLevel: z.string().optional(),
  graduationYear: z.number().optional(),
  gpa: z.number().optional(),
  gpaScale: z.number().optional(),
  financialNeed: z.boolean().optional(),
  gender: z.enum(['Male', 'Female', 'Non-Binary', 'Prefer not to say']).optional(),
  awards: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  extracurriculars: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  leadership: z.array(z.string()).optional(),
  volunteering: z.array(z.string()).optional(),
  workExperience: z.array(z.string()).optional(),
  notificationPreferences: z.record(z.any()).optional(),
});

export const CreateScholarshipSchema = z.object({
  title: z.string().min(3),
  providerId: z.string().optional(),
  providerName: z.string().min(1),
  providerLogo: z.string().optional(),
  description: z.string().min(10),
  shortDescription: z.string().default(''),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  amount: z.number().min(0).optional().default(0),
  currency: z.string().default('USD'),
  fundingType: z.string().default('Full'),
  amountPeriod: z.string().optional(),
  amountDisplay: z.string().optional(),
  eligibleCountries: z.array(z.string()).default(['All']),
  eligibleStates: z.array(z.string()).optional(),
  educationLevels: z.array(z.any()).default(['Undergraduate']),
  fieldsOfStudy: z.array(z.string()).default(['All']),
  minimumAge: z.number().optional(),
  maximumAge: z.number().optional(),
  minimumGPA: z.number().optional(),
  gpaScale: z.number().default(4.0),
  genderRequirement: z.enum(['Any', 'Female', 'Male']).default('Any'),
  financialNeedRequired: z.boolean().default(false),
  otherRequirements: z.array(z.string()).optional(),
  requiredDocuments: z.array(z.string()).default([]),
  applicationInstructions: z.string().default(''),
  applicationUrl: z.string().url(),
  openingDate: z.string().optional(),
  deadline: z.string(),
  expectedResultDate: z.string().optional(),
});

export const VerificationDecisionSchema = z.object({
  decision: z.enum(['verified', 'rejected', 'changes_requested', 'pending_verification']),
  notes: z.string().optional(),
});
