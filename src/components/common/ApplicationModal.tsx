import React, { useState, useEffect } from 'react';
import { Scholarship, UserProfile, StoredDocument, Application, DocumentReadinessItem } from '../../types';
import { evaluateEligibility } from '../../services/eligibility';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchScholarshipRequiredDocs,
  computeApplicationReadiness,
  attachApplicationDocuments,
  saveSubmissionSnapshot,
  fetchDocumentTypes,
  fetchUserDocuments,
} from '../../services/documentService';
import {
  CheckCircle2, AlertCircle, ExternalLink, X, FileText,
  Sparkles, User, GraduationCap, ChevronRight, ChevronLeft,
  UploadCloud, Loader2, Eye, RefreshCw, Shield
} from 'lucide-react';

interface ApplicationModalProps {
  scholarship: Scholarship | null;
  userProfile: UserProfile | null;
  documents: StoredDocument[];
  isOpen: boolean;
  onClose: () => void;
  onApplicationCreated?: (app: Application) => void;
  onNavigate?: (path: string) => void;
}

type Step = 'profile' | 'documents' | 'review' | 'submitting' | 'done';

const STEP_LABELS: Record<Step, string> = {
  profile: 'Profile',
  documents: 'Documents',
  review: 'Review',
  submitting: 'Submitting',
  done: 'Done',
};

