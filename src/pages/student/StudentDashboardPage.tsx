import React from 'react';
import { UserProfile, Scholarship, Application, InAppNotification } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { evaluateEligibility } from '../../services/eligibility';
import { 
  Sparkles, GraduationCap, Search, ArrowRight, Briefcase, 
  CheckCircle2, Bookmark, FileText, Bell, Clock 
} from 'lucide-react';

interface StudentDashboardPageProps {
  userProfile: UserProfile;
  scholarships: Scholarship[];
  applications: Application[];
  notifications: InAppNotification[];
  savedScholarshipIds: string[];
  documents?: any[];
  onToggleSave: (id: string) => void;
  onNavigate: (path: string) => void;
  onStartApplication: (sch: Scholarship) => void;
}

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({
  userProfile,
  scholarships,
  applications,
  notifications,
  savedScholarshipIds,
  documents,
  onToggleSave,
  onNavigate,
  onStartApplication
}) => {
  // Compute top matched scholarships
  const topMatches = [...scholarships]
    .filter(s => s.status !== 'archived')
    .map(s => ({
      scholarship: s,
      eligibility: evaluateEligibility(s, userProfile)
    }))
    .filter(item => !item.eligibility.hardDisqualified && item.eligibility.score >= 60)
    .sort((a, b) => b.eligibility.score - a.eligibility.score)
    .slice(0, 4)
    .map(item => item.scholarship);

  // Filter upcoming deadlines (closing within next 45 days)
  const upcomingScholarships = [...scholarships]
    .filter(s => {
      const diff = (new Date(s.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 45;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);

  // Application status counts
  const appCounts = {
    total: applications.length,
    preparing: applications.filter(a => a.status === 'Preparing').length,
    applied: applications.filter(a => a.status === 'Applied').length,
    underReview: applications.filter(a => a.status === 'Under Review').length,
    interview: applications.filter(a => a.status === 'Interview').length,
    awarded: applications.filter(a => a.status === 'Awarded').length
  };

  const unreadNotifs = notifications.filter(n => !n.read).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Header matching Admin Portal UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <GraduationCap size={14} />
            <span>Student Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {userProfile.firstName}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Personalized scholarship matches, active application tracking, and verified deadlines in {userProfile.fieldOfStudy}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="student-btn-quick-explore"
            onClick={() => onNavigate('/scholarships')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Search size={15} />
            <span>Find Scholarships</span>
          </button>
        </div>
      </div>

      {/* Metrics Row matching Admin UI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          onClick={() => onNavigate('/scholarships')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-slate-500 block group-hover:text-indigo-600">Top Matches</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{topMatches.length}</div>
          <span className="text-[10px] text-slate-400">60%+ compatibility</span>
        </div>

        <div 
          onClick={() => onNavigate('/saved')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-indigo-600 block">Saved Grants</span>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{savedScholarshipIds.length}</div>
          <span className="text-[10px] text-slate-400">Shortlisted</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-amber-600 block">Preparing</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{appCounts.preparing}</div>
          <span className="text-[10px] text-slate-400">In drafting</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-slate-600 block group-hover:text-indigo-600">Applied</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{appCounts.applied}</div>
          <span className="text-[10px] text-slate-400">Submissions</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-purple-600 block">In Review</span>
          <div className="text-2xl font-extrabold text-purple-600 mt-1">{appCounts.underReview + appCounts.interview}</div>
          <span className="text-[10px] text-slate-400">Review & Interview</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block">Awarded</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{appCounts.awarded}</div>
          <span className="text-[10px] text-slate-400">Won grants</span>
        </div>
      </div>

      {/* Main Content Grid: Top Matches + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Top Matches */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <span>Top Matched Scholarships For You</span>
            </h2>
            <button
              onClick={() => onNavigate('/scholarships')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Explore All ({scholarships.length})
            </button>
          </div>

          {topMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topMatches.map(sch => (
                <ScholarshipCard
                  key={sch.id}
                  scholarship={sch}
                  userProfile={userProfile}
                  isSaved={savedScholarshipIds.includes(sch.id)}
                  onToggleSave={onToggleSave}
                  onViewDetails={(id) => onNavigate(`/scholarships/${id}`)}
                  onStartApplication={onStartApplication}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-3 shadow-2xs">
              <p className="text-xs text-slate-500">No scholarships matching 60%+ currently found for your profile criteria.</p>
              <button
                onClick={() => onNavigate('/scholarships')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                Browse All Scholarships
              </button>
            </div>
          )}
        </div>

        {/* Right Col: Deadlines & Notifications & Documents */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" />
                <span>Closing Soon (Next 45 Days)</span>
              </h3>
            </div>

            {upcomingScholarships.length > 0 ? (
              <div className="space-y-2.5">
                {upcomingScholarships.map(sch => (
                  <div 
                    key={sch.id}
                    onClick={() => onNavigate(`/scholarships/${sch.id}`)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-indigo-300 bg-slate-50/70 hover:bg-white cursor-pointer transition-all space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 line-clamp-1">{sch.title}</span>
                      <DeadlineBadge deadline={sch.deadline} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{sch.providerName}</span>
                      <span className="font-semibold text-slate-700">${sch.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2 text-center">No immediate deadlines closing.</p>
            )}
          </div>

          {/* Quick Notifications */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Bell size={14} className="text-indigo-600" />
                <span>Recent Updates</span>
              </h3>
              <button
                onClick={() => onNavigate('/notifications')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                View All
              </button>
            </div>

            {unreadNotifs.length > 0 ? (
              <div className="space-y-2">
                {unreadNotifs.map(n => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100/60 text-xs space-y-1">
                    <span className="font-semibold text-slate-900 block">{n.title}</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2 text-center">All caught up! No unread notifications.</p>
            )}
          </div>

          {/* Document & Profile Readiness Widget */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <FileText size={15} className="text-indigo-600" />
                <span>Application Readiness</span>
              </div>
              <span className="text-xs font-bold text-indigo-600">{userProfile.profileCompletion || 0}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                <span>Profile Completion</span>
                <span>{userProfile.profileCompletion || 0}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                  style={{ width: `${userProfile.profileCompletion || 0}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600">Vault Documents</span>
              <span className="font-bold text-slate-900">{documents?.length || 0} File{(documents?.length || 0) === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onNavigate('/profile')}
                className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Edit Profile
              </button>
              <button
                onClick={() => onNavigate('/documents')}
                className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Document Vault
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
