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
