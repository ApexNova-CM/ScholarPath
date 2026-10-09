export type UserRole = 'student' | 'admin';

/** Subscription plan status for a student account.
 *  Source of truth: public.users.subscription_status (Supabase).
 *  Only written by the server-side webhook handler via service-role. */
export type SubscriptionStatus = 'free' | 'premium' | 'cancelled' | 'past_due';

/** Our internal plan IDs — match the server-side PLAN_DEFINITIONS. */
export type SubscriptionPlanId = 'premium_monthly' | 'premium_annual';

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

/** Computed display lifecycle status — derived at render time, never stored */
export type LifecycleStatus = 'active' | 'closing_soon' | 'closed' | 'archived';

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

export type DocumentStatus = 
  | 'available'
  | 'pending_verification'
  | 'verified'
  | 'expired';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
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
  expectedGraduationDate?: string;
  previousInstitution?: string;
  gpa: number;
  gpaScale: number; // e.g. 4.0 or 5.0
  financialNeed?: boolean;
  gender?: 'Male' | 'Female' | 'Non-Binary' | 'Prefer not to say';
  awards?: string[];
  achievements?: string[];
  extracurriculars?: string[];
  certifications?: string[];
  leadership?: string[];
  volunteering?: string[];
  workExperience?: string[];
  careerGoals?: string;
  personalStatement?: string;
  profileCompletion: number; // 0 - 100
  notificationPreferences?: {
    inApp?: boolean;
    email?: boolean;
    push?: boolean;
    whatsapp?: boolean;
    deadlineDays?: number[]; // e.g. [30, 14, 7, 3, 1]
    deadlineAlerts?: boolean;
    matchingAlerts?: boolean;
  };
  emailVerified?: boolean;
  requiresEmailVerification?: boolean;
  verificationCode?: string;
  isGrandfathered?: boolean;
  /** Subscription status from public.users.subscription_status.
   *  Only updated by server webhook. Never trust client-set values. */
  subscriptionStatus?: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Provider {
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
  createdAt?: string;
  updatedAt?: string;
}

