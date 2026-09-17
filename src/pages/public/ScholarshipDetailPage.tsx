import React, { useState } from 'react';
import { Scholarship, UserProfile, StoredDocument } from '../../types';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { MatchScore } from '../../components/common/MatchScore';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { evaluateEligibility } from '../../services/eligibility';
import { 
  ArrowLeft, Bookmark, Calendar, DollarSign, GraduationCap, 
  MapPin, CheckCircle2, XCircle, FileText, ExternalLink, 
  ShieldCheck, Share2, AlertCircle, Info, Sparkles 
} from 'lucide-react';

interface ScholarshipDetailPageProps {
  scholarshipId: string;
  scholarships: Scholarship[];
  userProfile: UserProfile | null;
  documents: StoredDocument[];
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onNavigate: (path: string) => void;
  onStartApplication: (sch: Scholarship) => void;
}

export const ScholarshipDetailPage: React.FC<ScholarshipDetailPageProps> = ({
  scholarshipId,
  scholarships,
  userProfile,
  documents,
  isSaved,
  onToggleSave,
  onNavigate,
  onStartApplication
}) => {
  const [copied, setCopied] = useState(false);

  const scholarship = scholarships.find(s => s.id === scholarshipId);

  if (!scholarship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Scholarship Not Found</h2>
        <p className="text-xs text-slate-500">The scholarship you are looking for may have been archived or removed.</p>
        <button
          onClick={() => onNavigate('/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold bg-indigo-600 text-white px-4 py-2 rounded-xl"
        >
          <ArrowLeft size={14} />
          <span>Browse All Scholarships</span>
        </button>
      </div>
    );
  }

  const eligibility = evaluateEligibility(scholarship, userProfile);

  const formattedAmount = scholarship.amountDisplay || (
    scholarship.amount !== undefined && scholarship.amount !== null && scholarship.amount > 0
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: scholarship.currency || 'USD',
          maximumFractionDigits: 0
        }).format(scholarship.amount)
      : 'Award varies'
  );

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <button
            id="btn-back-to-scholarships"
            onClick={() => onNavigate('/scholarships')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-semibold transition-colors shadow-2xs min-h-[44px]"
          >
            <ArrowLeft size={14} />
            <span>Back to Scholarships</span>
          </button>
          <span className="text-slate-300 hidden sm:inline">/</span>
          {scholarship.category && (
            <button
              id="btn-breadcrumb-category"
              onClick={() => onNavigate(`/scholarships?category=${encodeURIComponent(scholarship.category)}`)}
              className="text-slate-600 hover:text-indigo-600 font-medium hidden sm:inline truncate max-w-[150px]"
            >
              {scholarship.category}
            </button>
          )}
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-slate-800 font-semibold hidden sm:inline truncate max-w-[200px]">
            {scholarship.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-detail-share"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs min-h-[44px]"
          >
            <Share2 size={13} />
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <button
            id="btn-detail-save"
            onClick={() => onToggleSave(scholarship.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors shadow-2xs min-h-[44px] ${
              isSaved
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark size={14} className={isSaved ? 'fill-indigo-600' : ''} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          {scholarship.verificationStatus === 'verified' && (
            <VerifiedBadge 
              status="verified" 
              size="md" 
              showDetails={true} 
              verifiedAt={scholarship.verifiedAt} 
            />
          )}
          <DeadlineBadge deadline={scholarship.deadline} size="md" />
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
            {scholarship.category}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
          {scholarship.title}
        </h1>

        <p className="text-sm font-semibold text-indigo-600 mt-1">
          {scholarship.providerName}
        </p>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Award Value</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">{formattedAmount}</span>
            <span className="text-[11px] text-slate-500">{scholarship.fundingType}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Application Deadline</span>
            <span className="text-sm font-bold text-slate-900 mt-1 block">
              {new Date(scholarship.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[11px] text-slate-500">23:59 UTC</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Education Level</span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block truncate">
              {scholarship.educationLevels.join(', ') || 'All Levels'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Minimum GPA</span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block">
              {scholarship.minimumGPA ? `${scholarship.minimumGPA.toFixed(2)} / ${scholarship.gpaScale.toFixed(1)}` : 'None specified'}
            </span>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MatchScore result={eligibility} size="lg" />
            <span className="text-xs text-slate-600 font-medium">
              {eligibility.summary}
            </span>
          </div>

          <button
            id="btn-detail-start-application"
            onClick={() => onStartApplication(scholarship)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Start Application</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns (Details vs Eligibility Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Detailed Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900">About This Scholarship</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {scholarship.description}
            </p>
          </div>

          {/* Application Instructions */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900">Application Instructions</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {scholarship.applicationInstructions || 'Follow official instructions listed on the provider website.'}
            </p>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 flex items-center gap-2">
              <Info size={16} className="text-indigo-600 shrink-0" />
              <span>Official portal submissions are processed directly by {scholarship.providerName}.</span>
            </div>
          </div>

          {/* Required Documents */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Required Documents Checklist</h2>
              {userProfile && scholarship.requiredDocuments.length > 0 && (
                <span className="text-xs font-medium text-slate-500">
                  {documents.filter(d => scholarship.requiredDocuments.some(req => d.type.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(d.type.toLowerCase()))).length} / {scholarship.requiredDocuments.length} Ready
                </span>
              )}
            </div>
            <div className="space-y-2">
              {scholarship.requiredDocuments.map((doc, idx) => {
                const hasDoc = documents.some(d => d.type.toLowerCase().includes(doc.toLowerCase()) || doc.toLowerCase().includes(d.type.toLowerCase()));
                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <FileText size={15} className="text-indigo-600" />
                      <span>{doc}</span>
                    </div>
                    {userProfile && (
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${hasDoc ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {hasDoc ? <><CheckCircle2 size={13} /> Available in Vault</> : <><AlertCircle size={13} /> Missing</>}
                        </span>
                        {!hasDoc && (
                          <button
                            onClick={() => onNavigate('/documents')}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-200 cursor-pointer"
                          >
                            Upload
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Deterministic Eligibility Breakdown */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" />
                <span>Your Eligibility Breakdown</span>
              </h2>
              <span className="text-xs font-bold text-indigo-600">{eligibility.score}%</span>
            </div>

            {userProfile ? (
              <div className="space-y-3.5">
                {eligibility.criteria.map((c, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {c.met ? (
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                      ) : (
                        <XCircle size={15} className="text-rose-600 shrink-0 stroke-[2.5]" />
                      )}
                      <span className={c.met ? 'text-slate-900' : 'text-rose-900'}>
                        {c.factor}
                      </span>
                    </div>
                    <p className={`pl-6 text-[11px] leading-relaxed ${c.met ? 'text-slate-500' : 'text-rose-700 font-medium'}`}>
                      {c.detail}
                    </p>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate('/profile')}
                    className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1.5"
                  >
                    Edit Academic Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sign in with your student profile to evaluate exact requirements against your GPA, major, and degree level.
                </p>
                <button
                  onClick={() => onNavigate('/login')}
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Sign In to Check Match
                </button>
              </div>
            )}
          </div>

          {/* Verification & Trust Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>ScholarPath Transparency</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              We never collect application fees or claim automatic selection. This scholarship details page references validated criteria provided directly by accredited organizations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
