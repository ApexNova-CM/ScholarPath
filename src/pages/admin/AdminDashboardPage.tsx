import React from 'react';
import { Scholarship, Provider, UserProfile, Application } from '../../types';
import { isScholarshipExpired } from '../../services/scholarshipFilters';
import { 
  ShieldCheck, Award, Clock, Users, PlusCircle, 
  CheckCircle2, XCircle, ArrowRight, Building2, 
  FileSpreadsheet, ExternalLink 
} from 'lucide-react';

interface AdminDashboardPageProps {
  scholarships: Scholarship[];
  providers: Provider[];
  users: UserProfile[];
  applications: Application[];
  onNavigate: (path: string) => void;
  onVerifyScholarship: (id: string) => void;
  onRejectScholarship: (id: string, reason: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  scholarships,
  providers,
  users,
  applications,
  onNavigate,
  onVerifyScholarship,
  onRejectScholarship
}) => {
  const verifiedCount = scholarships.filter(s => s.verificationStatus === 'verified').length;
  const pendingList = scholarships.filter(s => s.verificationStatus === 'pending_verification');
  const expiredCount = scholarships.filter(s => isScholarshipExpired(s)).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <ShieldCheck size={14} />
            <span>Admin Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Administrator Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Audit scholarship opportunities, verify official provider credentials, and monitor platform activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="admin-btn-quick-add"
            onClick={() => onNavigate('/admin/scholarships/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle size={15} />
            <span>Add Scholarship</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          onClick={() => onNavigate('/admin/scholarships')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-slate-500 block group-hover:text-indigo-600">Total Grants</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{scholarships.length}</div>
          <span className="text-[10px] text-slate-400">In database</span>
        </div>

        <div 
          onClick={() => onNavigate('/admin/scholarships?status=verified')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block">Verified ✓</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{verifiedCount}</div>
          <span className="text-[10px] text-slate-400">Publicly marked</span>
        </div>

        <div 
          onClick={() => onNavigate('/admin/verification')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-amber-600 block">Pending Review</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{pendingList.length}</div>
          <span className="text-[10px] text-slate-400">Needs audit</span>
        </div>

        <div 
          onClick={() => onNavigate('/admin/scholarships?status=expired')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 block group-hover:text-rose-600">Expired</span>
            <Clock size={13} className="text-slate-400 group-hover:text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-700 group-hover:text-rose-600 mt-1">{expiredCount}</div>
          <span className="text-[10px] text-slate-400">Past deadline</span>
        </div>

        <div 
          onClick={() => onNavigate('/admin/users')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-indigo-600 block">Students</span>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{users.length}</div>
          <span className="text-[10px] text-slate-400">Active accounts</span>
        </div>

        <div 
          onClick={() => onNavigate('/admin/applications')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-slate-500 block group-hover:text-indigo-600">Applications</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{applications.length}</div>
          <span className="text-[10px] text-slate-400">Tracked</span>
        </div>
      </div>

      {/* Verification Queue Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pending Verification Queue ({pendingList.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/admin/verification')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            <span>Open Verification Workspace</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {pendingList.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pendingList.map(sch => (
              <div key={sch.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{sch.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                      Requires Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Provider: <strong className="text-slate-800">{sch.providerName}</strong> • Value: <strong className="text-slate-800">${sch.amount.toLocaleString()}</strong> • Deadline: {new Date(sch.deadline).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-1 max-w-2xl">{sch.shortDescription}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={sch.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    title="Audit official URL"
                  >
                    <ExternalLink size={14} />
                  </a>

                  <button
                    id={`btn-verify-${sch.id}`}
                    onClick={() => onVerifyScholarship(sch.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>Verify ✓</span>
                  </button>

                  <button
                    id={`btn-reject-${sch.id}`}
                    onClick={() => onRejectScholarship(sch.id, 'Eligibility terms incomplete or provider unverified')}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <XCircle size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-slate-700">Verification queue is clear</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All submitted scholarships have been reviewed and audited.</p>
          </div>
        )}
      </div>

      {/* Grid: Providers Overview & Quick Management Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Providers */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 size={15} className="text-indigo-600" />
              <span>Provider Directory ({providers.length})</span>
            </h3>
            <button
              onClick={() => onNavigate('/admin/providers')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
            >
              View All
            </button>
          </div>

          <div className="space-y-2.5">
            {providers.slice(0, 4).map(p => (
              <div key={p.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{p.name}</span>
                  <span className="text-[11px] text-slate-500">{p.type} • {p.country}</span>
                </div>
                {p.verified ? (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Audited ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Standard</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Management Shortcuts */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
            Admin Operations
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <button
              onClick={() => onNavigate('/admin/scholarships')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left transition-colors group"
            >
              <Award size={18} className="text-indigo-600 mb-2 group-hover:scale-105 transition-transform" />
              <span className="font-bold text-slate-900 block">All Scholarships</span>
              <span className="text-[11px] text-slate-500">Filter, edit, or archive</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/admins')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left transition-colors group"
            >
              <ShieldCheck size={18} className="text-amber-600 mb-2 group-hover:scale-105 transition-transform" />
              <span className="font-bold text-slate-900 block">Admin Management</span>
              <span className="text-[11px] text-slate-500">Manage admin accounts</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/users')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left transition-colors group"
            >
              <Users size={18} className="text-blue-600 mb-2 group-hover:scale-105 transition-transform" />
              <span className="font-bold text-slate-900 block">Student Users</span>
              <span className="text-[11px] text-slate-500">View profiles & stats</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/applications')}
              className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 text-left transition-colors group"
            >
              <FileSpreadsheet size={18} className="text-emerald-600 mb-2 group-hover:scale-105 transition-transform" />
              <span className="font-bold text-slate-900 block">Applications Log</span>
              <span className="text-[11px] text-slate-500">Audit tracking progress</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
