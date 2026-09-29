import React, { useState, useEffect } from 'react';
import { Application, ApplicationStatus, ApplicationOutcomeDetails } from '../../types';
import { 
  X, CheckCircle2, Trophy, Clock, AlertCircle, XCircle, 
  Calendar, DollarSign, MapPin, Sparkles, HelpCircle 
} from 'lucide-react';

interface ApplicationOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application | null;
  onSaveOutcome: (
    applicationId: string,
    status: ApplicationStatus,
    outcomeDetails?: ApplicationOutcomeDetails,
    notes?: string
  ) => void;
}

export const ApplicationOutcomeModal: React.FC<ApplicationOutcomeModalProps> = ({
  isOpen,
  onClose,
  application,
  onSaveOutcome,
}) => {
  if (!isOpen || !application) return null;

  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [notes, setNotes] = useState<string>(application.notes || '');

  // Outcome detail states
  const [shortlistDate, setShortlistDate] = useState<string>(
    application.outcomeDetails?.shortlistDate || new Date().toISOString().split('T')[0]
  );
  const [nextStep, setNextStep] = useState<string>(
    application.outcomeDetails?.nextStep || 'Interview'
  );
  const [nextStepDate, setNextStepDate] = useState<string>(
    application.outcomeDetails?.nextStepDate || ''
  );

  const [interviewDate, setInterviewDate] = useState<string>(
    application.outcomeDetails?.interviewDate || ''
  );
  const [interviewType, setInterviewType] = useState<'online' | 'in_person' | 'phone' | 'assessment'>(
    application.outcomeDetails?.interviewType || 'online'
  );
  const [interviewLocation, setInterviewLocation] = useState<string>(
    application.outcomeDetails?.interviewLocation || ''
  );
  const [interviewNotes, setInterviewNotes] = useState<string>(
    application.outcomeDetails?.interviewNotes || ''
  );

  const [awardDate, setAwardDate] = useState<string>(
    application.outcomeDetails?.awardDate || new Date().toISOString().split('T')[0]
  );
  const [awardAmount, setAwardAmount] = useState<number | undefined>(
    application.outcomeDetails?.awardAmount !== undefined ? application.outcomeDetails.awardAmount : application.amount
  );
  const [awardCurrency, setAwardCurrency] = useState<string>(
    application.outcomeDetails?.awardCurrency || application.currency || 'USD'
  );
  const [awardDuration, setAwardDuration] = useState<string>(
    application.outcomeDetails?.awardDuration || '1 academic year'
  );
  const [awardNotes, setAwardNotes] = useState<string>(
    application.outcomeDetails?.awardNotes || ''
  );

  const [rejectionDate, setRejectionDate] = useState<string>(
    application.outcomeDetails?.rejectionDate || new Date().toISOString().split('T')[0]
  );
  const [rejectionReason, setRejectionReason] = useState<string>(
    application.outcomeDetails?.rejectionReason || ''
  );
  const [rejectionNotes, setRejectionNotes] = useState<string>(
    application.outcomeDetails?.rejectionNotes || ''
  );

  const [withdrawnDate, setWithdrawnDate] = useState<string>(
    application.outcomeDetails?.withdrawnDate || new Date().toISOString().split('T')[0]
  );
  const [withdrawnReason, setWithdrawnReason] = useState<string>(
    application.outcomeDetails?.withdrawnReason || ''
  );

  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setNotes(application.notes || '');
      setShortlistDate(application.outcomeDetails?.shortlistDate || new Date().toISOString().split('T')[0]);
      setNextStep(application.outcomeDetails?.nextStep || 'Interview');
      setNextStepDate(application.outcomeDetails?.nextStepDate || '');
      setInterviewDate(application.outcomeDetails?.interviewDate || '');
      setInterviewType(application.outcomeDetails?.interviewType || 'online');
      setInterviewLocation(application.outcomeDetails?.interviewLocation || '');
      setInterviewNotes(application.outcomeDetails?.interviewNotes || '');
      setAwardDate(application.outcomeDetails?.awardDate || new Date().toISOString().split('T')[0]);
      setAwardAmount(application.outcomeDetails?.awardAmount !== undefined ? application.outcomeDetails.awardAmount : application.amount);
      setAwardCurrency(application.outcomeDetails?.awardCurrency || application.currency || 'USD');
      setAwardDuration(application.outcomeDetails?.awardDuration || '1 academic year');
      setAwardNotes(application.outcomeDetails?.awardNotes || '');
      setRejectionDate(application.outcomeDetails?.rejectionDate || new Date().toISOString().split('T')[0]);
      setRejectionReason(application.outcomeDetails?.rejectionReason || '');
      setRejectionNotes(application.outcomeDetails?.rejectionNotes || '');
      setWithdrawnDate(application.outcomeDetails?.withdrawnDate || new Date().toISOString().split('T')[0]);
      setWithdrawnReason(application.outcomeDetails?.withdrawnReason || '');
    }
  }, [application?.id, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const outcomeDetails: ApplicationOutcomeDetails = {
      ...(status === 'Shortlisted' ? { shortlistDate, nextStep, nextStepDate } : {}),
      ...(status === 'Interview' ? { interviewDate, interviewType, interviewLocation, interviewNotes } : {}),
      ...(status === 'Awarded' ? { awardDate, awardAmount, awardCurrency, awardDuration, awardNotes } : {}),
      ...(status === 'Not Selected' ? { rejectionDate, rejectionReason, rejectionNotes } : {}),
      ...(status === 'Withdrawn' ? { withdrawnDate, withdrawnReason } : {}),
    };

    onSaveOutcome(application.id, status, outcomeDetails, notes);
    onClose();
  };

  const statusOptions: { value: ApplicationStatus; label: string; icon: any }[] = [
    { value: 'Interested', label: 'Interested', icon: Clock },
    { value: 'Preparing', label: 'Preparing', icon: Clock },
    { value: 'Applied', label: 'Applied', icon: CheckCircle2 },
    { value: 'Under Review', label: 'Under Review', icon: Clock },
    { value: 'Shortlisted', label: 'Shortlisted', icon: Sparkles },
    { value: 'Interview', label: 'Interview Scheduled', icon: Calendar },
    { value: 'Awarded', label: 'Awarded 🎉', icon: Trophy },
    { value: 'Not Selected', label: 'Not Selected', icon: XCircle },
    { value: 'Withdrawn', label: 'Withdrawn', icon: AlertCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Update Application Outcome</h2>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{application.scholarshipTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {/* Status Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">Current Application Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Outcome Fields */}
          {status === 'Shortlisted' && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Sparkles size={14} className="text-indigo-600" />
                <span>Shortlist Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Shortlist Notification Date</label>
                  <input
                    type="date"
                    value={shortlistDate}
                    onChange={(e) => setShortlistDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Next Step</label>
                  <input
                    type="text"
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="e.g. Interview, Finalist Review"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'Interview' && (
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                <Calendar size={14} className="text-purple-600" />
                <span>Interview / Assessment Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Interview Date</label>
                  <input
                    type="date"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Format</label>
                  <select
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  >
                    <option value="online">Online / Zoom / Teams</option>
                    <option value="in_person">In-Person</option>
                    <option value="phone">Phone Call</option>
                    <option value="assessment">Written Assessment</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Location / Meeting Link</label>
                  <input
                    type="text"
                    value={interviewLocation}
                    onChange={(e) => setInterviewLocation(e.target.value)}
                    placeholder="e.g. https://zoom.us/j/... or Building B, Room 302"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'Awarded' && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Trophy size={14} className="text-emerald-600" />
                <span>Scholarship Award Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Award Date</label>
                  <input
                    type="date"
                    value={awardDate}
                    onChange={(e) => setAwardDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Award Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={awardAmount !== undefined ? awardAmount : ''}
                      onChange={(e) => setAwardAmount(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Amount"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                    />
                    <input
                      type="text"
                      value={awardCurrency}
                      onChange={(e) => setAwardCurrency(e.target.value)}
                      placeholder="USD"
                      className="w-20 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden uppercase"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Award Duration / Coverage</label>
                  <input
                    type="text"
                    value={awardDuration}
                    onChange={(e) => setAwardDuration(e.target.value)}
                    placeholder="e.g. 1 academic year, Full 4-year degree"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'Not Selected' && (
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <XCircle size={14} className="text-rose-600" />
                <span>Result Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Notification Date</label>
                  <input
                    type="date"
                    value={rejectionDate}
                    onChange={(e) => setRejectionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Reason / Feedback (Optional)</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Highly competitive pool"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {status === 'Withdrawn' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <AlertCircle size={14} className="text-slate-600" />
                <span>Withdrawal Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Withdrawn Date</label>
                  <input
                    type="date"
                    value={withdrawnDate}
                    onChange={(e) => setWithdrawnDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    value={withdrawnReason}
                    onChange={(e) => setWithdrawnReason(e.target.value)}
                    placeholder="e.g. Accepted another offer"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">Private Notes & Reflection</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any personal reflections, interview preparation, or next steps..."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Save Outcome
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