export interface Scholarship {
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
  award_currency?: string;
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
  eligibleCountries: string[]; // empty or ['All'] means all
  eligibleStates?: string[];
  eligibleNationalities?: string[];
  countryOfStudy?: string[];
  educationLevels: EducationLevel[];
  institutionTypes?: InstitutionType[] | string[];
  studyYears?: string[];
  fieldsOfStudy: string[]; // empty or ['All'] means any field
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
  viewCount?: number;
  saveCount?: number;
  /** Set to true by admin "Close" action — prevents auto-restore even if deadline is in future */
  manuallyClosed?: boolean;
  /** ISO timestamp of when admin manually closed this scholarship */
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

export interface Application {
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
  // legacy field name kept for compat
  appliedDate?: string;
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
  // Submission snapshot — frozen at time of submission, never mutated
  submittedProfileSnapshot?: Record<string, unknown>;
  submittedDocuments?: SubmittedDocumentSnapshot[];
  submittedAt?: string;
  applicationAnswers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Frozen document metadata captured at submission time */
export interface SubmittedDocumentSnapshot {
  documentId?: string;
  documentTypeId: string;
  documentTypeName: string;
  originalFileName?: string;
  fileFormat?: string;
  fileSize?: number;
  storagePath?: string;
  statusAtSubmission?: DocumentStatus;
  attachedAt: string;
}

export interface SavedScholarship {
  id: string;
  userId: string;
  scholarshipId: string;
  savedAt: string;
}

/** Admin-configurable document category */
export interface DocumentType {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
}

/** A student's uploaded document in the Document Vault */
export interface StoredDocument {
  id: string;
  userId: string;
  name: string;
  /** Slug/name matching a DocumentType (e.g. 'CV / Resume') */
  type: string;
  /** FK to document_types.id */
  documentTypeId?: string;
  documentTypeName?: string;
  fileFormat?: string; // 'pdf', 'jpg', etc.
  fileSize?: number;   // bytes
  size?: string;       // formatted display e.g. '1.2 MB'
  /** Supabase Storage object path (e.g. '{userId}/{uuid}.pdf') */
  storagePath?: string;
  /** Legacy URL field — kept for backward compat */
  fileUrl?: string;
  downloadUrl?: string;
  description?: string;
  expiryDate?: string;
  status: DocumentStatus;
  verified?: boolean;
  uploadedAt: string;
  updatedAt?: string;
}

/** Required document for a scholarship (relational join result) */
export interface ScholarshipRequiredDocument {
  id: string;
  scholarshipId: string;
  documentTypeId: string;
  documentTypeName: string;
  documentTypeSlug: string;
  isRequired: boolean;
  notes?: string;
  sortOrder: number;
}

/** Result of matching a student's vault against scholarship requirements */
export interface DocumentReadinessItem {
  documentTypeId: string;
  documentTypeName: string;
  isRequired: boolean;
  matchedDocument: StoredDocument | null;
  status: 'available' | 'missing' | 'expired';
}

export type RequirementCategory = 'Profile' | 'Academic' | 'Documents' | 'Other';
export type RequirementStatus = 'complete' | 'missing' | 'needs_review' | 'not_required';

export interface RequirementItem {
  id: string;
  category: RequirementCategory;
  name: string;
  description: string;
  status: RequirementStatus;
  isRequired: boolean;
  actionLabel?: string;
  actionPath?: string;
  matchedDocument?: StoredDocument | null;
}

export type ReadinessCategory = 'Ready to Apply' | 'Almost Ready' | 'Needs Preparation' | 'Not Ready Yet';

export interface ComprehensiveReadinessResult {
  hasStructuredRequirements: boolean;
  score: number; // 0 to 100
  category: ReadinessCategory;
  categoryColors: { bg: string; text: string; border: string; bar: string };
  summary: string;
  items: RequirementItem[];
  missingCount: number;
  needsReviewCount: number;
  completeCount: number;
  totalCount: number;
  isReady: boolean;
}

/** Overall application readiness result (document-specific) */
export interface ApplicationReadiness {
  percentage: number;
  total: number;
  available: number;
  missing: number;
  items: DocumentReadinessItem[];
  isReady: boolean;
}

export interface NotificationItem {
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

export type InAppNotification = NotificationItem;

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

export interface VerificationRecord {
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

export interface EligibilityCriterion {
  factor: 'Education Level' | 'Field of Study' | 'Location' | 'GPA' | 'Age' | 'Financial Need' | 'Gender';
  label: string;
  met: boolean;
  isHardRequirement: boolean;
  detail: string;
}

export interface EligibilityResult {
  status: 'eligible' | 'strong_match' | 'partial_match' | 'not_eligible' | 'profile_incomplete';
  score: number; // 0 to 100
  criteria: EligibilityCriterion[];
  hardDisqualified: boolean;
  hardDisqualificationReason?: string;
  summary: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
  scholarshipCount?: number;
}

export type AdminRoleType = 'Super Admin' | 'Admin' | 'Content Reviewer' | 'Verification Officer';
export type AdminStatus = 'Active' | 'Invited' | 'Suspended';

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRoleType;
  status: AdminStatus;
  createdAt: string;
  lastActiveAt?: string;
  assignedDepartment?: string;
}

export type ReportReason =
  | 'Scholarship has expired'
  | "Application link doesn't work"
  | 'Information is incorrect'
  | 'Eligibility requirements are incorrect'
  | 'Award/funding information is incorrect'
  | 'Scholarship appears suspicious'
  | 'Deadline appears incorrect'
  | 'Other';

export type ReportStatus = 'Pending' | 'Reviewing' | 'Resolved' | 'Dismissed';

export interface ScholarshipReport {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  providerName: string;
  reporterUserId: string;
  reporterName?: string;
  reporterEmail?: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  resolvedByAdminName?: string;
  createdAt: string;
  updatedAt: string;
}
