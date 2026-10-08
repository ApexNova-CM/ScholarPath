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

export type AwardType = 
  | 'Full scholarship'
  | 'Partial scholarship'
  | 'Tuition'
  | 'Cash award'
  | 'Stipend'
  | 'Research funding'
  | 'Laptop/device'
  | 'Training'
  | 'Internship'
  | 'Mentorship'
  | 'Other';

export type AwardFrequency = 
  | 'One-time'
  | 'Monthly'
  | 'Quarterly'
  | 'Annual'
  | 'Other';

export type ApplicationMethod = 
  | 'External Website'
  | 'Online Form'
  | 'Google Form'
  | 'Zoho Form'
  | 'Email'
  | 'Physical Application'
  | 'Scholavon Application'
  | 'Other';

export type VerificationSourceType = 
  | 'Official Website'
  | 'Official Application Form'
  | 'Official Social Media'
  | 'Organization Announcement'
  | 'Partner Organization'
  | 'Other';

export type InstitutionType = 
  | 'Public University'
  | 'Private University'
  | 'Polytechnic'
  | 'College of Education'
  | 'Secondary School'
  | 'Vocational Institute'
  | 'Any Accredited Institution';

export interface ScholarshipRequirementItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  isDocument: boolean;
  acceptedFileTypes?: string[];
  order: number;
}

export interface ScholarshipApplicationStep {
  id: string;
  stepNumber: number;
  title: string;
  description?: string;
}

export interface ScholarshipSelectionStep {
  id: string;
  stageNumber: number;
  name: string;
  description?: string;
}

export type ScholarshipStatus =
  | 'draft'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'closed'
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
  | 'Shortlisted'
  | 'Interview'
  | 'Successful'
  | 'Unsuccessful'
  | 'Withdrawn'
  | 'Awarded'
  | 'Not Selected';

export type ApplicationStatusSource = 'student_updated' | 'admin_updated' | 'provider_confirmed';

export interface ApplicationStatusHistoryItem {
  id: string;
  status: ApplicationStatus;
  timestamp: string;
  notes?: string;
  source?: ApplicationStatusSource;
  metadata?: Record<string, unknown>;
}

export interface ApplicationOutcomeDetails {
  shortlistDate?: string;
  nextStep?: string;
  nextStepDate?: string;
  interviewDate?: string;
  interviewType?: 'online' | 'in_person' | 'phone' | 'assessment';
  interviewLocation?: string;
  interviewNotes?: string;
  awardDate?: string;
  awardAmount?: number;
  awardCurrency?: string;
  awardDuration?: string;
  awardNotes?: string;
  rejectionDate?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
  withdrawnDate?: string;
  withdrawnReason?: string;
  withdrawnNotes?: string;
}

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
  scholarshipType?: string;
  tags: string[];

  // Award Details
  amount?: number;
  currency?: string;
  awardCurrency?: string;
  fundingType: FundingType;
  awardType?: AwardType | string;
  awardFrequency?: AwardFrequency | string;
  awardValueText?: string;
  awardDescription?: string;
  amountPeriod?: AmountPeriod | string;
  amountDisplay?: string;
  whatTheAwardCovers?: string[];
  numberOfRecipients?: number | string;

  // Eligibility
  eligibleCountries: string[];
  eligibleStates?: string[];
  eligibleNationalities?: string[];
  countryOfStudy?: string[];
  educationLevels: EducationLevel[];
  institutionTypes?: InstitutionType[] | string[];
  studyYears?: string[];
  fieldsOfStudy: string[];
  eligibleCourses?: string[];
  minimumAge?: number;
  maximumAge?: number;
  minimumGPA?: number;
  gpaScale: number;
  academicStanding?: string;
  genderRequirement?: 'Any' | 'Female' | 'Male';
  financialNeedRequired?: boolean;
  leadershipRequired?: boolean;
  communityServiceRequired?: boolean;
  disabilityApplicable?: boolean;
  membershipRequirement?: string;
  otherEligibilityConditions?: string[];
  otherRequirements?: string[];
  otherRequirementsNotes?: string;

  // Requirements
  requiredDocuments: string[];
  structuredRequirements?: ScholarshipRequirementItem[];

  // Application Details
  applicationMethod?: ApplicationMethod | string;
  applicationInstructions: string;
  applicationUrl: string;
  officialWebsiteUrl?: string;
  applicationFee?: string;
  applicationFeeCurrency?: string;
  accountRequired?: boolean;
  applicationSteps?: ScholarshipApplicationStep[];

  // Important Dates
  openingDate?: string;
  deadline: string;
  deadlineTime?: string;
  expectedResultDate?: string;
  awardDate?: string;
  timezone?: string;

  // Selection Process
  selectionProcess?: string;
  selectionCriteria?: string;
  testRequired?: boolean;
  interviewRequired?: boolean;
  essayRequired?: boolean;
  shortlistingProcess?: string;
  selectionSteps?: ScholarshipSelectionStep[];
  otherSelectionInfo?: string;

  // Verification & Trust
  status: ScholarshipStatus;
  verificationStatus: VerificationStatus;
  officialSourceUrl?: string;
  sourceType?: VerificationSourceType | string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  lastUpdatedAt?: string;

  // Publishing & Stats
  isFeatured?: boolean;
  autoCloseOnDeadline?: boolean;
  viewCount: number;
  saveCount: number;
  manuallyClosed?: boolean;
  manuallyClosedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  documentId?: string;
  required: boolean;
  custom?: boolean;
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
  submittedAt?: string;
  resultDate?: string;
  notes: string;
  checklist: ApplicationChecklistItem[];
  essayDraft?: string;
  essayStatus?: 'not_started' | 'drafting' | 'ready';
  essayNotes?: string;
  workspaceLastSavedAt?: string;
  statusHistory?: ApplicationStatusHistoryItem[];
  outcomeDetails?: ApplicationOutcomeDetails;
  statusSource?: ApplicationStatusSource;
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