const ORDERED_STEPS: Step[] = ['profile', 'documents', 'review'];

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200';

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {ORDERED_STEPS.map((s, i) => {
        const idx = ORDERED_STEPS.indexOf(current);
        const done = i < idx;
        const active = s === current;
        return (
          <React.Fragment key={s}>
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
              done ? 'bg-emerald-600 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {done ? <CheckCircle2 size={12} /> : i + 1}
            </div>
            <span className={`font-semibold ${active ? 'text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
              {STEP_LABELS[s]}
            </span>
            {i < ORDERED_STEPS.length - 1 && (
              <ChevronRight size={12} className="text-slate-300 mx-0.5" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  scholarship,
  userProfile,
  documents,
  isOpen,
  onClose,
  onApplicationCreated,
  onNavigate,
}) => {
  const [step, setStep] = useState<Step>('profile');
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);
  const [freshDocs, setFreshDocs] = useState<StoredDocument[]>(documents);

  // Editable profile fields (pre-filled)
  const [profileFields, setProfileFields] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    country: userProfile?.country || '',
    state: userProfile?.state || '',
    institution: userProfile?.institution || '',
    course: userProfile?.course || '',
    fieldOfStudy: userProfile?.fieldOfStudy || '',
    educationLevel: userProfile?.educationLevel || '',
    yearLevel: userProfile?.yearLevel || '',
    gpa: userProfile?.gpa?.toString() || '',
    gpaScale: userProfile?.gpaScale?.toString() || '4.0',
    expectedGraduationDate: userProfile?.expectedGraduationDate?.slice(0, 10) || '',
    careerGoals: userProfile?.careerGoals || '',
  });

  // Document readiness
  const [docItems, setDocItems] = useState<DocumentReadinessItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdApp, setCreatedApp] = useState<Application | null>(null);

  useEffect(() => {
    if (!isOpen || !scholarship) return;
    setStep('profile');
    setSubmitError(null);
    setCreatedApp(null);

    // Reset profile fields
    setProfileFields({
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      email: userProfile?.email || '',
      phone: userProfile?.phone || '',
      country: userProfile?.country || '',
      state: userProfile?.state || '',
      institution: userProfile?.institution || '',
      course: userProfile?.course || '',
      fieldOfStudy: userProfile?.fieldOfStudy || '',
      educationLevel: userProfile?.educationLevel || '',
      yearLevel: userProfile?.yearLevel || '',
      gpa: userProfile?.gpa?.toString() || '',
      gpaScale: userProfile?.gpaScale?.toString() || '4.0',
      expectedGraduationDate: userProfile?.expectedGraduationDate?.slice(0, 10) || '',
      careerGoals: userProfile?.careerGoals || '',
    });

    // Load requirements + fresh documents
    async function loadReqs() {
      setIsLoadingReqs(true);
      try {
        const [reqs, fresh] = await Promise.all([
          fetchScholarshipRequiredDocs(scholarship!.id),
          fetchUserDocuments(userProfile?.id || ''),
        ]);

        // If no relational reqs, fall back to the TEXT[] column
        const effectiveReqs = reqs.length > 0 ? reqs : (scholarship!.requiredDocuments || []).map((name, i) => ({
          id: `legacy-${i}`,
          scholarshipId: scholarship!.id,
          documentTypeId: `legacy-${i}`,
          documentTypeName: name,
          documentTypeSlug: name.toLowerCase().replace(/\s+/g, '-'),
          isRequired: true,
          sortOrder: i,
        }));

        const docsToUse = fresh.length > 0 ? fresh : documents;
        setFreshDocs(docsToUse);

        const readiness = computeApplicationReadiness(effectiveReqs, docsToUse);
        setDocItems(readiness.items);
      } finally {
        setIsLoadingReqs(false);
      }
    }
    loadReqs();
  }, [isOpen, scholarship?.id, userProfile?.id]);

  if (!isOpen || !scholarship) return null;

  const eligibility = evaluateEligibility(scholarship, userProfile);
  const requiredItems = docItems.filter((i) => i.isRequired);
  const availableCount = requiredItems.filter((i) => i.status === 'available').length;
  const missingCount = requiredItems.length - availableCount;
  const readinessPct = requiredItems.length > 0
    ? Math.round((availableCount / requiredItems.length) * 100)
    : 100;

  // Allow student to swap a document
  const handleSwapDoc = (typeId: string, newDoc: StoredDocument | null) => {
    setDocItems((prev) => prev.map((item) =>
      item.documentTypeId === typeId
        ? { ...item, matchedDocument: newDoc, status: newDoc ? (newDoc.status === 'expired' ? 'expired' : 'available') : 'missing' }
        : item
    ));
  };

  const handleSubmitApplication = async () => {
    if (!userProfile) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setStep('submitting');

    try {
      const notes = `Applied via ScholarPath on ${new Date().toLocaleDateString()}.`;

      // Create or find existing application
      let appId: string | null = null;
      let newApp: Application | null = null;

      try {
        const res = await api.post<Application>('/student/applications', {
          scholarshipId: scholarship.id,
          notes,
          status: 'Applied',
          appliedAt: new Date().toISOString(),
        });
        if (res?.id) { newApp = res; appId = res.id; }
      } catch {}

      if (!newApp) {
        newApp = StorageService.createApplication(userProfile.id, scholarship, 'Applied', notes);
        appId = newApp.id;
      }

      // Save to Supabase directly if configured
      if (isSupabaseConfigured && appId) {
        // Build profile snapshot
        const profileSnapshot = { ...profileFields, capturedAt: new Date().toISOString() };

        // Build doc snapshots
        const docSnapshots = docItems
          .filter((i) => i.matchedDocument)
          .map((i) => ({
            documentId: i.matchedDocument!.id,
            documentTypeId: i.documentTypeId,
            documentTypeName: i.documentTypeName,
            originalFileName: i.matchedDocument!.name,
            fileFormat: i.matchedDocument!.fileFormat,
            fileSize: i.matchedDocument!.fileSize,
            storagePath: i.matchedDocument!.storagePath,
            statusAtSubmission: i.matchedDocument!.status,
            attachedAt: new Date().toISOString(),
          }));

        // Upsert application to Supabase
        await supabase.from('applications').upsert({
          id: appId,
          user_id: userProfile.id,
          scholarship_id: scholarship.id,
          scholarship_title: scholarship.title,
          provider_name: scholarship.providerName,
          deadline: scholarship.deadline,
          amount: scholarship.amount || 0,
          currency: scholarship.currency || 'USD',
          status: 'Applied',
          applied_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          notes,
          submitted_profile_snapshot: profileSnapshot,
          submitted_documents: docSnapshots,
        }, { onConflict: 'id' });

        // Attach application documents (snapshot)
        await attachApplicationDocuments(appId, docItems);

        // Save snapshot columns
        await saveSubmissionSnapshot(appId, profileSnapshot as Record<string, unknown>, docSnapshots);
      }

      if (newApp) {
        const finalApp: Application = {
          ...newApp,
          status: 'Applied',
          appliedAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
        };
        setCreatedApp(finalApp);
        onApplicationCreated?.(finalApp);
      }

      setStep('done');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setStep('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackAsPreparing = async () => {
    if (!userProfile) return;
    try {
      const notes = 'Added to application tracker for document preparation.';
      let newApp: Application | null = null;
      try {
        const res = await api.post<Application>('/student/applications', { scholarshipId: scholarship.id, notes });
        if (res?.id) newApp = res;
      } catch {}
      if (!newApp) newApp = StorageService.createApplication(userProfile.id, scholarship, 'Preparing', notes);
      onApplicationCreated?.(newApp);
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Apply for Scholarship</span>
              <h2 className="text-base font-bold text-slate-900 line-clamp-1 mt-0.5">{scholarship.title}</h2>
              <p className="text-[11px] text-slate-500">{scholarship.providerName}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
          {step !== 'submitting' && step !== 'done' && <StepIndicator current={step} />}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: profile ── */}
          {step === 'profile' && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <User size={14} className="text-indigo-600" />
                <span>Your Application Profile</span>
              </div>
              <p className="text-xs text-slate-500 -mt-3">
                Pre-filled from your profile. Review and adjust if needed before submission.
              </p>

              {/* Eligibility banner */}
              {eligibility.hardDisqualified ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span><strong>Not Eligible:</strong> {eligibility.hardDisqualificationReason}</span>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2 text-xs text-indigo-800">
                  <Sparkles size={14} className="shrink-0 text-indigo-600" />
                  <span>Eligibility match: <strong>{eligibility.score}%</strong> — {eligibility.summary}</span>
                </div>
              )}

              {/* Personal */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'First Name', key: 'firstName' },
                    { label: 'Last Name', key: 'lastName' },
                    { label: 'Email', key: 'email', type: 'email', span: 2 },
                    { label: 'Phone', key: 'phone' },
                    { label: 'Country', key: 'country' },
                    { label: 'State', key: 'state' },
                  ].map((f) => (
                    <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type || 'text'}
                        value={(profileFields as Record<string, string>)[f.key] || ''}
                        onChange={(e) => setProfileFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={INPUT_CLASS} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Academic */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Academic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Institution', key: 'institution', span: 2 },
                    { label: 'Course / Programme', key: 'course', span: 2 },
                    { label: 'Field of Study', key: 'fieldOfStudy' },
                    { label: 'Education Level', key: 'educationLevel' },
                    { label: 'Current Year / Level', key: 'yearLevel' },
                    { label: `GPA (/${profileFields.gpaScale})`, key: 'gpa', type: 'number' },
                  ].map((f) => (
                    <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type || 'text'}
                        step={f.type === 'number' ? '0.01' : undefined}
                        value={(profileFields as Record<string, string>)[f.key] || ''}
                        onChange={(e) => setProfileFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={INPUT_CLASS} />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expected Graduation</label>
                    <input type="date" value={profileFields.expectedGraduationDate}
                      onChange={(e) => setProfileFields((p) => ({ ...p, expectedGraduationDate: e.target.value }))}
                      className={INPUT_CLASS} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: documents ── */}
          {step === 'documents' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <FileText size={14} className="text-indigo-600" />
                <span>Documents for This Application</span>
              </div>

              {isLoadingReqs ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Matching your documents...</span>
                </div>
              ) : (
                <>
                  {/* Readiness bar */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span>Application Readiness</span>
                      <span className={readinessPct === 100 ? 'text-emerald-600' : missingCount > 0 ? 'text-amber-600' : 'text-indigo-600'}>
                        {readinessPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${readinessPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${readinessPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {readinessPct === 100
                        ? '✓ All required documents are ready for submission.'
                        : `You are missing ${missingCount} required document${missingCount > 1 ? 's' : ''}.`}
                    </p>
                  </div>

                  {/* Document items */}
                  {docItems.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No specific documents required for this scholarship.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docItems.map((item) => (
                        <DocRequirementRow
                          key={item.documentTypeId}
                          item={item}
                          allDocs={freshDocs}
                          onSwap={handleSwapDoc}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP: review ── */}
          {step === 'review' && (
            <div className="p-6 space-y-5">
              {/* Notice */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                <p className="font-semibold mb-0.5">External Provider Application</p>
                ScholarPath records your application. After submission, visit the provider's official portal to complete the external application process.
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Profile summary */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={13} className="text-indigo-600" /> Personal & Academic
                </h4>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                  {[
                    { label: 'Name', value: `${profileFields.firstName} ${profileFields.lastName}` },
                    { label: 'Email', value: profileFields.email },
                    { label: 'Phone', value: profileFields.phone || '—' },
                    { label: 'Country', value: profileFields.country || '—' },
                    { label: 'Institution', value: profileFields.institution || '—' },
                    { label: 'Field', value: profileFields.fieldOfStudy || '—' },
                    { label: 'Level', value: profileFields.educationLevel || '—' },
                    { label: 'GPA', value: profileFields.gpa ? `${profileFields.gpa} / ${profileFields.gpaScale}` : '—' },
                  ].map((row) => (
                    <div key={row.label}>
                      <span className="text-slate-400 block">{row.label}</span>
                      <span className="font-semibold text-slate-800 truncate block">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents summary */}
              {docItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={13} className="text-indigo-600" /> Required Documents
                  </h4>
                  <div className="space-y-1.5">
                    {docItems.filter((i) => i.isRequired).map((item) => (
                      <div key={item.documentTypeId} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg border border-slate-100 bg-slate-50/50">
                        <span className="font-medium text-slate-800">{item.documentTypeName}</span>
                        {item.status === 'available' ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 size={13} /> {item.matchedDocument?.name}
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium flex items-center gap-1">
                            <AlertCircle size={13} /> Missing
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing warning */}
              {missingCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <p className="font-semibold mb-1">⚠ {missingCount} Required Document{missingCount > 1 ? 's' : ''} Missing</p>
                  <p>You can still submit your application tracker entry, but the external provider may require these documents.</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: submitting ── */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-sm font-semibold text-slate-700">Saving your application...</p>
              <p className="text-xs text-slate-400">Recording profile snapshot and document references</p>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Application Recorded!</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Your application has been saved with a snapshot of your current profile and documents. Now visit the official scholarship portal to complete your external submission.
              </p>
              <a
                href={scholarship.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <span>Continue to Official Portal</span>
                <ExternalLink size={13} />
              </a>
              <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 mt-2">
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'submitting' && step !== 'done' && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 shrink-0">
            <div>
              {step === 'profile' && (
                <button onClick={handleTrackAsPreparing}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  Track as Preparing
                </button>
              )}
              {(step === 'documents' || step === 'review') && (
                <button
                  onClick={() => setStep(step === 'documents' ? 'profile' : 'documents')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 'profile' && (
                <button
                  onClick={() => setStep('documents')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  Review Documents <ChevronRight size={14} />
                </button>
              )}
              {step === 'documents' && (
                <button
                  onClick={() => setStep('review')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  Review Application <ChevronRight size={14} />
                </button>
              )}
              {step === 'review' && (
                <button
                  onClick={handleSubmitApplication}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Shield size={14} />
                  Submit Application
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Document Requirement Row ──────────────────────────────────────────────────

interface DocRequirementRowProps {
  item: DocumentReadinessItem;
  allDocs: StoredDocument[];
  onSwap: (typeId: string, doc: StoredDocument | null) => void;
  onNavigate?: (path: string) => void;
}

const DocRequirementRow: React.FC<DocRequirementRowProps> = ({ item, allDocs, onSwap, onNavigate }) => {
  const [showSwap, setShowSwap] = useState(false);

  // All vault docs that could satisfy this type
  const candidates = allDocs.filter(
    (d) =>
      (d.documentTypeId && d.documentTypeId === item.documentTypeId) ||
      d.type?.toLowerCase().includes(item.documentTypeName.toLowerCase()) ||
      item.documentTypeName.toLowerCase().includes(d.type?.toLowerCase() || '')
  );

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          {item.status === 'available' ? (
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          ) : item.status === 'expired' ? (
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
          )}
          <div>
            <span className="text-xs font-semibold text-slate-900">{item.documentTypeName}</span>
            {item.isRequired && (
              <span className="ml-1.5 text-[10px] text-rose-600 font-bold">Required</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.matchedDocument ? (
            <>
              <span className="text-[11px] text-emerald-700 font-medium truncate max-w-[120px]">
                {item.matchedDocument.name}
              </span>
              <button
                onClick={() => setShowSwap((s) => !s)}
                className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                title="Change document"
              >
                <RefreshCw size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate?.('/documents')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <UploadCloud size={12} /> Upload
            </button>
          )}
        </div>
      </div>

      {/* Swap panel */}
      {showSwap && candidates.length > 0 && (
        <div className="border-t border-slate-100 bg-white p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Select a different document:</p>
          {candidates.map((doc) => (
            <button
              key={doc.id}
              onClick={() => { onSwap(item.documentTypeId, doc); setShowSwap(false); }}
              className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                item.matchedDocument?.id === doc.id
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'
              }`}
            >
              <FileText size={13} className="text-slate-400 shrink-0" />
              <span className="font-medium text-slate-800 truncate">{doc.name}</span>
              <span className="ml-auto text-slate-400 shrink-0">{doc.fileFormat?.toUpperCase()}</span>
            </button>
          ))}
          <button
            onClick={() => { onSwap(item.documentTypeId, null); setShowSwap(false); }}
            className="w-full text-left text-[11px] text-slate-400 hover:text-slate-600 p-1"
          >
            Remove selection
          </button>
        </div>
      )}
    </div>
  );
}
