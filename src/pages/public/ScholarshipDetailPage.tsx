import React, { useState } from 'react';
import { Scholarship, UserProfile, StoredDocument, ScholarshipRequirementItem } from '../../types';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { MatchScore } from '../../components/common/MatchScore';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { LifecycleBadge } from '../../components/common/LifecycleBadge';
import { ApplicationReadinessCard } from '../../components/common/ApplicationReadinessCard';
import { PremiumGate } from '../../components/common/PremiumGate';
import { evaluateEligibility } from '../../services/eligibility';
import { evaluateScholarshipReadiness } from '../../services/documentService';
import { computeLifecycleStatus } from '../../services/scholarshipFilters';
import { 
  ArrowLeft, Bookmark, Calendar, DollarSign, GraduationCap, 
  MapPin, CheckCircle2, XCircle, FileText, ExternalLink, 
  ShieldCheck, Share2, AlertCircle, Info, Sparkles, Flag,
  Clock, Award, Layers, Check, Globe, HelpCircle, FileCheck, Coins
} from 'lucide-react';
import { ReportScholarshipModal } from '../../components/common/ReportScholarshipModal';

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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const scholarship = scholarships.find(s => s.id === scholarshipId);

  if (!scholarship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Scholarship Not Found</h2>
        <p className="text-xs text-slate-500">The scholarship you are looking for may have been archived or removed.</p>
        <button
          onClick={() => onNavigate('/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold bg-indigo-600 text-white px-4 py-2 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Browse All Scholarships</span>
        </button>
      </div>
    );
  }

  const eligibility = evaluateEligibility(scholarship, userProfile);
  const readiness = evaluateScholarshipReadiness(scholarship, userProfile, documents);
  const lifecycleStatus = computeLifecycleStatus(scholarship);
  const isClosed = lifecycleStatus === 'closed';
  const isArchived = lifecycleStatus === 'archived';
  const isInactive = isClosed || isArchived;

  const formattedAmount = scholarship.amountDisplay || scholarship.awardValueText || (
    scholarship.amount !== undefined && scholarship.amount !== null && scholarship.amount > 0
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: scholarship.currency || scholarship.awardCurrency || 'USD',
          maximumFractionDigits: 0
        }).format(scholarship.amount)
      : (scholarship.fundingType || 'Award varies')
  );

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Structured Requirements fallback / unification
  const structuredReqs: ScholarshipRequirementItem[] = scholarship.structuredRequirements && scholarship.structuredRequirements.length > 0
    ? scholarship.structuredRequirements
    : (scholarship.requiredDocuments || []).map((doc, i) => ({
        id: `req-legacy-${i}`,
        name: doc,
        required: true,
        isDocument: true,
        order: i + 1,
        acceptedFileTypes: ['PDF']
      }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <button
            id="btn-back-to-scholarships"
            onClick={() => onNavigate('/scholarships')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-semibold transition-colors shadow-2xs min-h-[44px] cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Scholarships</span>
          </button>
          <span className="text-slate-300 hidden sm:inline">/</span>
          {scholarship.category && (
            <button
              id="btn-breadcrumb-category"
              onClick={() => onNavigate(`/scholarships?category=${encodeURIComponent(scholarship.category)}`)}
              className="text-slate-600 hover:text-indigo-600 font-medium hidden sm:inline truncate max-w-[150px] cursor-pointer"
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
          >
            <Share2 size={13} />
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <button
            id="btn-detail-save"
            onClick={() => onToggleSave(scholarship.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors shadow-2xs min-h-[44px] cursor-pointer ${
              isSaved
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark size={14} className={isSaved ? 'fill-indigo-600' : ''} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            id="btn-detail-report"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/60 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
            title="Report inaccurate or broken scholarship information"
          >
            <Flag size={13} />
            <span className="hidden sm:inline">Report</span>
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className={`bg-white rounded-2xl border p-6 sm:p-8 shadow-xs ${isInactive ? 'border-slate-300 opacity-90' : 'border-slate-200/90'}`}>
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
          <LifecycleBadge scholarship={scholarship} size="md" hideActive />
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
            {scholarship.category}
          </span>
          {scholarship.scholarshipType && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
              {scholarship.scholarshipType}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
              {scholarship.title}
            </h1>
            <p className="text-sm font-semibold text-indigo-600 mt-1">
              {scholarship.providerName}
            </p>
          </div>
          {scholarship.providerLogo && (
            <img 
              src={scholarship.providerLogo} 
              alt={scholarship.providerName} 
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0" 
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
          )}
        </div>

        {/* Closed / Archived Banner */}
        {isInactive && (
          <div className={`mt-4 flex items-start gap-3 p-3.5 rounded-xl border text-sm ${
            isArchived
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <XCircle size={18} className={`shrink-0 mt-0.5 ${isArchived ? 'text-slate-500' : 'text-rose-600'}`} />
            <div>
              <p className="font-bold text-sm">
                {isArchived ? 'This scholarship has been archived' : 'This scholarship is no longer accepting applications'}
              </p>
              <p className="text-xs mt-0.5 opacity-80">
                {isArchived
                  ? 'It has been removed from active listings by an administrator and is no longer available.'
                  : 'The application window for this scholarship has closed. Check back later or explore other opportunities.'}
              </p>
            </div>
          </div>
        )}

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Award Value</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">{formattedAmount}</span>
            <span className="text-[11px] text-slate-500">{scholarship.awardType || scholarship.fundingType}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Application Deadline</span>
            <span className="text-sm font-bold text-slate-900 mt-1 block">
              {new Date(scholarship.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[11px] text-slate-500">{scholarship.deadlineTime || '23:59'} {scholarship.timezone || 'UTC'}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Education Level</span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block truncate">
              {scholarship.educationLevels?.join(', ') || 'All Levels'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-medium">Minimum GPA</span>
            <span className="text-sm font-semibold text-slate-900 mt-1 block">
              {scholarship.minimumGPA ? `${scholarship.minimumGPA.toFixed(2)} / ${(scholarship.gpaScale || 4.0).toFixed(1)}` : 'None specified'}
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              id="btn-detail-ask-ai"
              onClick={() => onNavigate(`/ai-assistant?scholarshipId=${scholarship.id}`)}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} className="text-indigo-600 animate-pulse" />
              <span>Ask AI</span>
            </button>

            <button
              id="btn-detail-open-workspace"
              onClick={() => onNavigate(`/student/applications/${scholarship.id}/workspace`)}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText size={14} />
              <span>Prepare Application</span>
            </button>

            {isInactive ? (
              <div className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-slate-100 text-slate-500 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200">
                <XCircle size={14} />
                <span>{isArchived ? 'Archived' : 'Applications Closed'}</span>
              </div>
            ) : (
              <button
                id="btn-detail-start-application"
                onClick={() => onStartApplication(scholarship)}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Start Application</span>
                <ExternalLink size={14} />
              </button>
            )}
          </div>
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
            {scholarship.tags && scholarship.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {scholarship.tags.map((t, idx) => (
                  <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Award Scope & What It Covers (Hidden if empty) */}
          {(scholarship.whatTheAwardCovers?.length || scholarship.awardDescription || scholarship.numberOfRecipients) && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins size={18} className="text-indigo-600" />
                <span>Award Benefits & Coverage</span>
              </h2>

              {scholarship.awardDescription && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {scholarship.awardDescription}
                </p>
              )}

              {scholarship.numberOfRecipients && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium flex items-center gap-2">
                  <Award size={15} className="text-indigo-600 shrink-0" />
                  <span>Number of Awardees: {scholarship.numberOfRecipients}</span>
                </div>
              )}

              {scholarship.whatTheAwardCovers && scholarship.whatTheAwardCovers.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700 block">Coverage Checklist:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scholarship.whatTheAwardCovers.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-800 font-medium">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Eligibility Breakdown (Hidden if minimal) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap size={18} className="text-indigo-600" />
              <span>Eligibility Overview</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Eligible Countries</span>
                <span className="font-semibold text-slate-800 block">
                  {!scholarship.eligibleCountries || scholarship.eligibleCountries.includes('All') ? 'Open to All Countries / International' : scholarship.eligibleCountries.join(', ')}
                </span>
              </div>

              {scholarship.countryOfStudy && scholarship.countryOfStudy.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block text-[11px]">Study Destination</span>
                  <span className="font-semibold text-slate-800 block">{scholarship.countryOfStudy.join(', ')}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Fields of Study</span>
                <span className="font-semibold text-slate-800 block">
                  {!scholarship.fieldsOfStudy || scholarship.fieldsOfStudy.includes('All') ? 'Open to Any Field of Study' : scholarship.fieldsOfStudy.join(', ')}
                </span>
              </div>

              {scholarship.academicStanding && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block text-[11px]">Academic Standing</span>
                  <span className="font-semibold text-slate-800 block">{scholarship.academicStanding}</span>
                </div>
              )}

              {(scholarship.minimumAge || scholarship.maximumAge) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block text-[11px]">Age Requirement</span>
                  <span className="font-semibold text-slate-800 block">
                    {scholarship.minimumAge && scholarship.maximumAge 
                      ? `${scholarship.minimumAge} – ${scholarship.maximumAge} years`
                      : scholarship.minimumAge ? `Minimum ${scholarship.minimumAge} years` : `Maximum ${scholarship.maximumAge} years`}
                  </span>
                </div>
              )}

              {scholarship.institutionTypes && scholarship.institutionTypes.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-slate-400 font-medium block text-[11px]">Institution Types</span>
                  <span className="font-semibold text-slate-800 block">{scholarship.institutionTypes.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Special Eligibility Highlights */}
            <div className="flex flex-wrap gap-2 pt-1">
              {scholarship.financialNeedRequired && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-amber-600" /> Financial Need Required
                </span>
              )}
              {scholarship.leadershipRequired && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-indigo-600" /> Leadership Record Required
                </span>
              )}
              {scholarship.communityServiceRequired && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Community Service Background
                </span>
              )}
              {scholarship.disabilityApplicable && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-purple-600" /> Priority for Persons with Disabilities
                </span>
              )}
            </div>

            {scholarship.otherEligibilityConditions && scholarship.otherEligibilityConditions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 block">Additional Eligibility Conditions:</span>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pl-1">
                  {scholarship.otherEligibilityConditions.map((cond, idx) => (
                    <li key={idx}>{cond}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Structured Requirements Checklist */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck size={18} className="text-indigo-600" />
                <span>Application Requirements Checklist</span>
              </h2>
              {userProfile && structuredReqs.length > 0 && (
                <span className="text-xs font-medium text-slate-500">
                  {documents.filter(d => structuredReqs.some(req => d.type.toLowerCase().includes(req.name.toLowerCase()) || req.name.toLowerCase().includes(d.type.toLowerCase()))).length} / {structuredReqs.length} In Vault
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {structuredReqs.map((req, idx) => {
                const hasDoc = documents.some(d => d.type.toLowerCase().includes(req.name.toLowerCase()) || req.name.toLowerCase().includes(d.type.toLowerCase()));
                return (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <FileText size={15} className="text-indigo-600 shrink-0" />
                        <span>{req.name}</span>
                        {req.required ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">Required</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-medium">Optional</span>
                        )}
                      </div>

                      {userProfile && req.isDocument && (
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-semibold flex items-center gap-1 ${hasDoc ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {hasDoc ? <><CheckCircle2 size={13} /> In Vault</> : <><AlertCircle size={13} /> Missing</>}
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

                    {req.description && (
                      <p className="text-[11px] text-slate-500 pl-6">{req.description}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {scholarship.otherRequirementsNotes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                <span className="font-semibold text-slate-700 block mb-0.5">Notes:</span>
                <p>{scholarship.otherRequirementsNotes}</p>
              </div>
            )}
          </div>

          {/* How to Apply & Repeatable Application Steps */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink size={18} className="text-indigo-600" />
              <span>How to Apply</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                Method: {scholarship.applicationMethod || 'External Website'}
              </span>
              {scholarship.applicationFee && (
                <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  Fee: {scholarship.applicationFee}
                </span>
              )}
              {scholarship.accountRequired && (
                <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  Registration Required
                </span>
              )}
            </div>

            {scholarship.applicationInstructions && (
              <p className="text-xs text-slate-600 leading-relaxed">
                {scholarship.applicationInstructions}
              </p>
            )}

            {/* Repeatable Steps List */}
            {scholarship.applicationSteps && scholarship.applicationSteps.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-800 block uppercase tracking-wide">Step-by-Step Instructions</span>
                <div className="space-y-2">
                  {scholarship.applicationSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {step.stepNumber || idx + 1}
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block">{step.title}</span>
                        {step.description && <p className="text-slate-600 text-[11px] leading-relaxed">{step.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portal Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={scholarship.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-2xs"
              >
                <span>Direct Application Portal</span>
                <ExternalLink size={13} />
              </a>

              {scholarship.officialWebsiteUrl && (
                <a
                  href={scholarship.officialWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors shadow-2xs"
                >
                  <span>Official Organization Website</span>
                  <Globe size={13} />
                </a>
              )}
            </div>
          </div>

          {/* Selection Process & Timeline (Hidden if empty) */}
          {(scholarship.selectionProcess || scholarship.selectionCriteria || (scholarship.selectionSteps && scholarship.selectionSteps.length > 0)) && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                <span>Selection Process & Review</span>
              </h2>

              {scholarship.selectionProcess && (
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {scholarship.selectionProcess}
                </p>
              )}

              {scholarship.selectionCriteria && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-900">Evaluation Criteria:</span>
                  <p>{scholarship.selectionCriteria}</p>
                </div>
              )}

              {/* Selection Process Stages */}
              {scholarship.selectionSteps && scholarship.selectionSteps.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-800 block uppercase tracking-wide">Evaluation Stages</span>
                  <div className="space-y-2">
                    {scholarship.selectionSteps.map((stage, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                          {stage.stageNumber || idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{stage.name}</span>
                          {stage.description && <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">{stage.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scholarship.shortlistingProcess && (
                <p className="text-[11px] text-slate-500 italic">
                  Shortlisting Note: {scholarship.shortlistingProcess}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Readiness & Compatibility */}
        <div className="space-y-6">
          {/* Application Readiness Card */}
          <ApplicationReadinessCard
            readiness={readiness}
            onNavigate={onNavigate}
            onStartApplication={() => onStartApplication(scholarship)}
          />

          {/* Why This Matches You Eligibility Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" />
                <span>Why This Matches You</span>
              </h2>
              {userProfile?.subscriptionStatus === 'premium' ? (
                <span className="text-xs font-bold text-indigo-600">{eligibility.score}% Match</span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Scholavon Plus
                </span>
              )}
            </div>

            {userProfile ? (
              <>
                {!eligibility.hardDisqualified && eligibility.status !== 'profile_incomplete' && (
                  <div className="flex items-center gap-2">
                    {eligibility.score >= 90 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 size={12} /> Excellent Match
                      </span>
                    )}
                    {eligibility.score >= 75 && eligibility.score < 90 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
                        <CheckCircle2 size={12} /> Strong Match
                      </span>
                    )}
                    {eligibility.score >= 50 && eligibility.score < 75 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        <AlertCircle size={12} /> Possible Match
                      </span>
                    )}
                    {(eligibility.hardDisqualified || eligibility.score < 50) && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                        <XCircle size={12} /> Low Compatibility
                      </span>
                    )}
                  </div>
                )}

                {eligibility.status === 'profile_incomplete' ? (
                  <div className="space-y-3 py-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {eligibility.summary}
                    </p>
                    <button
                      onClick={() => onNavigate('/profile')}
                      className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      Complete Profile to Improve Matches
                    </button>
                  </div>
                ) : (
                  <PremiumGate
                    userProfile={userProfile}
                    featureName="Detailed Eligibility & Criteria Breakdown"
                    featureDescription="Upgrade to Scholavon Plus to see your exact percentage match score, GPA gap analysis, and criteria-by-criteria breakdown."
                    onNavigate={onNavigate}
                  >
                    <div className="space-y-3.5">
                      {eligibility.criteria.map((c, i) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="flex items-center gap-2 font-semibold">
                            {c.met ? (
                              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                            ) : c.isHardRequirement ? (
                              <XCircle size={15} className="text-rose-600 shrink-0 stroke-[2.5]" />
                            ) : (
                              <AlertCircle size={15} className="text-amber-500 shrink-0 stroke-[2.5]" />
                            )}
                            <span className={c.met ? 'text-slate-900' : c.isHardRequirement ? 'text-rose-900' : 'text-amber-900'}>
                              {c.factor}
                            </span>
                          </div>
                          <p className={`pl-6 text-[11px] leading-relaxed ${c.met ? 'text-slate-500' : c.isHardRequirement ? 'text-rose-700 font-medium' : 'text-amber-700'}`}>
                            {c.detail}
                          </p>
                        </div>
                      ))}

                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Match scores are based on your profile and are not a guarantee of eligibility. Always review the full requirements before applying.
                        </p>
                        <button
                          onClick={() => onNavigate('/profile')}
                          className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1.5 cursor-pointer"
                        >
                          Edit Academic Profile
                        </button>
                      </div>
                    </div>
                  </PremiumGate>
                )}
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sign in with your student profile to evaluate exact requirements against your GPA, major, and degree level.
                </p>
                <button
                  onClick={() => onNavigate('/login')}
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Sign In to Check Match
                </button>
              </div>
            )}
          </div>

          {/* Verification & Trust Audit Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Verification Audit</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                {scholarship.verificationStatus === 'verified' ? 'Verified ✓' : 'Audited Source'}
              </span>
            </div>

            {scholarship.verifiedAt && (
              <p className="text-slate-600 text-[11px]">
                <strong className="text-slate-800">Last verified:</strong> {new Date(scholarship.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            {scholarship.verificationNotes && (
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                {scholarship.verificationNotes}
              </div>
            )}

            {scholarship.officialSourceUrl && (
              <a
                href={scholarship.officialSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 underline"
              >
                <span>View Official Source Proof</span>
                <ExternalLink size={11} />
              </a>
            )}

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Notice an issue with this scholarship?</span>
              <button
                id="btn-report-scholarship-inline"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                <Flag size={11} />
                <span>Report an Issue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <ReportScholarshipModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        scholarship={scholarship}
        userProfile={userProfile}
        onNavigate={onNavigate}
      />
    </div>
  );
};
