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
  tags: string[];
  amount?: number;
  currency?: string;
  fundingType: FundingType;
  amountPeriod?: AmountPeriod | string;
  amountDisplay?: string;
  eligibleCountries: string[]; // empty or ['All'] means all
  eligibleStates?: string[];
  educationLevels: EducationLevel[];
  fieldsOfStudy: string[]; // empty or ['All'] means any field
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
  viewCount?: number;
  saveCount?: number;
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

/** Overall application readiness result */
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
