/**
 * documentService.ts
 * Supabase-native Document Vault service.
 * All file storage uses the private 'student-documents' bucket.
 * Signed URLs are generated on-demand (never stored permanently).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { StorageService } from './storage';
import type {
  StoredDocument,
  DocumentType,
  ScholarshipRequiredDocument,
  DocumentReadinessItem,
  ApplicationReadiness,
  SubmittedDocumentSnapshot,
} from '../types';

const BUCKET = 'student-documents';
const SIGNED_URL_TTL = 3600; // 1 hour

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function buildStoragePath(userId: string, fileExt: string): string {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${userId}/${uuid}.${fileExt}`;
}

function mapDocRow(row: Record<string, unknown>): StoredDocument {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    type: (row.type as string) || (row.document_type_name as string) || '',
    documentTypeId: row.document_type_id as string | undefined,
    documentTypeName: row.document_type_name as string | undefined,
    fileFormat: row.file_format as string | undefined,
    fileSize: row.file_size as number | undefined,
    size: row.file_size ? formatSize(row.file_size as number) : (row.size as string | undefined),
    storagePath: row.storage_path as string | undefined,
    fileUrl: row.file_url as string | undefined,
    downloadUrl: row.download_url as string | undefined,
    description: row.description as string | undefined,
    expiryDate: row.expiry_date as string | undefined,
    status: (row.status as StoredDocument['status']) || 'available',
    verified: row.verified as boolean | undefined,
    uploadedAt: row.uploaded_at as string,
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapDocTypeRow(row: Record<string, unknown>): DocumentType {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: row.description as string,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string | undefined,
  };
}

// ─── Document Types ───────────────────────────────────────────────────────────

export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  if (!isSupabaseConfigured) return getFallbackDocumentTypes();
  try {
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as Record<string, unknown>[]).map(mapDocTypeRow);
  } catch {
    return getFallbackDocumentTypes();
  }
}

function getFallbackDocumentTypes(): DocumentType[] {
  const names = [
    'Academic Transcript', 'Statement of Result', 'Admission Letter',
    'Student ID', 'National ID', 'Passport Photograph', 'CV / Resume',
    'Recommendation Letter', 'Certificate', 'Personal Statement',
    'Motivation Letter', 'Proof of Enrollment', 'Proof of Residence', 'Other',
  ];
  return names.map((name, i) => ({
    id: `fallback-${i}`,
    name,
    slug: name.toLowerCase().replace(/\//g, '').replace(/\s+/g, '-'),
    description: '',
    isActive: true,
    sortOrder: i + 1,
  }));
}

// ─── User Documents ───────────────────────────────────────────────────────────

export async function fetchUserDocuments(userId: string): Promise<StoredDocument[]> {
  if (!isSupabaseConfigured) {
    return StorageService.getDocuments(userId);
  }
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_types ( name )
      `)
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data as Record<string, unknown>[]).map((row) => {
      const typeData = row.document_types as Record<string, unknown> | null;
      return mapDocRow({
        ...row,
        document_type_name: typeData?.name || row.type,
      });
    });
  } catch {
    return StorageService.getDocuments(userId);
  }
}

// ─── Upload Document ──────────────────────────────────────────────────────────

export interface UploadDocumentOptions {
  file: File;
  userId: string;
  documentTypeId: string;
  documentTypeName: string;
  name: string;
  description?: string;
  expiryDate?: string;
  onProgress?: (pct: number) => void;
}

export async function uploadDocument(opts: UploadDocumentOptions): Promise<StoredDocument> {
  const { file, userId, documentTypeId, documentTypeName, name, description, expiryDate, onProgress } = opts;

  if (!isSupabaseConfigured) {
    // Fallback — store metadata only in localStorage
    const localDoc: StoredDocument = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      userId,
      name,
      type: documentTypeName,
      documentTypeId,
      documentTypeName,
      fileFormat: file.name.split('.').pop()?.toLowerCase(),
      fileSize: file.size,
      size: formatSize(file.size),
      description,
      expiryDate,
      status: 'available',
      fileUrl: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const existing = StorageService.getDocuments(userId);
    StorageService.saveDocuments([...existing, localDoc]);
    return localDoc;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const storagePath = buildStoragePath(userId, ext);

  onProgress?.(10);

  // Upload to Supabase Storage
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);
  onProgress?.(70);

  // Insert metadata row
  const { data, error: dbErr } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      name,
      type: documentTypeName,
      document_type_id: documentTypeId || null,
      file_format: ext,
      file_size: file.size,
      size: formatSize(file.size),
      storage_path: storagePath,
      description: description || null,
      expiry_date: expiryDate || null,
      status: 'available',
      verified: false,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (dbErr) {
    // Rollback storage upload
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`Database insert failed: ${dbErr.message}`);
  }

  onProgress?.(100);

  return mapDocRow({
    ...(data as Record<string, unknown>),
    document_type_name: documentTypeName,
  });
}

// ─── Get Signed URL ───────────────────────────────────────────────────────────

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured || !storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (error) throw error;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// ─── Update Document Metadata ─────────────────────────────────────────────────

export async function updateDocumentMetadata(
  docId: string,
  updates: Partial<Pick<StoredDocument, 'name' | 'description' | 'expiryDate' | 'status'>>
): Promise<StoredDocument | null> {
  if (!isSupabaseConfigured) return null;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.expiryDate !== undefined) payload.expiry_date = updates.expiryDate;
  if (updates.status !== undefined) payload.status = updates.status;

  try {
    const { data, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', docId)
      .select()
      .single();
    if (error) throw error;
    return mapDocRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

// ─── Replace Document File ────────────────────────────────────────────────────

export async function replaceDocumentFile(
  docId: string,
  oldStoragePath: string | undefined,
  newFile: File,
  userId: string,
  onProgress?: (pct: number) => void
): Promise<StoredDocument | null> {
  if (!isSupabaseConfigured) return null;

  const ext = newFile.name.split('.').pop()?.toLowerCase() || 'pdf';
  const newPath = buildStoragePath(userId, ext);

  onProgress?.(10);

  // Upload new file
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, newFile, { cacheControl: '3600', upsert: false, contentType: newFile.type });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
  onProgress?.(60);

  // Update DB record
  const { data, error: dbErr } = await supabase
    .from('documents')
    .update({
      storage_path: newPath,
      file_format: ext,
      file_size: newFile.size,
      size: formatSize(newFile.size),
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)
    .select()
    .single();

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([newPath]);
    throw new Error(`DB update failed: ${dbErr.message}`);
  }

  onProgress?.(90);

  // Remove old file (non-blocking)
  if (oldStoragePath) {
    supabase.storage.from(BUCKET).remove([oldStoragePath]).catch(() => {});
  }

  onProgress?.(100);
  return mapDocRow(data as Record<string, unknown>);
}

// ─── Delete Document ──────────────────────────────────────────────────────────

export async function deleteDocument(docId: string, storagePath?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) throw error;
    if (storagePath) {
      supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Scholarship Required Documents ──────────────────────────────────────────

export async function fetchScholarshipRequiredDocs(
  scholarshipId: string
): Promise<ScholarshipRequiredDocument[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('scholarship_required_documents')
      .select(`
        *,
        document_types ( id, name, slug )
      `)
      .eq('scholarship_id', scholarshipId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as Record<string, unknown>[]).map((row) => {
      const dt = row.document_types as Record<string, unknown>;
      return {
        id: row.id as string,
        scholarshipId: row.scholarship_id as string,
        documentTypeId: row.document_type_id as string,
        documentTypeName: dt?.name as string || '',
        documentTypeSlug: dt?.slug as string || '',
        isRequired: row.is_required as boolean,
        notes: row.notes as string | undefined,
        sortOrder: row.sort_order as number,
      };
    });
  } catch {
    return [];
  }
}

// Save/replace required docs for a scholarship (admin)
export async function saveScholarshipRequiredDocs(
  scholarshipId: string,
  documentTypeIds: string[],
  documentTypes: DocumentType[]
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    // Delete existing
    await supabase
      .from('scholarship_required_documents')
      .delete()
      .eq('scholarship_id', scholarshipId);

    if (documentTypeIds.length === 0) return;

    const rows = documentTypeIds.map((dtId, i) => ({
      scholarship_id: scholarshipId,
      document_type_id: dtId,
      is_required: true,
      sort_order: i,
    }));

    const { error } = await supabase.from('scholarship_required_documents').insert(rows);
    if (error) throw error;

    // Also update the legacy TEXT[] column for backward compat
    const names = documentTypeIds
      .map((id) => documentTypes.find((dt) => dt.id === id)?.name)
      .filter(Boolean) as string[];

    await supabase
      .from('scholarships')
      .update({ required_documents: names })
      .eq('id', scholarshipId);
  } catch (err) {
    console.error('Failed to save required documents:', err);
  }
}

// ─── Document Readiness Check ─────────────────────────────────────────────────

export function computeApplicationReadiness(
  requirements: ScholarshipRequiredDocument[],
  userDocuments: StoredDocument[]
): ApplicationReadiness {
  if (requirements.length === 0) {
    return { percentage: 100, total: 0, available: 0, missing: 0, items: [], isReady: true };
  }

  const items: DocumentReadinessItem[] = requirements.map((req) => {
    // Match by documentTypeId first, then fall back to name matching
    const matched = userDocuments.find(
      (d) =>
        (d.documentTypeId && d.documentTypeId === req.documentTypeId) ||
        d.type?.toLowerCase().includes(req.documentTypeName.toLowerCase()) ||
        req.documentTypeName.toLowerCase().includes(d.type?.toLowerCase() || '')
    ) || null;

    let status: DocumentReadinessItem['status'] = 'missing';
    if (matched) {
      status = matched.status === 'expired' ? 'expired' : 'available';
    }

    return {
      documentTypeId: req.documentTypeId,
      documentTypeName: req.documentTypeName,
      isRequired: req.isRequired,
      matchedDocument: matched,
      status,
    };
  });

  const required = items.filter((i) => i.isRequired);
  const available = required.filter((i) => i.status === 'available').length;
  const percentage = required.length === 0 ? 100 : Math.round((available / required.length) * 100);

  return {
    percentage,
    total: required.length,
    available,
    missing: required.length - available,
    items,
    isReady: available === required.length,
  };
}

// ─── Comprehensive Scholarship-Specific Readiness Evaluation ──────────────────

export function getReadinessCategory(score: number): 'Ready to Apply' | 'Almost Ready' | 'Needs Preparation' | 'Not Ready Yet' {
  if (score >= 90) return 'Ready to Apply';
  if (score >= 75) return 'Almost Ready';
  if (score >= 50) return 'Needs Preparation';
  return 'Not Ready Yet';
}

export function getReadinessCategoryColors(score: number): { bg: string; text: string; border: string; bar: string } {
  if (score >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', bar: 'bg-emerald-500' };
  if (score >= 75) return { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', bar: 'bg-indigo-500' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', bar: 'bg-amber-500' };
  return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', bar: 'bg-rose-500' };
}

export function evaluateScholarshipReadiness(
  scholarship: import('../types').Scholarship,
  userProfile: import('../types').UserProfile | null,
  userDocuments: StoredDocument[] = []
): import('../types').ComprehensiveReadinessResult {
  const reqDocs = scholarship.requiredDocuments || [];
  const otherReqs = scholarship.otherRequirements || [];
  const hasEduReq = scholarship.educationLevels && scholarship.educationLevels.length > 0;
  const hasFieldReq = scholarship.fieldsOfStudy && scholarship.fieldsOfStudy.length > 0 && !scholarship.fieldsOfStudy.includes('All') && !scholarship.fieldsOfStudy.includes('Any');
  const hasGpaReq = scholarship.minimumGPA !== undefined && scholarship.minimumGPA > 0;
  const hasAgeReq = scholarship.minimumAge !== undefined || scholarship.maximumAge !== undefined;
  const hasCountryReq = scholarship.eligibleCountries && scholarship.eligibleCountries.length > 0 && !scholarship.eligibleCountries.includes('All') && !scholarship.eligibleCountries.includes('International') && !scholarship.eligibleCountries.includes('Global');

  const hasStructuredRequirements = reqDocs.length > 0 || otherReqs.length > 0 || hasEduReq || hasFieldReq || hasGpaReq || hasAgeReq || hasCountryReq;

  if (!hasStructuredRequirements) {
    return {
      hasStructuredRequirements: false,
      score: 0,
      category: 'Not Ready Yet',
      categoryColors: getReadinessCategoryColors(0),
      summary: 'This scholarship does not have enough structured requirements for ScholarPath to calculate your application readiness.',
      items: [],
      missingCount: 0,
      needsReviewCount: 0,
      completeCount: 0,
      totalCount: 0,
      isReady: true,
    };
  }

  const items: import('../types').RequirementItem[] = [];

  // 1. Profile Requirements
  if (hasEduReq) {
    const isProvided = !!userProfile?.educationLevel;
    const isMet = isProvided && scholarship.educationLevels.includes(userProfile!.educationLevel);
    items.push({
      id: 'req-profile-education',
      category: 'Profile',
      name: 'Education Level Confirmation',
      description: isProvided
        ? (isMet ? `Your education level (${userProfile!.educationLevel}) matches this scholarship.` : `Requires ${scholarship.educationLevels.join(' or ')}, your profile is ${userProfile!.educationLevel}.`)
        : `Target degree level: ${scholarship.educationLevels.join(' or ')}. Profile information missing.`,
      status: !userProfile ? 'needs_review' : (!isProvided ? 'needs_review' : (isMet ? 'complete' : 'missing')),
      isRequired: true,
      actionLabel: !userProfile || !isProvided ? 'Complete Profile' : (!isMet ? 'Edit Profile' : undefined),
      actionPath: '/profile',
    });
  }

  if (hasFieldReq) {
    const isProvided = !!(userProfile?.fieldOfStudy || userProfile?.course);
    let isMet = false;
    if (isProvided && userProfile) {
      const uField = (userProfile.fieldOfStudy || '').toLowerCase();
      const uCourse = (userProfile.course || '').toLowerCase();
      isMet = scholarship.fieldsOfStudy.some(f => {
        const fLower = f.toLowerCase();
        return uField.includes(fLower) || fLower.includes(uField) || uCourse.includes(fLower) || fLower.includes(uCourse);
      });
    }
    items.push({
      id: 'req-profile-field',
      category: 'Profile',
      name: 'Field of Study Alignment',
      description: isProvided
        ? (isMet ? `Your field of study (${userProfile!.fieldOfStudy || userProfile!.course}) matches the target fields.` : `Target fields: ${scholarship.fieldsOfStudy.join(', ')}.`)
        : `Target fields: ${scholarship.fieldsOfStudy.join(', ')}. Profile information missing.`,
      status: !userProfile ? 'needs_review' : (!isProvided ? 'needs_review' : (isMet ? 'complete' : 'needs_review')),
      isRequired: false,
      actionLabel: !userProfile || !isProvided ? 'Complete Profile' : undefined,
      actionPath: '/profile',
    });
  }

  if (hasCountryReq) {
    const isProvided = !!userProfile?.country;
    const isMet = isProvided && scholarship.eligibleCountries.some(c => c.toLowerCase() === userProfile!.country.toLowerCase());
    items.push({
      id: 'req-profile-country',
      category: 'Profile',
      name: 'Country / Location Eligibility',
      description: isProvided
        ? (isMet ? `Your location (${userProfile!.country}) is eligible.` : `Limited to applicants from: ${scholarship.eligibleCountries.join(', ')}.`)
        : `Eligible countries: ${scholarship.eligibleCountries.join(', ')}. Country missing in profile.`,
      status: !userProfile ? 'needs_review' : (!isProvided ? 'needs_review' : (isMet ? 'complete' : 'missing')),
      isRequired: true,
      actionLabel: !userProfile || !isProvided ? 'Complete Profile' : (!isMet ? 'Edit Profile' : undefined),
      actionPath: '/profile',
    });
  }

  if (hasAgeReq) {
    const dob = userProfile?.dateOfBirth;
    let isMet = false;
    let userAge: number | null = null;
    if (dob) {
      const birth = new Date(dob);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        userAge = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) userAge--;
        const minOk = !scholarship.minimumAge || userAge >= scholarship.minimumAge;
        const maxOk = !scholarship.maximumAge || userAge <= scholarship.maximumAge;
        isMet = minOk && maxOk;
      }
    }
    const ageWindowStr = `${scholarship.minimumAge || 0} - ${scholarship.maximumAge || 'any'} years`;
    items.push({
      id: 'req-profile-age',
      category: 'Profile',
      name: 'Age Requirement',
      description: userAge !== null
        ? (isMet ? `Your age (${userAge}) is within the eligible range (${ageWindowStr}).` : `Requires age ${ageWindowStr}. Your profile age is ${userAge}.`)
        : `Requires age ${ageWindowStr}. Date of birth missing in profile.`,
      status: !userProfile ? 'needs_review' : (userAge === null ? 'needs_review' : (isMet ? 'complete' : 'missing')),
      isRequired: true,
      actionLabel: !userProfile || userAge === null ? 'Complete Profile' : undefined,
      actionPath: '/profile',
    });
  }

  // 2. Academic Requirements
  if (hasGpaReq) {
    const isProvided = userProfile?.gpa !== undefined && userProfile.gpa > 0;
    let isMet = false;
    if (isProvided && userProfile) {
      const normUser = (userProfile.gpa / (userProfile.gpaScale || 4.0)) * 4.0;
      const normReq = (scholarship.minimumGPA! / (scholarship.gpaScale || 4.0)) * 4.0;
      isMet = normUser >= normReq - 0.001;
    }
    const gpaStr = `${scholarship.minimumGPA!.toFixed(2)} / ${scholarship.gpaScale.toFixed(1)}`;
    items.push({
      id: 'req-academic-gpa',
      category: 'Academic',
      name: `Minimum GPA (${gpaStr})`,
      description: isProvided
        ? (isMet ? `Your GPA (${userProfile!.gpa.toFixed(2)} / ${userProfile!.gpaScale.toFixed(1)}) meets the requirement.` : `Minimum GPA of ${gpaStr} required. Your GPA is ${userProfile!.gpa.toFixed(2)}.`)
        : `Minimum GPA requirement: ${gpaStr}. GPA missing in academic profile.`,
      status: !userProfile ? 'needs_review' : (!isProvided ? 'needs_review' : (isMet ? 'complete' : 'missing')),
      isRequired: true,
      actionLabel: !userProfile || !isProvided ? 'Add GPA' : undefined,
      actionPath: '/profile',
    });
  }

  // 3. Document Requirements
  reqDocs.forEach((docName, idx) => {
    const docLower = docName.toLowerCase();
    const matched = userDocuments.find(d => {
      const dType = (d.type || d.documentTypeName || d.name || '').toLowerCase();
      return dType.includes(docLower) || docLower.includes(dType) ||
             (docLower.includes('transcript') && dType.includes('transcript')) ||
             (docLower.includes('cv') && (dType.includes('cv') || dType.includes('resume'))) ||
             (docLower.includes('recommendation') && dType.includes('recommendation')) ||
             (docLower.includes('personal statement') && (dType.includes('statement') || dType.includes('essay') || dType.includes('motivation')));
    }) || null;

    let status: import('../types').RequirementStatus = 'missing';
    if (matched) {
      status = matched.status === 'expired' ? 'needs_review' : 'complete';
    }

    items.push({
      id: `req-doc-${idx}-${docLower.replace(/[^a-z0-9]/g, '-')}`,
      category: 'Documents',
      name: docName,
      description: matched
        ? (matched.status === 'expired' ? `Uploaded document "${matched.name}" is marked expired.` : `Available in Document Vault: "${matched.name}".`)
        : `Upload ${docName} to your Document Vault to attach to your application.`,
      status,
      isRequired: true,
      actionLabel: matched ? undefined : 'Upload Document',
      actionPath: '/documents',
      matchedDocument: matched,
    });
  });

  // 4. Other Requirements
  otherReqs.forEach((otherName, idx) => {
    const oLower = otherName.toLowerCase();
    let isMet = false;
    let isKnown = false;
    if (userProfile) {
      if (oLower.includes('award') || oLower.includes('honor')) {
        isKnown = true;
        isMet = !!(userProfile.awards && userProfile.awards.length > 0);
      } else if (oLower.includes('leader') || oLower.includes('extracurricular')) {
        isKnown = true;
        isMet = !!(userProfile.leadership && userProfile.leadership.length > 0) || !!(userProfile.extracurriculars && userProfile.extracurriculars.length > 0);
      } else if (oLower.includes('certif')) {
        isKnown = true;
        isMet = !!(userProfile.certifications && userProfile.certifications.length > 0);
      } else if (oLower.includes('volunteer') || oLower.includes('community')) {
        isKnown = true;
        isMet = !!(userProfile.volunteering && userProfile.volunteering.length > 0);
      } else if (oLower.includes('work') || oLower.includes('experience')) {
        isKnown = true;
        isMet = !!(userProfile.workExperience && userProfile.workExperience.length > 0);
      }
    }

    const status: import('../types').RequirementStatus = !userProfile ? 'needs_review' : (!isKnown ? 'needs_review' : (isMet ? 'complete' : 'needs_review'));

    items.push({
      id: `req-other-${idx}`,
      category: 'Other',
      name: otherName,
      description: isMet
        ? 'Verified in your student profile credentials.'
        : `Requirement noted by scholarship provider: "${otherName}".`,
      status,
      isRequired: false,
      actionLabel: !isMet ? 'Update Profile' : undefined,
      actionPath: '/profile',
    });
  });

  // Calculate Weighted Readiness Score
  // Mandatory/Required items have weight 2, Optional items have weight 1
  let totalWeight = 0;
  let earnedWeight = 0;

  items.forEach(item => {
    const weight = item.isRequired ? 2 : 1;
    totalWeight += weight;
    if (item.status === 'complete') {
      earnedWeight += weight;
    } else if (item.status === 'needs_review') {
      // Partial credit for reviewable soft items
      earnedWeight += weight * 0.35;
    }
  });

  const rawScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
  const score = Math.min(100, Math.max(0, rawScore));
  const category = getReadinessCategory(score);
  const categoryColors = getReadinessCategoryColors(score);

  const missingCount = items.filter(i => i.status === 'missing' && i.isRequired).length;
  const needsReviewCount = items.filter(i => i.status === 'needs_review').length;
  const completeCount = items.filter(i => i.status === 'complete').length;

  let summary = 'You have all required documents and information ready to apply.';
  if (score < 50) {
    summary = `You have ${missingCount} required item${missingCount === 1 ? '' : 's'} missing before you can submit your application.`;
  } else if (score < 75) {
    summary = `Needs preparation: ${missingCount} required document${missingCount === 1 ? '' : 's'} or profile field${missingCount === 1 ? '' : 's'} to complete.`;
  } else if (score < 90) {
    summary = 'You have most of what you need to apply. Complete remaining items below.';
  }

  return {
    hasStructuredRequirements: true,
    score,
    category,
    categoryColors,
    summary,
    items,
    missingCount,
    needsReviewCount,
    completeCount,
    totalCount: items.length,
    isReady: missingCount === 0 && score >= 90,
  };
}

// ─── Application Documents (Attach + Snapshot) ───────────────────────────────

export async function attachApplicationDocuments(
  applicationId: string,
  items: DocumentReadinessItem[]
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const rows = items
    .filter((i) => i.matchedDocument)
    .map((i) => ({
      application_id: applicationId,
      document_id: i.matchedDocument!.id,
      document_type_id: i.documentTypeId,
      document_type_name: i.documentTypeName,
      storage_path_snapshot: i.matchedDocument!.storagePath || null,
      original_file_name: i.matchedDocument!.name,
      file_format: i.matchedDocument!.fileFormat || null,
      file_size: i.matchedDocument!.fileSize || null,
      status_at_submission: i.matchedDocument!.status,
    }));

  if (rows.length === 0) return;
  const { error } = await supabase.from('application_documents').insert(rows);
  if (error) console.error('Failed to attach application documents:', error.message);
}

export async function saveSubmissionSnapshot(
  applicationId: string,
  profileSnapshot: Record<string, unknown>,
  docSnapshots: SubmittedDocumentSnapshot[]
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('applications')
    .update({
      submitted_profile_snapshot: profileSnapshot,
      submitted_documents: docSnapshots,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', applicationId);
  if (error) console.error('Failed to save submission snapshot:', error.message);
}

export async function fetchApplicationDocuments(applicationId: string): Promise<SubmittedDocumentSnapshot[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('attached_at', { ascending: true });
    if (error) throw error;
    return (data as Record<string, unknown>[]).map((row) => ({
      documentId: row.document_id as string | undefined,
      documentTypeId: row.document_type_id as string,
      documentTypeName: row.document_type_name as string,
      originalFileName: row.original_file_name as string | undefined,
      fileFormat: row.file_format as string | undefined,
      fileSize: row.file_size as number | undefined,
      storagePath: row.storage_path_snapshot as string | undefined,
      statusAtSubmission: row.status_at_submission as StoredDocument['status'] | undefined,
      attachedAt: row.attached_at as string,
    }));
  } catch {
    return [];
  }
}
