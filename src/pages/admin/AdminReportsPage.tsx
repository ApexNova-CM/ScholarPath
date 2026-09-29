import React, { useState, useEffect, useMemo } from 'react';
import { Scholarship, ScholarshipReport, ReportStatus, ReportReason } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { 
  Flag, AlertTriangle, CheckCircle2, Clock, XCircle, Search, 
  Eye, ExternalLink, Calendar, ShieldAlert, Sparkles, Check, X, AlertCircle
} from 'lucide-react';

interface AdminReportsPageProps {
  onNavigate: (path: string) => void;
}

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ScholarshipReport[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ScholarshipReport | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadData = () => {
    const loadedReports = StorageService.getReports();
    const loadedScholarships = StorageService.getScholarships();
    setReports(loadedReports);
    setScholarships(loadedScholarships);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute metrics
  const metrics = useMemo(() => {
    const pending = reports.filter(r => r.status === 'Pending').length;
    const reviewing = reports.filter(r => r.status === 'Reviewing').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    const dismissed = reports.filter(r => r.status === 'Dismissed').length;
    return {
      total: reports.length,
      pending,
      reviewing,
      resolved,
      dismissed
    };
  }, [reports]);

  // Group reports count by scholarship
  const scholarshipReportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach(r => {
      counts[r.scholarshipId] = (counts[r.scholarshipId] || 0) + 1;
    });
    return counts;
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.scholarshipTitle.toLowerCase().includes(q);
        const matchesProvider = r.providerName.toLowerCase().includes(q);
        const matchesUser = (r.reporterName?.toLowerCase().includes(q) || false) || (r.reporterEmail?.toLowerCase().includes(q) || false);
        const matchesDesc = r.description?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesProvider && !matchesUser && !matchesDesc) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, statusFilter, reasonFilter, searchQuery]);

  const handleOpenModeration = (report: ScholarshipReport) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
    setActionSuccessMessage(null);
  };

  const handleUpdateStatus = (newStatus: ReportStatus) => {
    if (!selectedReport) return;
    const adminObj = {
      id: user?.id || 'admin',
      name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Admin'
    };
    const updated = StorageService.updateReportStatus(selectedReport.id, newStatus, adminNotes, adminObj);
    if (updated) {
      setSelectedReport(updated);
      loadData();
      setActionSuccessMessage(`Report status updated to "${newStatus}".`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    }
  };

  const getReasonBadge = (reason: ReportReason) => {
    switch (reason) {
      case 'Scholarship has expired':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><Clock size={12} /> Expired Deadline</span>;
      case "Application link doesn't work":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle size={12} /> Broken Link</span>;
      case 'Information is incorrect':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><AlertCircle size={12} /> Inaccurate Info</span>;
      case 'Eligibility requirements are incorrect':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"><AlertCircle size={12} /> Wrong Eligibility</span>;
      case 'Award/funding information is incorrect':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><AlertCircle size={12} /> Wrong Award Value</span>;
      case 'Scholarship appears suspicious':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300 font-bold"><ShieldAlert size={12} /> Suspicious / Scam</span>;
      case 'Deadline appears incorrect':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><Calendar size={12} /> Wrong Deadline</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><Flag size={12} /> Other</span>;
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Pending':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"><Clock size={12} /> Pending Review</span>;
      case 'Reviewing':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200"><Sparkles size={12} /> In Review</span>;
      case 'Resolved':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><CheckCircle2 size={12} /> Resolved</span>;
      case 'Dismissed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300"><XCircle size={12} /> Dismissed</span>;
    }
  };

  const selectedScholarship = selectedReport ? scholarships.find(s => s.id === selectedReport.scholarshipId) : null;
  const relatedReportsForSelected = selectedReport ? reports.filter(r => r.scholarshipId === selectedReport.scholarshipId && r.id !== selectedReport.id) : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scholarship Reports & Moderation</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Admin Moderation
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review student-submitted flags regarding expired, broken, incorrect, or suspicious scholarships.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
        >
          Refresh Reports
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
        <AlertCircle size={18} className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-950 leading-relaxed">
          <strong className="font-semibold">Safety & Moderation Policy:</strong> User reports serve as moderation signals for admin review. Resolving or dismissing reports will NOT automatically delete or alter published scholarship listings. To edit scholarship details or revoke verification, use the Scholarship Catalog.
        </p>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setStatusFilter('Pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>Pending Review</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">{metrics.pending}</div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Awaiting initial inspection</p>
        </div>

        <div 
          onClick={() => setStatusFilter('Reviewing')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Reviewing'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200/80 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
            <span>Under Review</span>
            <Sparkles size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-2">{metrics.reviewing}</div>
          <p className="text-[11px] text-blue-700/80 mt-0.5">Actively being checked</p>
        </div>

        <div 
          onClick={() => setStatusFilter('Resolved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Resolved'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200/80 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>Resolved</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">{metrics.resolved}</div>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Addressed by team</p>
        </div>

        <div 
          onClick={() => setStatusFilter('Dismissed')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Dismissed'
              ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/30'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Dismissed</span>
            <XCircle size={16} className="text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{metrics.dismissed}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Non-actionable / invalid</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by scholarship, provider, student name, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses ({reports.length})</option>
              <option value="Pending">Pending Review ({metrics.pending})</option>
              <option value="Reviewing">In Review ({metrics.reviewing})</option>
              <option value="Resolved">Resolved ({metrics.resolved})</option>
              <option value="Dismissed">Dismissed ({metrics.dismissed})</option>
            </select>

            {/* Reason Filter */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Report Reasons</option>
              <option value="Scholarship has expired">Scholarship has expired</option>
              <option value="Application link doesn't work">Application link doesn't work</option>
              <option value="Information is incorrect">Information is incorrect</option>
              <option value="Eligibility requirements are incorrect">Eligibility requirements incorrect</option>
              <option value="Award/funding information is incorrect">Award/funding incorrect</option>
              <option value="Scholarship appears suspicious">Scholarship appears suspicious</option>
              <option value="Deadline appears incorrect">Deadline appears incorrect</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(statusFilter !== 'all' || reasonFilter !== 'all' || searchQuery.trim() !== '') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Active filters:</span>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-rose-600"><X size={12} /></button>
              </span>
            )}
            {reasonFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Reason: {reasonFilter}
                <button onClick={() => setReasonFilter('all')} className="hover:text-rose-600"><X size={12} /></button>
              </span>
            )}
            {searchQuery.trim() !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Query: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-rose-600"><X size={12} /></button>
              </span>
            )}
            <button
              onClick={() => { setStatusFilter('all'); setReasonFilter('all'); setSearchQuery(''); }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 ml-auto cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Reports Table / Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Reports Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {reports.length === 0 
                ? 'No student flags or scholarship reports have been submitted yet.' 
                : 'No reports match your selected search or filter criteria.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Scholarship & Provider</th>
                    <th className="py-3 px-4">Flag / Reason</th>
                    <th className="py-3 px-4">Reporter</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((report) => {
                    const totalCountForThis = scholarshipReportCounts[report.scholarshipId] || 1;
                    return (
                      <tr 
                        key={report.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          selectedReport?.id === report.id ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer line-clamp-1" onClick={() => handleOpenModeration(report)}>
                            {report.scholarshipTitle}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{report.providerName}</span>
                            {totalCountForThis > 1 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                                {totalCountForThis} reports on this scholarship
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getReasonBadge(report.reason)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{report.reporterName || 'Student User'}</div>
                          <div className="text-[11px] text-slate-400">{report.reporterEmail || 'No email'}</div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                          {new Date(report.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(report.status)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenModeration(report)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>Moderate</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredReports.map((report) => {
                const totalCountForThis = scholarshipReportCounts[report.scholarshipId] || 1;
                return (
                  <div key={report.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 text-xs line-clamp-2">
                          {report.scholarshipTitle}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {report.providerName}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(report.status)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {getReasonBadge(report.reason)}
                      {totalCountForThis > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                          {totalCountForThis} flags
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span>By {report.reporterName || 'Student User'}</span>
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>

                    <button
                      onClick={() => handleOpenModeration(report)}
                      className="w-full py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Review & Moderate</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Moderation Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-7 my-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Report #{selectedReport.id.slice(-6)}
                  </span>
                  {getStatusBadge(selectedReport.status)}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-2">
                  Moderation Details
                </h2>
              </div>

              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Success toast inside modal */}
            {actionSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{actionSuccessMessage}</span>
              </div>
            )}

            {/* Target Scholarship Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Scholarship</span>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {selectedReport.scholarshipTitle}
                  </h4>
                  <p className="text-xs text-indigo-600 font-semibold">{selectedReport.providerName}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate(`/scholarships/${selectedReport.scholarshipId}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ExternalLink size={12} />
                    <span>View Public Page</span>
                  </button>
                </div>
              </div>

              {selectedScholarship && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Category</span>
                    <span className="font-semibold text-slate-800">{selectedScholarship.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Deadline</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(selectedScholarship.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Verified Status</span>
                    <span className="font-semibold capitalize text-slate-800">{selectedScholarship.verificationStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Reports</span>
                    <span className="font-bold text-rose-600">
                      {scholarshipReportCounts[selectedReport.scholarshipId] || 1}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Reporter & Issue Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Report Reason</span>
                  <div>{getReasonBadge(selectedReport.reason)}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reporter Student</span>
                  <div className="text-xs font-bold text-slate-900">{selectedReport.reporterName || 'Student User'}</div>
                  <div className="text-[11px] text-slate-400">{selectedReport.reporterEmail || 'No email provided'}</div>
                </div>
              </div>

              {/* Student's Description */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Description & Context</span>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedReport.description || <em className="text-slate-400">No additional details provided by student.</em>}
                </p>
                <div className="text-[10px] text-slate-400 pt-2">
                  Submitted on {new Date(selectedReport.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Other reports for same scholarship if any */}
              {relatedReportsForSelected.length > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    Other Reports for this Scholarship ({relatedReportsForSelected.length})
                  </span>
                  <div className="space-y-1.5">
                    {relatedReportsForSelected.map((rel) => (
                      <div key={rel.id} className="text-[11px] flex items-center justify-between text-amber-950 bg-white/80 p-2 rounded-lg border border-amber-200/60">
                        <span><strong>{rel.reporterName || 'Student'}</strong>: {rel.reason}</span>
                        <span className="text-slate-500">{new Date(rel.createdAt).toLocaleDateString()} ({rel.status})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Resolution Notes Input */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-900">
                Admin Resolution Notes / Internal Log
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Document your verification steps, contact with provider, or rationale for resolution/dismissal..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {selectedReport.resolvedByAdminName && (
                <p className="text-[11px] text-slate-400">
                  Last resolved by <strong>{selectedReport.resolvedByAdminName}</strong> on {selectedReport.resolvedAt ? new Date(selectedReport.resolvedAt).toLocaleString() : 'N/A'}.
                </p>
              )}
            </div>

            {/* Status Change Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {selectedReport.status !== 'Reviewing' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('Reviewing')}
                    className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    Mark In Review
                  </button>
                )}

                {selectedReport.status !== 'Dismissed' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('Dismissed')}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Dismiss Report
                  </button>
                )}

                {selectedReport.status !== 'Resolved' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('Resolved')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Resolve Report</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
