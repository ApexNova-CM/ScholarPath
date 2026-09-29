import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scholarship, UserProfile, StoredDocument, Application, 
  ApplicationStatus, ApplicationChecklistItem, ApplicationOutcomeDetails 
} from '../../types';
import { StorageService } from '../../services/storage';
import { evaluateEligibility, getMatchCategory, getMatchCategoryColors } from '../../services/eligibility';
import { 
  evaluateScholarshipReadiness, 
  getReadinessCategory, 
  getReadinessCategoryColors 
} from '../../services/documentService';
import { computeLifecycleStatus } from '../../services/scholarshipFilters';
import { calculateDaysUntilDeadline } from '../../services/reminderService';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { LifecycleBadge } from '../../components/common/LifecycleBadge';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { ReportScholarshipModal } from '../../components/common/ReportScholarshipModal';
import { ApplicationOutcomeModal } from '../../components/common/ApplicationOutcomeModal';
import { ApplicationHistoryTimeline } from '../../components/common/ApplicationHistoryTimeline';
import { 
  ArrowLeft, Bookmark, ExternalLink, CheckCircle2, AlertCircle, 
  XCircle, Clock, FileText, Sparkles, Plus, Trash2, Save, 
  Flag, Share2, Shield, Calendar, Edit3, HelpCircle, Check, 
  ChevronRight, Bell, ArrowUpRight, Lock, AlertTriangle, Trophy, History
} from 'lucide-react';

interface ApplicationWorkspacePageProps {
  scholarshipId: string;
  scholarships: Scholarship[];
  userProfile: UserProfile | null;
  documents: StoredDocument[];
  savedScholarshipIds: string[];
  onToggleSave: (id: string) => void;
  onNavigate: (path: string) => void;
  onUpdateApplication?: (app: Application) => void;
}