export type ReminderType = '7_day' | '3_day' | '1_day' | 'deadline_day';
export type ReminderStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';
export type ReminderChannel = 'inApp' | 'email' | 'push' | 'whatsapp';

export interface ReminderRecord {
  id: string;
  userId: string;
  scholarshipId: string;
  scholarshipTitle: string;
  reminderType: ReminderType;
  deadlineAt: string;
  scheduledFor: string;
  sentAt?: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  createdAt: string;
  readAt?: string;
  errorMessage?: string;
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
  gpa: z.number().min(0).max(100).default(0),
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
  id: z.string().optional(),
  title: z.string().min(3),
  providerId: z.string().optional(),
  providerName: z.string().min(1),
  providerLogo: z.string().optional(),
  description: z.string().min(10),
  shortDescription: z.string().default(''),
  category: z.string().min(1),
  scholarshipType: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Award Details
  amount: z.number().min(0).optional().default(0),
  currency: z.string().default('USD'),
  awardCurrency: z.string().optional(),
  fundingType: z.string().default('Full'),
  awardType: z.string().optional(),
  awardFrequency: z.string().optional(),
  awardValueText: z.string().optional(),
  awardDescription: z.string().optional(),
  amountPeriod: z.string().optional(),
  amountDisplay: z.string().optional(),
  whatTheAwardCovers: z.array(z.string()).optional(),
  numberOfRecipients: z.union([z.number(), z.string()]).optional(),

  // Eligibility
  eligibleCountries: z.array(z.string()).default(['All']),
  eligibleStates: z.array(z.string()).optional(),
  eligibleNationalities: z.array(z.string()).optional(),
  countryOfStudy: z.array(z.string()).optional(),
  educationLevels: z.array(z.any()).default(['Undergraduate']),
  institutionTypes: z.array(z.string()).optional(),
  studyYears: z.array(z.string()).optional(),
  fieldsOfStudy: z.array(z.string()).default(['All']),
  eligibleCourses: z.array(z.string()).optional(),
  minimumAge: z.number().optional(),
  maximumAge: z.number().optional(),
  minimumGPA: z.number().optional(),
  gpaScale: z.number().default(4.0),
  academicStanding: z.string().optional(),
  genderRequirement: z.enum(['Any', 'Female', 'Male']).default('Any'),
  financialNeedRequired: z.boolean().default(false),
  leadershipRequired: z.boolean().optional(),
  communityServiceRequired: z.boolean().optional(),
  disabilityApplicable: z.boolean().optional(),
  membershipRequirement: z.string().optional(),
  otherEligibilityConditions: z.array(z.string()).optional(),
  otherRequirements: z.array(z.string()).optional(),
  otherRequirementsNotes: z.string().optional(),

