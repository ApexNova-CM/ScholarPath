import React, { useState } from 'react';
import { Scholarship } from '../../types';
import { 
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
  ExternalLink, Calendar, DollarSign, FileCheck, ArrowLeft 
} from 'lucide-react';

interface AdminVerificationQueuePageProps {
  scholarships: Scholarship[];
  onNavigate: (path: string) => void;
  onVerifyScholarship: (id: string) => void;
  onRejectScholarship: (id: string, reason: string) => void;
}

export const AdminVerificationQueuePage: React.FC<AdminVerificationQueuePageProps> = ({
  scholarships,
  onNavigate,
  onVerifyScholarship,
  onRejectScholarship
}) => {
  const pendingScholarships = scholarships.filter(
    s => s.verificationStatus === 'pending_verification'
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    pendingScholarships[0]?.id || null
  );

  // Six Pillar Checklist state for selected scholarship
  const [checklist, setChecklist] = useState({
    providerLegitimate: true,
    urlOfficial: true,
    deadlineValid: true,
    rulesClear: true,
    documentsListed: true,
    noApplicationFee: true
  });

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const activeScholarship = scholarships.find(s => s.id === selectedId);

  const allChecksPassed = Object.values(checklist).every(Boolean);

  const handleApprove = () => {
    if (!activeScholarship) return;
    onVerifyScholarship(activeScholarship.id);
    const remaining = pendingScholarships.filter(s => s.id !== activeScholarship.id);
    setSelectedId(remaining[0]?.id || null);
  };

  const handleReject = () => {
    if (!activeScholarship) return;
    onRejectScholarship(activeScholarship.id, rejectReason || 'Failed verification audit guidelines');
    const remaining = pendingScholarships.filter(s => s.id !== activeScholarship.id);
    setSelectedId(remaining[0]?.id || null);
    setShowRejectInput(false);
    setRejectReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <ShieldCheck size={14} />
            <span>Verification Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scholarship Verification Audit Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Carefully audit submission credentials against the 6-factor legitimacy checklist before granting the ✓ Verified badge.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/admin/dashboard')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>
      </div>

      {pendingScholarships.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: List of items needing verification */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 block mb-2">
              Queue ({pendingScholarships.length} Pending)
            </span>

            <div className="space-y-1.5">
              {pendingScholarships.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id);
                    setShowRejectInput(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-colors border cursor-pointer ${
                    selectedId === s.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xs font-bold block truncate">{s.title}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                    {s.providerName} • ${s.amount.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right 2 Columns: Audit Workspace */}
          {activeScholarship ? (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 space-y-6 shadow-xs">
              {/* Scholarship Summary Header */}
              <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Audit Subject
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">{activeScholarship.title}</h2>
                  <p className="text-xs text-slate-600">
                    Provider: <strong className="text-slate-900">{activeScholarship.providerName}</strong> • Category: {activeScholarship.category}
                  </p>
                </div>

                <a
                  href={activeScholarship.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-indigo-600 flex items-center gap-1.5 self-start"
                >
                  <span>Open Application URL</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Snapshot Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Funding</span>
                  <span className="text-slate-900 font-bold">${activeScholarship.amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Deadline</span>
                  <span className="text-slate-900 font-bold">{activeScholarship.deadline.split('T')[0]}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Min. GPA</span>
                  <span className="text-slate-900 font-bold">{activeScholarship.minimumGPA || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Education Level</span>
                  <span className="text-slate-900 font-bold truncate">{activeScholarship.educationLevels[0]}</span>
                </div>
              </div>

              {/* Six Pillar Verification Checklist */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Six-Point Audit Checklist
                </h3>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.providerLegitimate}
                      onChange={(e) => setChecklist({ ...checklist, providerLegitimate: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">1. Provider organization exists and has accredited institutional legitimacy</span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.urlOfficial}
                      onChange={(e) => setChecklist({ ...checklist, urlOfficial: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">2. Official application URL resolves directly to legitimate endowment or university domain</span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.deadlineValid}
                      onChange={(e) => setChecklist({ ...checklist, deadlineValid: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">3. Application deadline is future-dated and actively accepting submissions</span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.rulesClear}
                      onChange={(e) => setChecklist({ ...checklist, rulesClear: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">4. Eligibility rules (GPA, degree, nationality) are unambiguous and transparent</span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.documentsListed}
                      onChange={(e) => setChecklist({ ...checklist, documentsListed: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">5. Required documents (transcripts, letters, essays) are explicitly specified</span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.noApplicationFee}
                      onChange={(e) => setChecklist({ ...checklist, noApplicationFee: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-slate-800">6. Mandatory Rule: Zero application fees are charged to applying students</span>
                  </label>
                </div>
              </div>

              {/* Rejection input */}
              {showRejectInput && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 animate-fade-in">
                  <label className="block text-xs font-bold text-rose-800">Reason for Rejection / Archive</label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Unofficial domain, hidden processing fees, or dead application link"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-rose-300 text-xs text-rose-900 focus:outline-hidden"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Decision Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <XCircle size={14} />
                  <span>Reject Opportunity</span>
                </button>

                <button
                  id="btn-audit-approve"
                  onClick={handleApprove}
                  disabled={!allChecksPassed}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
                    allChecksPassed
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>Approve & Grant Verified Status ✓</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/90">
              Select an opportunity to review.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center space-y-3 shadow-xs">
          <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">All Clear!</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            There are no pending scholarships awaiting audit. All opportunities in the directory have verified status.
          </p>
          <button
            onClick={() => onNavigate('/admin/scholarships')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            View Active Scholarships
          </button>
        </div>
      )}
    </div>
  );
};
