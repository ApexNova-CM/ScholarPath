import React, { useState } from 'react';
import { Application, ApplicationStatus, ApplicationOutcomeDetails, Scholarship, SubmittedDocumentSnapshot } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { fetchApplicationDocuments, evaluateScholarshipReadiness } from '../../services/documentService';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { ApplicationOutcomeModal } from '../../components/common/ApplicationOutcomeModal';
import { ApplicationHistoryTimeline } from '../../components/common/ApplicationHistoryTimeline';
import { useAuth } from '../../context/AuthContext';
import { 
  Briefcase, Plus, ExternalLink, Calendar, CheckCircle2, 
  Clock, AlertCircle, Edit3, Sparkles, FileText, ChevronDown, 
  ChevronUp, Shield, Trophy, XCircle, History
} from 'lucide-react';

interface ApplicationsPageProps {
  applications: Application[];
  scholarships: Scholarship[];
  onUpdateApplication: (app: Application) => void;
  onNavigate: (path: string) => void;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  applications,
  scholarships,
  onUpdateApplication,
  onNavigate
}) => {
  const { user } = useAuth();
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [outcomeModalApp, setOutcomeModalApp] = useState<Application | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [expandedHistoryAppId, setExpandedHistoryAppId] = useState<string | null>(null);
  const [appDocsMap, setAppDocsMap] = useState<Record<string, SubmittedDocumentSnapshot[]>>({});

  const toggleExpand = async (appId: string) => {
    if (expandedAppId === appId) {
      setExpandedAppId(null);
      return;
    }
    setExpandedAppId(appId);
    if (!appDocsMap[appId]) {
      const docs = await fetchApplicationDocuments(appId);
      setAppDocsMap(prev => ({ ...prev, [appId]: docs }));
    }
  };

  const toggleHistory = (appId: string) => {
    setExpandedHistoryAppId(prev => prev === appId ? null : appId);
  };

  const statuses: ApplicationStatus[] = [
    'Preparing',
    'Applied',
    'Under Review',
    'Shortlisted',
    'Interview',
    'Awarded',
    'Not Selected',
    'Withdrawn'
  ];

  const filteredApps = applications.filter(a => {
    if (selectedStatusFilter === 'all') return true;
    return a.status === selectedStatusFilter;
  });

  const handleSaveOutcome = async (
    applicationId: string,
    newStatus: ApplicationStatus,
    outcomeDetails?: ApplicationOutcomeDetails,
    newNotes?: string
  ) => {
    try {
      await api.patch(`/student/applications/${applicationId}`, {
        status: newStatus,
        notes: newNotes,
        outcomeDetails,
      });
    } catch (e) {
      console.error('Failed to update application status via API:', e);
    }
    const updated = StorageService.recordApplicationOutcome(
      applicationId,
      newStatus,
      outcomeDetails,
      newNotes,
      'student_updated'
    );
    if (updated) {
      onUpdateApplication(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Briefcase size={14} />
            <span>Applications Tracker</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Application Submissions & Outcomes
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Track milestones, interview stages, award notifications, and outcome histories for all your scholarships.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-apps-ask-ai"
            onClick={() => onNavigate('/ai-assistant')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200/80 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            <span>Ask AI</span>
          </button>

          <button
            onClick={() => {
              if (user?.subscriptionStatus !== 'premium' && applications.length >= 3) {
                onNavigate('/pricing');
              } else {
                onNavigate('/scholarships');
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Apply to New Scholarship</span>
          </button>
        </div>
      </div>

      {/* Free Plan Quota Warning */}
      {user?.subscriptionStatus !== 'premium' && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          applications.length >= 3 
            ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-2.5">
            <Briefcase size={16} className={applications.length >= 3 ? 'text-amber-600' : 'text-slate-500'} />
            <div>
              <span className="text-xs font-bold">
                Free Plan: {applications.length} / 3 Tracked Applications Used
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {applications.length >= 3
                  ? 'You have reached the free application tracking limit. Upgrade to Scholavon Plus to track unlimited scholarships.'
                  : 'Upgrade to Scholavon Plus for unlimited application tracking, essay draft workspaces, and outcome history.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('/pricing')}
            className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Upgrade to Unlimited
          </button>
        </div>
      )}

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            selectedStatusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Applications ({applications.length})
        </button>
        {statuses.map(s => {
          const count = applications.filter(a => a.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setSelectedStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                selectedStatusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Applications List */}
      {filteredApps.length > 0 ? (
        <div className="space-y-4">
          {filteredApps.map(app => {
            const sch = scholarships.find(s => s.id === app.scholarshipId);

            return (
              <div 
                key={app.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 
                      onClick={() => onNavigate(`/scholarships/${app.scholarshipId}`)}
                      className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors"
                    >
                      {app.scholarshipTitle}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {app.providerName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <DeadlineBadge deadline={app.deadline} size="sm" />
                    
                    {sch && user && app.status === 'Preparing' && (() => {
                      const readiness = evaluateScholarshipReadiness(sch, user);
                      if (!readiness.hasStructuredRequirements) return null;
                      return (
                        <span 
                          title={readiness.summary}
                          className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${readiness.categoryColors.bg} ${readiness.categoryColors.text} ${readiness.categoryColors.border}`}
                        >
                          🎓 {readiness.score}% Ready
                        </span>
                      );
                    })()}
                    
                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      app.status === 'Awarded' || app.status === 'Successful' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      app.status === 'Shortlisted' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                      app.status === 'Interview' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                      app.status === 'Under Review' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      app.status === 'Applied' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                      app.status === 'Not Selected' || app.status === 'Unsuccessful' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                      'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                </div>

                {/* Outcome Highlight Box if metadata exists */}
                {app.outcomeDetails && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                    {app.status === 'Awarded' && (
                      <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                        <Trophy size={14} className="text-emerald-600 shrink-0" />
                        <span>Awarded: {app.outcomeDetails.awardAmount ? `$${Number(app.outcomeDetails.awardAmount).toLocaleString()} ${app.outcomeDetails.awardCurrency || 'USD'}` : 'Confirmed'}</span>
                        {app.outcomeDetails.awardDuration && <span className="text-[11px] font-normal text-slate-500">({app.outcomeDetails.awardDuration})</span>}
                        {app.outcomeDetails.awardDate && <span className="text-[11px] font-normal text-slate-500">· {new Date(app.outcomeDetails.awardDate).toLocaleDateString()}</span>}
                      </div>
                    )}
                    {app.status === 'Shortlisted' && (
                      <div className="flex items-center gap-2 text-indigo-800 font-semibold">
                        <Sparkles size={14} className="text-indigo-600 shrink-0" />
                        <span>Shortlisted</span>
                        {app.outcomeDetails.nextStep && <span className="text-[11px] font-normal text-slate-600">· Next: {app.outcomeDetails.nextStep}</span>}
                        {app.outcomeDetails.nextStepDate && <span className="text-[11px] font-normal text-slate-500">({new Date(app.outcomeDetails.nextStepDate).toLocaleDateString()})</span>}
                      </div>
                    )}
                    {app.status === 'Interview' && (
                      <div className="flex items-center gap-2 text-purple-800 font-semibold">
                        <Calendar size={14} className="text-purple-600 shrink-0" />
                        <span>Interview Scheduled</span>
                        {app.outcomeDetails.interviewDate && <span className="text-[11px] font-normal text-slate-600">· {new Date(app.outcomeDetails.interviewDate).toLocaleDateString()}</span>}
                        {app.outcomeDetails.interviewLocation && <span className="text-[11px] font-normal text-slate-500">({app.outcomeDetails.interviewLocation})</span>}
                      </div>
                    )}
                    {app.status === 'Not Selected' && (
                      <div className="flex items-center gap-2 text-rose-800 font-semibold">
                        <XCircle size={14} className="text-rose-600 shrink-0" />
                        <span>Decision Received</span>
                        {app.outcomeDetails.rejectionDate && <span className="text-[11px] font-normal text-slate-500">· {new Date(app.outcomeDetails.rejectionDate).toLocaleDateString()}</span>}
                        {app.outcomeDetails.rejectionReason && <span className="text-[11px] font-normal text-slate-600">({app.outcomeDetails.rejectionReason})</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Body & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Application Date</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {new Date(app.appliedDate || app.appliedAt || app.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-400 block font-medium mb-1">Your Application Notes</span>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 leading-relaxed italic">
                      {app.notes || 'No notes added yet.'}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {sch?.applicationUrl ? (
                    <a
                      href={sch.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>Provider Portal</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <div />
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onNavigate(`/student/applications/${app.scholarshipId}/workspace`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                    >
                      <FileText size={13} />
                      <span>Workspace</span>
                    </button>

                    <button
                      onClick={() => toggleHistory(app.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <History size={13} className="text-indigo-600" />
                      <span>{expandedHistoryAppId === app.id ? 'Hide Timeline' : 'History'}</span>
                    </button>

                    <button
                      onClick={() => toggleExpand(app.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <FileText size={13} className="text-slate-500" />
                      <span>{expandedAppId === app.id ? 'Hide Snapshot' : 'Submission Snapshot'}</span>
                      {expandedAppId === app.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    <button
                      onClick={() => setOutcomeModalApp(app)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Update Outcome</span>
                    </button>
                  </div>
                </div>

                {/* History Timeline Panel */}
                {expandedHistoryAppId === app.id && (
                  <div className="pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl">
                    <ApplicationHistoryTimeline
                      history={app.statusHistory}
                      currentStatus={app.status}
                      createdAt={app.createdAt}
                    />
                  </div>
                )}

                {/* Submitted Snapshot Panel */}
                {expandedAppId === app.id && (
                  <div className="pt-4 border-t border-slate-100 space-y-3 bg-slate-50/50 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Shield size={14} className="text-indigo-600" />
                      <span>Submission Snapshot (Frozen at Submission)</span>
                    </div>

                    {/* Attached Documents */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Attached Documents</span>
                      {(appDocsMap[app.id] || app.submittedDocuments || []).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(appDocsMap[app.id] || app.submittedDocuments || []).map((doc, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs">
                              <FileText size={14} className="text-indigo-600 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">{doc.documentTypeName || doc.originalFileName}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No document snapshot captured for this submission.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <Briefcase size={28} className="text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No applications found in this filter</h3>
          <p className="text-xs text-slate-500">
            Change filter or discover new scholarships to apply.
          </p>
        </div>
      )}

      {/* Outcome Modal */}
      {outcomeModalApp && (
        <ApplicationOutcomeModal
          isOpen={Boolean(outcomeModalApp)}
          onClose={() => setOutcomeModalApp(null)}
          application={outcomeModalApp}
          onSaveOutcome={handleSaveOutcome}
        />
      )}
    </div>
  );
};
