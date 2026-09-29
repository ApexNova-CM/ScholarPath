import React, { useState } from 'react';
import { UserProfile, ScholarshipReport, ReportStatus } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { 
  Flag, Clock, CheckCircle2, AlertCircle, XCircle, 
  ExternalLink, Search, ArrowRight, Shield 
} from 'lucide-react';

interface MyReportsPageProps {
  userProfile?: UserProfile | null;
  onNavigate: (path: string) => void;
}

export const MyReportsPage: React.FC<MyReportsPageProps> = ({
  userProfile,
  onNavigate,
}) => {
  const { user } = useAuth();
  const activeUser = userProfile || user;
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const reports = activeUser ? StorageService.getUserReports(activeUser.id) : [];

  const filteredReports = reports.filter((r) => {
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.scholarshipTitle.toLowerCase().includes(q) ||
      r.providerName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock size={12} />
            <span>Pending Review</span>
          </span>
        );
      case 'Reviewing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <AlertCircle size={12} />
            <span>Investigating</span>
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} />
            <span>Resolved</span>
          </span>
        );
      case 'Dismissed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle size={12} />
            <span>Dismissed</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">
            <Flag size={14} />
            <span>Accuracy & Quality</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Scholarship Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Track the status of scholarship issue reports you have submitted to help keep ScholarPath verified.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/scholarships')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Search size={14} />
          <span>Browse Scholarships</span>
        </button>
      </div>

      {/* Filter Row */}
      {reports.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'Pending', 'Reviewing', 'Resolved', 'Dismissed'].map((st) => {
              const count = st === 'all' ? reports.length : reports.filter((r) => r.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    selectedStatus === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st === 'all' ? 'All Reports' : st} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Reports List */}
      {filteredReports.length > 0 ? (
        <div className="space-y-3.5">
          {filteredReports.map((rep) => (
            <div
              key={rep.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3 transition-all hover:border-slate-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <h3
                    onClick={() => onNavigate(`/scholarships/${rep.scholarshipId}`)}
                    className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors line-clamp-1"
                  >
                    {rep.scholarshipTitle}
                  </h3>
                  <p className="text-xs text-slate-500">{rep.providerName}</p>
                </div>
                <div>{getStatusBadge(rep.status)}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reported Issue</span>
                  <span className="font-semibold text-rose-700 mt-0.5 block">{rep.reason}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Submitted On</span>
                  <span className="font-medium text-slate-700 mt-0.5 block">
                    {new Date(rep.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Resolution Status</span>
                  <span className="font-medium text-slate-600 mt-0.5 block">
                    {rep.status === 'Resolved' && rep.resolvedAt
                      ? `Resolved on ${new Date(rep.resolvedAt).toLocaleDateString()}`
                      : rep.status === 'Dismissed' && rep.resolvedAt
                      ? `Reviewed on ${new Date(rep.resolvedAt).toLocaleDateString()}`
                      : rep.status === 'Reviewing'
                      ? 'Admin is actively reviewing'
                      : 'Awaiting administrator review'}
                  </span>
                </div>
              </div>

              {rep.description && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Your Notes:</span>
                  <p className="leading-relaxed whitespace-pre-line">{rep.description}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end">
                <button
                  onClick={() => onNavigate(`/scholarships/${rep.scholarshipId}`)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Scholarship Details</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <Flag size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {reports.length === 0 ? 'No reports yet' : 'No matching reports'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {reports.length === 0
                ? "You haven't reported any scholarship issues. If you notice incorrect information, broken links, or expired opportunities while searching, click 'Report Scholarship' on any details page."
                : 'Try adjusting your filters or search term to see other reports.'}
            </p>
          </div>
          {reports.length === 0 && (
            <button
              onClick={() => onNavigate('/scholarships')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <span>Explore Scholarships</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Transparency Note */}
      <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-3">
        <Shield size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          ScholarPath administrators review every community report to maintain trusted, vetted scholarship listings. Reports do not automatically take down scholarships until investigated.
        </p>
      </div>
    </div>
  );
};
