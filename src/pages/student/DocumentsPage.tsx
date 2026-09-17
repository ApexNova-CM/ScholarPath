import React, { useState, useEffect, useRef } from 'react';
import { StoredDocument, UserProfile, DocumentType } from '../../types';
import {
  fetchDocumentTypes,
  fetchUserDocuments,
  uploadDocument,
  deleteDocument,
  getSignedUrl,
  updateDocumentMetadata,
  replaceDocumentFile,
} from '../../services/documentService';
import { StorageService } from '../../services/storage';
import {
  FileText, UploadCloud, Trash2, Download, CheckCircle2,
  Plus, X, AlertCircle, Eye, RefreshCw, Clock, Shield,
  HardDrive, Loader2, ChevronDown
} from 'lucide-react';

interface DocumentsPageProps {
  userProfile: UserProfile;
  documents: StoredDocument[];
  onDocumentsChange: (docs: StoredDocument[]) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  available: { label: 'Available', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  verified: { label: 'Verified', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <Shield size={12} /> },
  pending_verification: { label: 'Pending', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Clock size={12} /> },
  expired: { label: 'Expired', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: <AlertCircle size={12} /> },
};

function DocStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({
  userProfile,
  documents,
  onDocumentsChange,
}) => {
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [localDocs, setLocalDocs] = useState<StoredDocument[]>(documents);
  const [isLoading, setIsLoading] = useState(true);

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [docName, setDocName] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Replace modal
  const [replacingDoc, setReplacingDoc] = useState<StoredDocument | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [types, docs] = await Promise.all([
        fetchDocumentTypes(),
        fetchUserDocuments(userProfile.id),
      ]);
      setDocTypes(types);
      if (types.length > 0) setSelectedTypeId(types[0].id);
      setLocalDocs(docs);
      onDocumentsChange(docs);
      setIsLoading(false);
    }
    load();
  }, [userProfile.id]);

  const syncDocs = (updated: StoredDocument[]) => {
    setLocalDocs(updated);
    onDocumentsChange(updated);
  };

  // File validation
  function validateFile(file: File): string | null {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return 'Only PDF, JPG, PNG files are supported.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File must be under 10 MB.';
    }
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setSelectedFile(file);
    setUploadError(null);
    if (!docName.trim()) setDocName(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !docName.trim() || !selectedTypeId) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const dt = docTypes.find((t) => t.id === selectedTypeId);
      const newDoc = await uploadDocument({
        file: selectedFile,
        userId: userProfile.id,
        documentTypeId: selectedTypeId,
        documentTypeName: dt?.name || 'Other',
        name: docName.trim(),
        description: description.trim() || undefined,
        expiryDate: expiryDate || undefined,
        onProgress: setUploadProgress,
      });
      syncDocs([newDoc, ...localDocs]);
      setShowUpload(false);
      resetUploadForm();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  function resetUploadForm() {
    setDocName('');
    setDescription('');
    setExpiryDate('');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    if (docTypes.length > 0) setSelectedTypeId(docTypes[0].id);
  }

  const handlePreview = async (doc: StoredDocument) => {
    if (doc.storagePath) {
      const url = await getSignedUrl(doc.storagePath);
      if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    }
    if (doc.fileUrl && !doc.fileUrl.startsWith('#')) {
      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async (doc: StoredDocument) => {
    let url: string | null = null;
    if (doc.storagePath) {
      url = await getSignedUrl(doc.storagePath);
    }
    url = url || doc.downloadUrl || doc.fileUrl || null;
    if (url && !url.startsWith('#')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDelete = async (doc: StoredDocument) => {
    setIsDeleting(true);
    try {
      await deleteDocument(doc.id, doc.storagePath);
      // Fallback local sync
      StorageService.saveDocuments(localDocs.filter((d) => d.id !== doc.id));
      syncDocs(localDocs.filter((d) => d.id !== doc.id));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceFile || !replacingDoc) return;
    const err = validateFile(replaceFile);
    if (err) { setUploadError(err); return; }
    setIsReplacing(true);
    setUploadError(null);
    try {
      const { replaceDocumentFile: replaceFn } = await import('../../services/documentService');
      const updated = await replaceFn(
        replacingDoc.id,
        replacingDoc.storagePath,
        replaceFile,
        userProfile.id,
        (p) => setUploadProgress(p)
      );
      if (updated) {
        syncDocs(localDocs.map((d) => d.id === replacingDoc.id ? updated : d));
      }
      setReplacingDoc(null);
      setReplaceFile(null);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Replace failed.');
    } finally {
      setIsReplacing(false);
    }
  };

  const filteredDocs = filterType === 'all'
    ? localDocs
    : localDocs.filter((d) => d.documentTypeId === filterType || d.type === filterType);

  const verifiedCount = localDocs.filter((d) => d.status === 'verified').length;
  const expiredCount = localDocs.filter((d) => d.status === 'expired').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <HardDrive size={14} />
            <span>Document Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Documents
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Upload your documents once and they'll be automatically matched when you apply for scholarships.
          </p>
        </div>
        <button
          onClick={() => { setShowUpload(true); resetUploadForm(); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading your documents...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <p className="text-[11px] text-slate-400 font-medium">Total Documents</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{localDocs.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <p className="text-[11px] text-slate-400 font-medium">Available</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {localDocs.filter((d) => d.status === 'available' || d.status === 'verified').length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <p className="text-[11px] text-slate-400 font-medium">Verified</p>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{verifiedCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <p className="text-[11px] text-slate-400 font-medium">Expired</p>
              <p className={`text-2xl font-extrabold mt-1 ${expiredCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {expiredCount}
              </p>
            </div>
          </div>

          {/* Filter */}
          {docTypes.length > 0 && localDocs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                All ({localDocs.length})
              </button>
              {docTypes.filter((t) => localDocs.some((d) => d.documentTypeId === t.id || d.type === t.name)).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${filterType === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t.name} ({localDocs.filter((d) => d.documentTypeId === t.id || d.type === t.name).length})
                </button>
              ))}
            </div>
          )}

          {/* Document List */}
          {filteredDocs.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Stored Documents ({filteredDocs.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => (
                  <div key={doc.id} className="p-4 sm:px-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{doc.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] font-semibold text-indigo-600">
                              {doc.documentTypeName || doc.type}
                            </span>
                            <DocStatusBadge status={doc.status} />
                            {doc.fileSize && (
                              <span className="text-[11px] text-slate-400">{formatSize(doc.fileSize)}</span>
                            )}
                            {doc.fileFormat && (
                              <span className="text-[11px] text-slate-400 uppercase">{doc.fileFormat}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-400">
                            <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                            {doc.expiryDate && (
                              <span className={new Date(doc.expiryDate) < new Date() ? 'text-rose-500 font-semibold' : ''}>
                                Expires {new Date(doc.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">{doc.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {/* Preview */}
                        <button
                          onClick={() => handlePreview(doc)}
                          title="Preview"
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                        {/* Download */}
                        <button
                          onClick={() => handleDownload(doc)}
                          title="Download"
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Download size={15} />
                        </button>
                        {/* Replace */}
                        <button
                          onClick={() => { setReplacingDoc(doc); setReplaceFile(null); setUploadError(null); }}
                          title="Replace file"
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw size={15} />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeletingId(doc.id)}
                          title="Delete"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <UploadCloud size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Documents Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Upload your transcripts, CV, recommendation letters, and other documents to attach them instantly when applying.
              </p>
              <button
                onClick={() => { setShowUpload(true); resetUploadForm(); }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
              >
                Upload First Document
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud size={16} className="text-indigo-600" />
                Upload Document
              </h3>
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Type <span className="text-rose-500">*</span></label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  required
                >
                  {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Name <span className="text-rose-500">*</span></label>
                <input
                  type="text" required value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. UNILAG_Transcript_2025"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (optional)</label>
                <input
                  type="text" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief note about this document"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expiry Date (for IDs, passports)</label>
                <input
                  type="date" value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* File drop zone */}
              <label className="block p-5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50/50 text-center space-y-1.5 cursor-pointer transition-colors">
                <input
                  type="file" ref={fileInputRef} className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  required
                />
                <UploadCloud size={22} className="mx-auto text-indigo-500" />
                {selectedFile ? (
                  <div>
                    <p className="font-bold text-indigo-700 truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500">{formatSize(selectedFile.size)} • Ready to upload</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-800">Choose file or drag & drop</p>
                    <p className="text-[11px] text-slate-500">PDF, JPG, PNG — max 10 MB</p>
                  </div>
                )}
              </label>

              {/* Progress */}
              {isUploading && uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowUpload(false); resetUploadForm(); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isUploading || !selectedFile}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
                  {isUploading ? <><Loader2 size={13} className="animate-spin" /> Uploading...</> : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Replace Modal ── */}
      {replacingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw size={15} className="text-amber-600" />
                Replace Document
              </h3>
              <button onClick={() => setReplacingDoc(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Replacing <strong>{replacingDoc.name}</strong>. Applications already submitted will keep the original file.
            </p>
            <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
              <label className="block p-5 border-2 border-dashed border-amber-200 hover:border-amber-400 rounded-2xl bg-amber-50/30 text-center space-y-1.5 cursor-pointer transition-colors">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const err = validateFile(f);
                    if (err) { setUploadError(err); return; }
                    setReplaceFile(f);
                    setUploadError(null);
                  }} />
                <RefreshCw size={20} className="mx-auto text-amber-500" />
                {replaceFile ? (
                  <p className="font-bold text-amber-700 truncate">{replaceFile.name}</p>
                ) : (
                  <p className="font-semibold text-slate-700">Select new file</p>
                )}
              </label>
              {uploadError && (
                <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg">{uploadError}</p>
              )}
              {isReplacing && uploadProgress > 0 && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReplacingDoc(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isReplacing || !replaceFile}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5">
                  {isReplacing ? <><Loader2 size={13} className="animate-spin" /> Replacing...</> : 'Replace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Delete Document?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently remove the file from your vault. Applications already submitted will keep the original document record.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingId(null)} disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => {
                  const doc = localDocs.find((d) => d.id === deletingId);
                  if (doc) handleDelete(doc);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <><Loader2 size={13} className="animate-spin" /> Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