export const ApplicationWorkspacePage: React.FC<ApplicationWorkspacePageProps> = ({
  scholarshipId,
  scholarships,
  userProfile,
  documents,
  savedScholarshipIds,
  onToggleSave,
  onNavigate,
  onUpdateApplication,
}) => {
  const scholarship = scholarships.find((s) => s.id === scholarshipId);

  // Load or create application tracker record
  const [application, setApplication] = useState<Application | null>(() => {
    if (!userProfile || !scholarship) return null;
    return StorageService.getOrCreateApplication(userProfile.id, scholarship);
  });

  // Local draft states for notes and essay
  const [notes, setNotes] = useState<string>(application?.notes || '');
  const [essayDraft, setEssayDraft] = useState<string>(application?.essayDraft || '');
  const [essayStatus, setEssayStatus] = useState<'not_started' | 'drafting' | 'ready'>(
    application?.essayStatus || 'not_started'
  );
  const [essayNotes, setEssayNotes] = useState<string>(application?.essayNotes || '');
  const [newChecklistLabel, setNewChecklistLabel] = useState<string>('');
  const [saveStatusText, setSaveStatusText] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState<boolean>(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeReqCategory, setActiveReqCategory] = useState<string>('all');

  // Sync application state if props/user changes
  useEffect(() => {
    if (userProfile && scholarship) {
      const app = StorageService.getOrCreateApplication(userProfile.id, scholarship);
      setApplication(app);
      setNotes(app.notes || '');
      setEssayDraft(app.essayDraft || '');
      setEssayStatus(app.essayStatus || 'not_started');
      setEssayNotes(app.essayNotes || '');
    }
  }, [userProfile?.id, scholarship?.id]);

  // If scholarship not found
  if (!scholarship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Scholarship Not Found</h2>
        <p className="text-xs text-slate-500">
          The scholarship workspace you are trying to access does not exist or may have been removed.
        </p>
        <button
          onClick={() => onNavigate('/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Scholarships</span>
        </button>
      </div>
    );
  }

  const isSaved = savedScholarshipIds.includes(scholarship.id);
  const lifecycleStatus = computeLifecycleStatus(scholarship);
  const isClosed = lifecycleStatus === 'closed';
  const isArchived = lifecycleStatus === 'archived';
  const isInactive = isClosed || isArchived;

  // Real-time calculations from existing engines
  const eligibility = evaluateEligibility(scholarship, userProfile);
  const readiness = evaluateScholarshipReadiness(scholarship, userProfile, documents);
  const daysLeft = calculateDaysUntilDeadline(scholarship.deadline);

  const matchColors = getMatchCategoryColors(eligibility.score);
  const matchCategory = getMatchCategory(eligibility.score);

  const readinessColors = readiness.categoryColors;

  // Preparation Progress Breakdown
  const progressMetrics = useMemo(() => {
    const checklistItems = application?.checklist || [];
    const totalChecklist = checklistItems.length;
    const completedChecklist = checklistItems.filter((c) => c.completed).length;
    const checklistScore = totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 100;

    const docItems = readiness.items.filter((i) => i.category === 'Documents');
    const totalDocs = docItems.length;
    const readyDocs = docItems.filter((i) => i.status === 'complete').length;
    const docScore = totalDocs > 0 ? (readyDocs / totalDocs) * 100 : 100;

    const essayScore = essayStatus === 'ready' ? 100 : essayStatus === 'drafting' ? 50 : 0;
    const profileScore = readiness.items.filter((i) => i.category === 'Profile' && i.status === 'complete').length /
      Math.max(1, readiness.items.filter((i) => i.category === 'Profile').length) * 100;

    const overall = Math.round(
      checklistScore * 0.35 +
      docScore * 0.35 +
      essayScore * 0.15 +
      profileScore * 0.15
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      checklistScore: Math.round(checklistScore),
      completedChecklist,
      totalChecklist,
      docScore: Math.round(docScore),
      readyDocs,
      totalDocs,
      essayScore,
      profileScore: Math.round(profileScore),
    };
  }, [application?.checklist, readiness.items, essayStatus]);

  // Word & Character count for essay
  const essayWordCount = useMemo(() => {
    const trimmed = essayDraft.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [essayDraft]);

  // Handlers for persistence
  const handleToggleChecklistItem = (itemId: string) => {
    if (!application) return;
    const updated = StorageService.toggleApplicationChecklistItem(application.id, itemId);
    setApplication(updated);
    onUpdateApplication?.(updated);
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!application || !newChecklistLabel.trim()) return;
    const updated = StorageService.addApplicationChecklistItem(application.id, newChecklistLabel.trim());
    setApplication(updated);
    onUpdateApplication?.(updated);
    setNewChecklistLabel('');
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    if (!application) return;
    const updated = StorageService.deleteApplicationChecklistItem(application.id, itemId);
    setApplication(updated);
    onUpdateApplication?.(updated);
  };

  const handleSaveWorkspaceDraft = () => {
    if (!application) return;
    const updated = StorageService.updateApplication(application.id, {
      notes,
      essayDraft,
      essayStatus,
      essayNotes,
      workspaceLastSavedAt: new Date().toISOString(),
    });
    setApplication(updated);
    onUpdateApplication?.(updated);
    setSaveStatusText('All changes saved');
    setTimeout(() => setSaveStatusText(''), 3000);
  };

  const handleSaveOutcome = (
    applicationId: string,
    newStatus: ApplicationStatus,
    outcomeDetails?: ApplicationOutcomeDetails,
    newNotes?: string
  ) => {
    const updated = StorageService.recordApplicationOutcome(
      applicationId,
      newStatus,
      outcomeDetails,
      newNotes,
      'student_updated'
    );
    if (updated) {
      setApplication(updated);
      setNotes(updated.notes || '');
      onUpdateApplication?.(updated);
      setSaveStatusText(`Status updated to ${newStatus}`);
      setTimeout(() => setSaveStatusText(''), 3500);
    }
  };

  const handleMarkAsApplied = () => {
    if (!application) return;
    const updated = StorageService.updateApplication(application.id, {
      status: 'Applied',
      appliedAt: new Date().toISOString(),
      notes,
      workspaceLastSavedAt: new Date().toISOString(),
    });
    setApplication(updated);
    onUpdateApplication?.(updated);
    setSaveStatusText('Marked as Applied! Tracker updated.');
    setTimeout(() => setSaveStatusText(''), 4000);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredRequirements = useMemo(() => {
    if (activeReqCategory === 'all') return readiness.items;
    return readiness.items.filter((i) => i.category.toLowerCase() === activeReqCategory.toLowerCase());
  }, [readiness.items, activeReqCategory]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Top Navigation & Action Bar ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <button
            id="btn-workspace-back"
            onClick={() => onNavigate(`/scholarships/${scholarship.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-semibold transition-colors shadow-2xs cursor-pointer min-h-[44px]"
          >
            <ArrowLeft size={14} />
            <span>Back to Scholarship</span>
          </button>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-slate-800 font-semibold hidden sm:inline truncate max-w-[240px]">
            {scholarship.title}
          </span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
            Workspace
          </span>
        </div>

        <div className="flex items-center gap-2">
          {saveStatusText && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 mr-2 animate-fade-in">
              <Check size={14} />
              {saveStatusText}
            </span>
          )}

          <button
            id="btn-workspace-ask-ai"
            onClick={() => onNavigate(`/ai-assistant?scholarshipId=${scholarship.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer min-h-[44px]"
            title="Ask AI Assistant about this scholarship preparation"
          >
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            <span>Ask AI</span>
          </button>

          <button
            id="btn-workspace-save-draft"
            onClick={handleSaveWorkspaceDraft}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer min-h-[44px]"
          >
            <Save size={13} />
            <span>Save Progress</span>
          </button>

          <button
            id="btn-workspace-share"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer min-h-[44px]"
            title="Share workspace link"
          >
            <Share2 size={13} />
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>

          <button
            id="btn-workspace-bookmark"
            onClick={() => onToggleSave(scholarship.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors shadow-2xs cursor-pointer min-h-[44px] ${
              isSaved
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark size={14} className={isSaved ? 'fill-indigo-600' : ''} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            id="btn-workspace-report"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/60 transition-colors shadow-2xs cursor-pointer min-h-[44px]"
            title="Report inaccurate scholarship details"
          >
            <Flag size={13} />
            <span className="hidden sm:inline">Report</span>
          </button>
        </div>
      </div>

      {/* ── 2. Workspace Header Card ─────────────────────────────────────── */}
      <div className={`bg-white rounded-3xl border p-6 sm:p-8 shadow-xs space-y-6 ${
        isInactive ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {scholarship.verificationStatus === 'verified' && (
              <VerifiedBadge status="verified" size="md" showDetails={true} verifiedAt={scholarship.verifiedAt} />
            )}
            <DeadlineBadge deadline={scholarship.deadline} size="md" />
            <LifecycleBadge scholarship={scholarship} size="md" hideActive />
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
              {scholarship.category}
            </span>
          </div>

          {/* Current Application Status & Update Action */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              application?.status === 'Awarded' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              application?.status === 'Shortlisted' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
              application?.status === 'Interview' ? 'bg-purple-50 border-purple-200 text-purple-800' :
              application?.status === 'Under Review' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              application?.status === 'Applied' ? 'bg-blue-50 border-blue-200 text-blue-800' :
              application?.status === 'Not Selected' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              {application?.status || 'Preparing'}
            </span>

            <button
              onClick={() => setIsOutcomeModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Update Status</span>
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {scholarship.title}
          </h1>
          <p className="text-sm font-semibold text-indigo-600 mt-1">
            {scholarship.providerName}
          </p>
        </div>

        {/* Closed/Archived Banner */}
        {isInactive && (
          <div className={`flex items-start gap-3 p-4 rounded-2xl border text-sm ${
            isArchived ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">
                {isArchived ? 'Archived Scholarship' : 'Applications Closed'}
              </p>
              <p className="text-xs mt-0.5 opacity-90">
                {isArchived
                  ? 'This scholarship was archived by an admin. You can review your historical notes, outcomes, and documents, but external applications are no longer active.'
                  : 'The deadline for this opportunity has passed. You can reference your preparation workspace below.'}
              </p>
            </div>
          </div>
        )}

        {/* Key Info Banner Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Award Amount</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">
              {scholarship.amountDisplay || (scholarship.amount ? `$${scholarship.amount.toLocaleString()}` : 'Varies')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Official Deadline</span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              {new Date(scholarship.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Target Level</span>
            <span className="text-sm font-semibold text-slate-900 mt-0.5 block truncate">
              {scholarship.educationLevels.join(', ') || 'All Levels'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Countdown</span>
            <span className="text-sm font-bold text-indigo-700 mt-0.5 block">
              {daysLeft !== null && daysLeft >= 0 ? (daysLeft === 0 ? 'Due Today' : `${daysLeft} days remaining`) : 'Closed'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2B. Post-Submission Outcome & Milestone Card ──────────────────── */}
      {application?.status !== 'Interested' && application?.status !== 'Preparing' && (
        <div className="bg-white rounded-3xl border border-indigo-100 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
                Post-Submission Status
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Application Outcome: {application?.status}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOutcomeModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Edit Outcome Details</span>
              </button>
              <button
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <History size={13} className="text-indigo-600" />
                <span>{isHistoryExpanded ? 'Hide History' : 'View Timeline'}</span>
              </button>
            </div>
          </div>

          {/* Outcome Details Highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block font-medium">Submission Timestamp</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {application?.appliedAt || application?.appliedDate ? new Date(application.appliedAt || application.appliedDate!).toLocaleDateString() : 'Recorded'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block font-medium">Next Step / Guidance</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {application?.status === 'Shortlisted' ? `Interview prep: ${application.outcomeDetails?.nextStep || 'Follow-up'}` :
                 application?.status === 'Interview' ? `Interview on ${application.outcomeDetails?.interviewDate ? new Date(application.outcomeDetails.interviewDate).toLocaleDateString() : 'Scheduled'}` :
                 application?.status === 'Awarded' ? 'Congratulations! Award recorded.' :
                 application?.status === 'Under Review' ? 'Awaiting committee decision' :
                 'Outcome recorded'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block font-medium">Award / Decision</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {application?.outcomeDetails?.awardAmount ? `$${Number(application.outcomeDetails.awardAmount).toLocaleString()} (${application.outcomeDetails.awardDuration || 'Awarded'})` :
                 application?.outcomeDetails?.rejectionReason ? `Reason: ${application.outcomeDetails.rejectionReason}` :
                 'In progress'}
              </span>
            </div>
          </div>

          {/* Expanded History Timeline */}
          {isHistoryExpanded && (
            <div className="pt-4 border-t border-slate-100">
              <ApplicationHistoryTimeline
                history={application?.statusHistory}
                currentStatus={application?.status || 'Applied'}
                createdAt={application?.createdAt || new Date().toISOString()}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 3. Preparation Progress Meter ─────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
              Application Preparation
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Workspace Completion: {progressMetrics.overall}%
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
              {progressMetrics.overall === 100 ? '🎉 Application Ready' : `${progressMetrics.overall}% Prepared`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressMetrics.overall}%` }}
          />
        </div>

        {/* Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block font-medium">Checklist</span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {progressMetrics.completedChecklist} / {progressMetrics.totalChecklist} completed
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block font-medium">Required Documents</span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {progressMetrics.readyDocs} / {progressMetrics.totalDocs} available
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block font-medium">Personal Statement</span>
            <span className="font-bold text-slate-900 mt-0.5 block capitalize">
              {essayStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 block font-medium">Profile Fit</span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {eligibility.score}% Profile Match
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Match Score & Application Readiness Side-by-Side ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Score Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Profile Compatibility
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${matchColors.bg} ${matchColors.text} ${matchColors.border}`}>
                {matchCategory}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">
                🎯 {eligibility.score}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Personalized Match Score
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {eligibility.summary}
            </p>

            {/* Criteria summary */}
            <div className="space-y-2 pt-2">
              {eligibility.criteria.slice(0, 3).map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {c.met ? (
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : c.isHardRequirement ? (
                    <XCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-800">{c.factor}: </span>
                    <span className="text-slate-500">{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Evaluated against your verified student profile.</span>
            <button
              onClick={() => onNavigate('/profile')}
              className="font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Edit Profile →
            </button>
          </div>
        </div>

        {/* Application Readiness Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Submission Readiness
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${readinessColors.bg} ${readinessColors.text} ${readinessColors.border}`}>
                {readiness.category}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-slate-900">
                📋 {readiness.score}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Application Readiness
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {readiness.summary}
            </p>

            {/* Missing vs Complete summary */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-900">
                <span className="font-bold block text-sm">{readiness.completeCount}</span>
                <span className="text-[11px] text-emerald-700">Requirements Complete</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                readiness.missingCount > 0 ? 'bg-rose-50/70 border-rose-100 text-rose-900' : 'bg-slate-50 border-slate-100 text-slate-700'
              }`}>
                <span className="font-bold block text-sm">{readiness.missingCount}</span>
                <span className="text-[11px] opacity-80">Missing / Required</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Documents & verified profile fields ready.</span>
            <button
              onClick={() => onNavigate('/documents')}
              className="font-semibold text-emerald-600 hover:text-emerald-800"
            >
              Open Document Vault →
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Structured Requirements Section ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Structured Requirements</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live validation of required documents, academic criteria, and profile credentials.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['all', 'profile', 'academic', 'documents', 'other'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveReqCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  activeReqCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Requirements List */}
        <div className="space-y-3">
          {filteredRequirements.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No requirements found in this category.
            </p>
          ) : (
            filteredRequirements.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors gap-3"
              >
                <div className="flex items-start gap-3">
                  {req.status === 'complete' ? (
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : req.status === 'needs_review' ? (
                    <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{req.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium">
                        {req.category}
                      </span>
                      {req.isRequired && (
                        <span className="text-[10px] text-rose-600 font-semibold">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {req.description}
                    </p>
                  </div>
                </div>

                {req.actionLabel && req.actionPath && (
                  <button
                    onClick={() => onNavigate(req.actionPath!)}
                    className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 hover:text-indigo-800 text-xs font-semibold shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    {req.actionLabel} →
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 6. Personal Application Checklist ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Personal Application Checklist</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track tasks, documents, and preparation milestones for this specific scholarship.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {progressMetrics.completedChecklist} of {progressMetrics.totalChecklist} Done
          </span>
        </div>

        {/* Checklist items */}
        <div className="space-y-2.5">
          {(application?.checklist || []).map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${
                item.completed
                  ? 'bg-emerald-50/40 border-emerald-200/80 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleChecklistItem(item.id)}
                  className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <span className={`text-xs font-medium truncate ${item.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {item.label}
                </span>
              </label>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {item.custom && (
                  <button
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete custom task"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new personal task form */}
        <form onSubmit={handleAddChecklistItem} className="flex gap-2 pt-2">
          <input
            type="text"
            value={newChecklistLabel}
            onChange={(e) => setNewChecklistLabel(e.target.value)}
            placeholder="Add custom task (e.g. Request reference from Prof. Smith)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newChecklistLabel.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </form>
      </div>

      {/* ── 7. Document Vault Matching Section ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Document Vault Integration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Matching your uploaded Vault documents with this scholarship’s required files.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/documents')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <FileText size={14} />
            <span>Manage Document Vault</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scholarship.requiredDocuments.map((reqDoc, idx) => {
            const matched = documents.find((d) => {
              const dType = (d.type || d.documentTypeName || d.name || '').toLowerCase();
              const reqLower = reqDoc.toLowerCase();
              return (
                dType.includes(reqLower) ||
                reqLower.includes(dType) ||
                (reqLower.includes('transcript') && dType.includes('transcript')) ||
                (reqLower.includes('cv') && (dType.includes('cv') || dType.includes('resume'))) ||
                (reqLower.includes('recommendation') && dType.includes('recommendation')) ||
                (reqLower.includes('statement') && dType.includes('statement'))
              );
            });

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                  matched
                    ? 'bg-emerald-50/40 border-emerald-200/80'
                    : 'bg-rose-50/40 border-rose-200/80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {matched ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-rose-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900">{reqDoc}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6">
                    {matched
                      ? `Matched Vault file: "${matched.name}" (${matched.size || 'PDF'})`
                      : 'Missing in your Document Vault. Upload before applying.'}
                  </p>
                </div>

                {!matched && (
                  <button
                    onClick={() => onNavigate('/documents')}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 hover:border-rose-300 text-rose-700 text-[11px] font-semibold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Upload →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 8. Personal Statement / Essay Draft Preparation ───────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Personal Statement & Essay Draft</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft, polish, and store your scholarship essay or motivational statement.
            </p>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={essayStatus}
              onChange={(e) => setEssayStatus(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="not_started">Not Started</option>
              <option value="drafting">Drafting</option>
              <option value="ready">Ready for Submission</option>
            </select>
          </div>
        </div>

        {/* Essay Text Area */}
        <div className="space-y-2">
          <textarea
            rows={8}
            value={essayDraft}
            onChange={(e) => setEssayDraft(e.target.value)}
            placeholder="Type or paste your scholarship essay, personal statement, or response to provider prompts..."
            className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 leading-relaxed focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>{essayWordCount} words · {essayDraft.length} characters</span>
            <button
              onClick={handleSaveWorkspaceDraft}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>

      {/* ── 9. Private Preparation Notes ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">My Application Notes</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Private notes for interview questions, follow-ups, and special instructions.
          </p>
        </div>

        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Record notes (e.g. Contacted Dr. Miller for letter, interview scheduled for May 12th)..."
          className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 leading-relaxed focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
        />

        <div className="flex justify-end">
          <button
            onClick={handleSaveWorkspaceDraft}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Save Notes
          </button>
        </div>
      </div>

      {/* ── 10. Official Application Launch & Tracker Confirmation ────────── */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Application Submission
            </span>
            <h3 className="text-xl font-extrabold text-white">
              Official Provider Submission Portal
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              ScholarPath guides your preparation and verifies criteria. External applications must be submitted directly through the official provider portal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isInactive ? (
              <div className="px-5 py-3 rounded-2xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700 cursor-not-allowed">
                Applications Closed
              </div>
            ) : scholarship.applicationUrl ? (
              <a
                id="btn-apply-official-portal"
                href={scholarship.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-lg cursor-pointer"
              >
                <span>Apply on Official Website</span>
                <ExternalLink size={14} />
              </a>
            ) : (
              <div className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 text-xs font-medium">
                Application link unavailable
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Card */}
        <div className="pt-6 border-t border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-300">
            {application?.status === 'Applied' || (application?.status && application.status !== 'Preparing' && application.status !== 'Interested') ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 size={16} />
                Application status is currently <strong>{application.status}</strong>
              </span>
            ) : (
              <span>Have you submitted your application on the official website?</span>
            )}
          </div>

          {application?.status === 'Preparing' && !isInactive && (
            <button
              id="btn-workspace-mark-applied"
              onClick={handleMarkAsApplied}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Check size={14} className="text-emerald-600" />
              <span>Mark as Applied</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 11. Deadline Reminders Info (Feature #5 Integration) ──────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Bell size={15} className="text-indigo-600" />
            <span>Deadline Reminders Active</span>
          </div>
          <button
            onClick={() => onNavigate('/settings')}
            className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
          >
            Reminder Settings →
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Because this scholarship is tracked in your workspace, you will automatically receive In-App deadline alerts at 7 days, 3 days, 1 day, and on deadline day ({new Date(scholarship.deadline).toLocaleDateString()}).
        </p>
      </div>

      {/* ── 12. Modals (Report & Outcome) ─────────────────────────────────── */}
      <ReportScholarshipModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        scholarship={scholarship}
        userProfile={userProfile}
        onNavigate={onNavigate}
      />

      {application && (
        <ApplicationOutcomeModal
          isOpen={isOutcomeModalOpen}
          onClose={() => setIsOutcomeModalOpen(false)}
          application={application}
          onSaveOutcome={handleSaveOutcome}
        />
      )}
    </div>
  );
};
