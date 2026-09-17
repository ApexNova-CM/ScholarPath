import React, { useState, useEffect } from 'react';
import { Application, ApplicationStatus, Scholarship, SubmittedDocumentSnapshot } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { fetchApplicationDocuments } from '../../services/documentService';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { 
  Briefcase, Plus, ExternalLink, Calendar, CheckCircle2, 
  Clock, AlertCircle, Trash2, Edit3, Save, X, Sparkles,
  FileText, ChevronDown, ChevronUp, Shield
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
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<ApplicationStatus>('Applied');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
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

  const statuses: ApplicationStatus[] = [
    'Interested',
    'Preparing',
    'Applied',
    'Under Review',
    'Interview',
    'Awarded',
    'Not Selected'
  ];

  const filteredApps = applications.filter(a => {
    if (selectedStatusFilter === 'all') return true;
    return a.status === selectedStatusFilter;
  });

  const handleStartEdit = (app: Application) => {
    setEditingAppId(app.id);
    setEditNotes(app.notes || '');
    setEditStatus(app.status);
  };

  const handleSaveEdit = async (app: Application) => {
    try {
      await api.patch(`/student/applications/${app.id}`, {
        status: editStatus,
        notes: editNotes,
      });
    } catch (e) {
      console.error('Failed to update application status via API:', e);
    }
    const updated = StorageService.updateApplicationStatus(app.id, editStatus, editNotes);
    if (updated) {
      onUpdateApplication(updated);
    }
    setEditingAppId(null);
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
            My Application Submissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Track milestones, interview stages, and notes for all your active scholarship applications.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/scholarships')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} />
          <span>Apply to New Scholarship</span>
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
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
            const isEditing = editingAppId === app.id;
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

                  <div className="flex items-center gap-2">
                    <DeadlineBadge deadline={app.deadline} size="sm" />
                    
                    {/* Status Badge or Editor */}
                    {isEditing ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as ApplicationStatus)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 focus:outline-hidden"
                      >
                        {statuses.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                        app.status === 'Awarded' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                        app.status === 'Interview' ? 'bg-purple-50 border-purple-200 text-purple-800' :
                        app.status === 'Under Review' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        app.status === 'Applied' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                        'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {app.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Application Date</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {new Date(app.appliedDate || app.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-400 block font-medium mb-1">Your Application Notes</span>
                    {isEditing ? (
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add interview reminders, portal login references, or submission milestones..."
                        rows={2}
                        className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 leading-relaxed italic">
                        {app.notes || 'No notes added yet.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2">
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

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(app.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <FileText size={13} className="text-indigo-600" />
                      <span>{expandedAppId === app.id ? 'Hide Details' : 'View Submitted Snapshot'}</span>
                      {expandedAppId === app.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingAppId(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(app)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Save size={13} />
                          <span>Save Changes</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(app)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Update Status & Notes</span>
                      </button>
                    )}
                  </div>
                </div>

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
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={14} className="text-indigo-600 shrink-0" />
                                <div className="truncate">
                                  <p className="font-semibold text-slate-800 truncate">{doc.originalFileName || doc.documentTypeName}</p>
                                  <p className="text-[10px] text-slate-400">{doc.documentTypeName}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Attached</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No document snapshot records found for this application.</p>
                      )}
                    </div>

                    {/* Profile Snapshot Details */}
                    {app.submittedProfileSnapshot && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                        <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Profile Used At Submission</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Name</span>
                            <span className="font-semibold text-slate-800">{String((app.submittedProfileSnapshot as any).firstName || '')} {String((app.submittedProfileSnapshot as any).lastName || '')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Institution</span>
                            <span className="font-semibold text-slate-800">{String((app.submittedProfileSnapshot as any).institution || '—')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Field of Study</span>
                            <span className="font-semibold text-slate-800">{String((app.submittedProfileSnapshot as any).fieldOfStudy || '—')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">GPA</span>
                            <span className="font-semibold text-slate-800">{String((app.submittedProfileSnapshot as any).gpa || '—')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            <Briefcase size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Applications In This Status</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            When you find a scholarship, click "Start Application" to prepare documents and record external submissions here.
          </p>
          <button
            onClick={() => onNavigate('/scholarships')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            Find Scholarships to Apply
          </button>
        </div>
      )}
    </div>
  );
};