  // Requirements
  requiredDocuments: z.array(z.string()).default([]),
  structuredRequirements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    isDocument: z.boolean(),
    acceptedFileTypes: z.array(z.string()).optional(),
    order: z.number(),
  })).optional(),

  // Application Details
  applicationMethod: z.string().optional(),
  applicationInstructions: z.string().default(''),
  applicationUrl: z.string().url(),
  officialWebsiteUrl: z.string().optional(),
  applicationFee: z.string().optional(),
  applicationFeeCurrency: z.string().optional(),
  accountRequired: z.boolean().optional(),
  applicationSteps: z.array(z.object({
    id: z.string(),
    stepNumber: z.number(),
    title: z.string(),
    description: z.string().optional(),
  })).optional(),

  // Important Dates
  openingDate: z.string().optional(),
  deadline: z.string(),
  deadlineTime: z.string().optional(),
  expectedResultDate: z.string().optional(),
  awardDate: z.string().optional(),
  timezone: z.string().optional(),

  // Selection Process
  selectionProcess: z.string().optional(),
  selectionCriteria: z.string().optional(),
  testRequired: z.boolean().optional(),
  interviewRequired: z.boolean().optional(),
  essayRequired: z.boolean().optional(),
  shortlistingProcess: z.string().optional(),
  selectionSteps: z.array(z.object({
    id: z.string(),
    stageNumber: z.number(),
    name: z.string(),
    description: z.string().optional(),
  })).optional(),
  otherSelectionInfo: z.string().optional(),

  // Verification & Publishing
  status: z.enum(['draft', 'pending_verification', 'verified', 'rejected', 'expired', 'closed', 'archived', 'active']).optional(),
  verificationStatus: z.enum(['unverified', 'pending_verification', 'verified', 'rejected', 'changes_requested']).optional(),
  officialSourceUrl: z.string().optional(),
  sourceType: z.string().optional(),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().optional(),
  verificationNotes: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
  isFeatured: z.boolean().optional(),
  autoCloseOnDeadline: z.boolean().optional(),
});

export const VerificationDecisionSchema = z.object({
  decision: z.enum(['verified', 'rejected', 'changes_requested', 'pending_verification']),
  notes: z.string().optional(),
});

// ─── Subscription & Payment Types ────────────────────────────────────────────

export type SubscriptionStatus = 'free' | 'premium' | 'cancelled' | 'past_due';
export type SubscriptionPlanId = 'premium_monthly' | 'premium_annual';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: SubscriptionPlanId;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  paystackCustomerCode?: string;
  paystackSubscriptionCode?: string;
  paystackEmailToken?: string;
  paystackPlanCode?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  nextPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventRecord {
  id: string;
  userId?: string;
  eventType: string;
  paystackReference?: string;
  paystackSubCode?: string;
  amountKobo?: number;
  currency: string;
  planId?: string;
  rawPayload?: Record<string, unknown>;
  processedAt: string;
}

/** Server-side plan definitions — amounts are in KOBO (1 NGN = 100 kobo).
 *  The client NEVER sends the amount — the server derives it from planId only. */
export interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  amountKobo: number;    // e.g. 150000 = NGN 1,500
  currency: string;      // 'NGN'
  intervalLabel: string; // 'monthly' | 'annually' (as Paystack expects)
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlanId, PlanDefinition> = {
  premium_monthly: {
    id: 'premium_monthly',
    name: 'Scholavon Plus Monthly',
    amountKobo: 150000,   // NGN 1,500
    currency: 'NGN',
    intervalLabel: 'monthly',
  },
  premium_annual: {
    id: 'premium_annual',
    name: 'Scholavon Plus Annual',
    amountKobo: 1000000,  // NGN 10,000
    currency: 'NGN',
    intervalLabel: 'annually',
  },
};

/** Zod schema for POST /api/v1/payments/initialize — only planId accepted from client. */
export const InitializePaymentSchema = z.object({
  planId: z.enum(['premium_monthly', 'premium_annual']),
});

