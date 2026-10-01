import React, { useState } from 'react';
import { Scholarship, UserProfile, ReportReason, ScholarshipReport } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { AlertTriangle, X, CheckCircle2, ShieldAlert, Flag, Loader2 } from 'lucide-react';

interface ReportScholarshipModalProps {
  scholarship: Scholarship | null;
  userProfile: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onReportSubmitted?: (report: ScholarshipReport) => void;
  onNavigate?: (path: string) => void;
}

const REPORT_REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'Scholarship has expired', label: 'Scholarship has expired', icon: '??' },
  { value: "Application link doesn't work", label: "Application link doesn't work", icon: '??' },
  { value: 'Information is incorrect', label: 'Information is incorrect', icon: '??' },
  { value: 'Eligibility requirements are incorrect', label: 'Eligibility requirements are incorrect', icon: '??' },
  { value: 'Award/funding information is incorrect', label: 'Award/funding information is incorrect', icon: '??' },
  { value: 'Scholarship appears suspicious', label: 'Scholarship appears suspicious', icon: '??' },
  { value: 'Deadline appears incorrect', label: 'Deadline appears incorrect', icon: '??' },
  { value: 'Other', label: 'Other', icon: '??' },
];

const MAX_DESCRIPTION_LENGTH = 1000;

export const ReportScholarshipModal: React.FC<ReportScholarshipModalProps> = ({
  scholarship,
  userProfile,
  isOpen,
  onClose,
  onReportSubmitted,
  onNavigate,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('Information is incorrect');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingReport, setExistingReport] = useState<boolean>(false);

  if (!isOpen || !scholarship) return null;

  const handleReasonChange = (reason: ReportReason) => {
    setSelectedReason(reason);
    setError(null);
    if (userProfile && scholarship) {
      const alreadyReported = StorageService.hasActiveReport(userProfile.id, scholarship.id, reason);
      setExistingReport(alreadyReported);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      setError('Please sign in to submit a scholarship report.');
      return;
    }

    // Input sanitization - strip any raw HTML tags
    const sanitizedDescription = description.replace(/<[^>]*>?/gm, '').trim();

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Check duplicate
      if (StorageService.hasActiveReport(userProfile.id, scholarship.id, selectedReason)) {
        setExistingReport(true);
        setError("You've already reported this issue.");
        setIsSubmitting(false);
        return;
      }

      // 2. Try submitting via API endpoint if available
      let newReport: ScholarshipReport | null = null;
      try {
        const res = await api.post<ScholarshipReport>('/student/reports', {
          scholarshipId: scholarship.id,
          reason: selectedReason,
          description: sanitizedDescription,
        });
        if (res && res.id) newReport = res;
      } catch {
        // Fall back to storage service
      }

      if (!newReport) {
        newReport = StorageService.createReport({
          scholarshipId: scholarship.id,
          scholarshipTitle: scholarship.title,
          providerName: scholarship.providerName,
          reporterUserId: userProfile.id,
          reporterName: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
          reporterEmail: userProfile.email,
          reason: selectedReason,
          description: sanitizedDescription,
        });
      }

      onReportSubmitted?.(newReport);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    setDescription('');
    setSelectedReason('Information is incorrect');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        id="report-scholarship-modal"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flag size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Report Scholarship</h2>
              <p className="text-xs text-slate-500">Help us keep Scholavon accurate and trustworthy.</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close report modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Report submitted</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Thanks for helping us keep Scholavon accurate. Our team will review this report.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  Done
                </button>
                {onNavigate && (
                  <button
                    onClick={() => {
                      handleClose();
                      onNavigate('/my-reports');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                  >
                    View My Reports
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Scholarship Snapshot */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Reporting:</span>
                <p className="font-bold text-slate-900 truncate mt-0.5">{scholarship.title}</p>
                <p className="text-slate-500 text-[11px]">{scholarship.providerName}</p>
              </div>

              {/* Error / Duplicate warning banner */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{error}</p>
                    {existingReport && onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          onNavigate('/my-reports');
                        }}
                        className="mt-1 text-[11px] font-bold underline text-rose-900 hover:text-rose-950 cursor-pointer"
                      >
                        View Report Status
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  What is wrong with this scholarship? <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {REPORT_REASONS.map((r) => {
                    const isSelected = selectedReason === r.value;
                    return (
                      <label
                        key={r.value}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={r.value}
                          checked={isSelected}
                          onChange={() => handleReasonChange(r.value)}
                          className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-sm">{r.icon}</span>
                        <span className="flex-1">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Additional Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="report-description" className="block text-xs font-bold text-slate-800">
                    Additional details <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <textarea
                  id="report-description"
                  rows={3}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what you noticed..."
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:bg-white resize-none"
                />
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Reports are reviewed by Scholavon administrators. Submitting a report does not immediately remove or change the scholarship.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || existingReport}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Report</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
