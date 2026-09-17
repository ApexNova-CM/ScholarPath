import React, { useState, useEffect, useMemo } from 'react';
import { Scholarship, Category } from '../../types';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { 
  isScholarshipExpired, isScholarshipUpcoming, isScholarshipActive 
} from '../../services/scholarshipFilters';
import { 
  Award, Search, PlusCircle, CheckCircle2, Clock, 
  Edit3, Archive, Calendar, Filter, ExternalLink, Trash2, AlertTriangle 
} from 'lucide-react';

interface AdminScholarshipsPageProps {
  scholarships: Scholarship[];
  categories: Category[];
  initialStatusFilter?: string;
  onNavigate: (path: string) => void;
  onVerifyScholarship: (id: string) => void;
  onUnverifyScholarship: (id: string) => void;
  onArchiveScholarship: (id: string) => void;
  onDeleteScholarship: (id: string) => void;
}

export const AdminScholarshipsPage: React.FC<AdminScholarshipsPageProps> = ({
  scholarships,
  categories,
  initialStatusFilter,
  onNavigate,
  onVerifyScholarship,
  onUnverifyScholarship,
  onArchiveScholarship,
  onDeleteScholarship
}) => {
  // Determine initial status filter from prop or URL
  const getInitialStatus = () => {
    if (initialStatusFilter) return initialStatusFilter;
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('status');
      if (s) return s;
    }
    return 'all';
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(getInitialStatus);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
  const [scholarshipToDelete, setScholarshipToDelete] = useState<Scholarship | null>(null);

  // Update filter if initialStatusFilter changes (e.g. navigation via sidebar)
  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  // Counts for pills
  const counts = useMemo(() => {
    const expired = scholarships.filter(s => isScholarshipExpired(s)).length;
    const upcoming = scholarships.filter(s => isScholarshipUpcoming(s)).length;
    const active = scholarships.filter(s => isScholarshipActive(s)).length;
    return {
      all: scholarships.length,
      active,
      upcoming,
      expired
    };
  }, [scholarships]);

  const filtered = useMemo(() => {
    return scholarships.filter(s => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = s.title.toLowerCase().includes(q) || 
                      s.providerName.toLowerCase().includes(q) ||
                      s.category.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'expired') {
        if (!isScholarshipExpired(s)) return false;
      } else if (statusFilter === 'upcoming') {
        if (!isScholarshipUpcoming(s)) return false;
      } else if (statusFilter === 'active') {
        if (!isScholarshipActive(s)) return false;
      } else if (statusFilter === 'draft') {
        if (s.status !== 'draft') return false;
      } else if (statusFilter === 'archived') {
        if (s.status !== 'archived') return false;
      }

      // 3. Verification Filter
      if (verifiedFilter === 'verified' && s.verificationStatus !== 'verified') return false;
      if (verifiedFilter === 'pending' && s.verificationStatus !== 'pending_verification') return false;
      if (verifiedFilter === 'unverified' && s.verificationStatus === 'verified') return false;

      return true;
    });
  }, [scholarships, search, statusFilter, verifiedFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <Award size={14} />
            <span>Scholarship Directory Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scholarship Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Browse, edit, audit verification status, or review expired and upcoming scholarships in the database.
          </p>
        </div>

        <button
          id="btn-add-scholarship-top"
          onClick={() => onNavigate('/admin/scholarships/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle size={15} />
          <span>Add New Scholarship</span>
        </button>
      </div>

      {/* Lifecycle Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          All ({counts.all})
        </button>

        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          Active ({counts.active})
        </button>

        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            statusFilter === 'upcoming'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          Upcoming ({counts.upcoming})
        </button>

        <button
          onClick={() => setStatusFilter('expired')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'expired'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Clock size={13} />
          <span>Expired ({counts.expired})</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, provider, or category..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified Only (✓)</option>
            <option value="pending">Pending Audit</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="expired">Expired</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
              <tr>
                <th className="px-5 py-3.5">Scholarship</th>
                <th className="px-4 py-3.5">Award</th>
                <th className="px-4 py-3.5">Deadline</th>
                <th className="px-4 py-3.5">Lifecycle</th>
                <th className="px-4 py-3.5">Verification</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length > 0 ? (
                filtered.map(s => {
                  const expired = isScholarshipExpired(s);
                  const upcoming = isScholarshipUpcoming(s);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div 
                          className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer flex items-center gap-2" 
                          onClick={() => onNavigate(`/admin/scholarships/${s.id}/edit`)}
                        >
                          <span>{s.title}</span>
                          {expired && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              Expired
                            </span>
                          )}
                          {upcoming && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {s.providerName} • {s.educationLevels[0] || 'All Levels'}
                        </div>
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {s.amountDisplay || (s.amount ? `${s.currency === 'NGN' ? '₦' : s.currency === 'GBP' ? '£' : s.currency === 'EUR' ? '€' : '$'}${s.amount.toLocaleString()}` : s.fundingType || 'Award varies')}
                        <span className="block text-[10px] font-normal text-slate-500">{s.fundingType}</span>
                      </td>

                      <td className="px-4 py-4">
                        <DeadlineBadge deadline={s.deadline} size="sm" />
                      </td>

                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          expired
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : upcoming
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.status === 'draft'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {expired ? 'Expired' : upcoming ? 'Upcoming' : s.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {s.verificationStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={12} /> Verified ✓
                          </span>
                        ) : s.verificationStatus === 'pending_verification' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Clock size={12} /> Pending Review
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Unverified</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {s.verificationStatus === 'verified' ? (
                            <button
                              onClick={() => onUnverifyScholarship(s.id)}
                              title="Revoke verified status"
                              className="px-2 py-1 rounded text-[11px] font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 cursor-pointer"
                            >
                              Revoke ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => onVerifyScholarship(s.id)}
                              title="Mark verified"
                              className="px-2 py-1 rounded text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 cursor-pointer"
                            >
                              Verify ✓
                            </button>
                          )}

                          <button
                            onClick={() => onNavigate(`/admin/scholarships/${s.id}/edit`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                            title="Edit scholarship"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => onArchiveScholarship(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                            title="Archive scholarship"
                          >
                            <Archive size={14} />
                          </button>

                          <button
                            onClick={() => setScholarshipToDelete(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Permanently delete scholarship"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <Clock size={28} className="text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No scholarships found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {statusFilter === 'expired' 
                        ? 'There are currently no expired scholarships matching your search criteria.' 
                        : 'Try adjusting your filters or search terms.'}
                    </p>
                    {statusFilter !== 'all' && (
                      <button
                        onClick={() => { setStatusFilter('all'); setSearch(''); }}
                        className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {scholarshipToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Scholarship</h3>
                <p className="text-xs text-slate-500 mt-0.5">Permanent administrative removal</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold mb-1 truncate">"{scholarshipToDelete.title}"</p>
              <p className="text-[11px] text-rose-700">
                Are you sure you want to permanently delete this scholarship? This action will remove the opportunity from the database, search results, and student matching. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setScholarshipToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteScholarship(scholarshipToDelete.id);
                  setScholarshipToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
