import React, { useEffect } from 'react';
import { UserProfile, Scholarship, Application, InAppNotification } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { evaluateEligibility } from '../../services/eligibility';
import { computeLifecycleStatus } from '../../services/scholarshipFilters';
import { processDueScholarshipReminders } from '../../services/reminderService';
import { 
  Sparkles, GraduationCap, Search, ArrowRight, Briefcase, 
  CheckCircle2, Bookmark, FileText, Bell, Clock, Target, AlertCircle, UserCheck
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
  // Automatically process any due deadline reminders for the current student on dashboard load
  useEffect(() => {
    if (userProfile?.id) {
      processDueScholarshipReminders({ userProfile }).catch(() => {});
    }
  }, [userProfile?.id]);
  // Compute top matched scholarships — keep score alongside for badge rendering
  // Must exclude closed, archived, and rejected opportunities
  const topMatchesWithScores = [...scholarships]
    .filter(s => {
      if (s.status === 'archived' || s.status === 'rejected' || s.status === 'closed' || s.manuallyClosed === true) return false;
      const lifecycle = computeLifecycleStatus(s);
      return lifecycle !== 'closed' && lifecycle !== 'archived';
    })
    .map(s => ({
      scholarship: s,
      eligibility: evaluateEligibility(s, userProfile)
    }))
    .filter(item => !item.eligibility.hardDisqualified && item.eligibility.score >= 50)
    .sort((a, b) => b.eligibility.score - a.eligibility.score)
    .slice(0, 4);

  // Simple list for backward-compat (metric counter still uses length)
  const topMatches = topMatchesWithScores.map(item => item.scholarship);

  // Filter upcoming deadlines (closing within next 45 days, excluding closed/archived)
  const upcomingScholarships = [...scholarships]
    .filter(s => {
      if (s.status === 'archived' || s.status === 'rejected' || s.status === 'closed' || s.manuallyClosed === true) return false;
      const lifecycle = computeLifecycleStatus(s);
      if (lifecycle === 'closed' || lifecycle === 'archived') return false;
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
    shortlisted: applications.filter(a => a.status === 'Shortlisted').length,
    interview: applications.filter(a => a.status === 'Interview').length,
    awarded: applications.filter(a => a.status === 'Awarded').length,
    notSelected: applications.filter(a => a.status === 'Not Selected').length,
    withdrawn: applications.filter(a => a.status === 'Withdrawn').length
  };

  const unreadNotifs = notifications.filter(n => !n.read).slice(0, 3);

  // Profile completeness — used to show nudge banner
  const completion = userProfile.profileCompletion || 0;
  const isProfileLow = completion < 60;

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

        <div className="flex items-center gap-2.5">
          <button
            id="student-btn-ask-ai"
            onClick={() => onNavigate('/ai-assistant')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200/80 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            <span>Ask AI Assistant</span>
          </button>
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
          <span className="text-[10px] text-slate-400">50%+ compatibility</span>
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
          <div className="text-2xl font-extrabold text-purple-600 mt-1">{appCounts.underReview + appCounts.shortlisted + appCounts.interview}</div>
          <span className="text-[10px] text-slate-400">Review & Shortlist</span>
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
        {/* Left 2 Cols: Recommended For You */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Target size={16} className="text-indigo-600" />
              <span>Recommended for You</span>
            </h2>
            <button
              onClick={() => onNavigate('/scholarships')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Explore All ({scholarships.length})
            </button>
          </div>

          {/* Profile completion nudge — shown when profile < 60% */}
          {isProfileLow && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-xs">
              <div className="flex items-start gap-2.5">
                <UserCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Complete your profile to improve your matches</p>
                  <p className="text-amber-700 mt-0.5 leading-relaxed">
                    Your profile is {completion}% complete. Adding your field of study, GPA, and location helps us find scholarships that truly fit you.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('/profile')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
              >
                Complete Profile
              </button>
            </div>
          )}

          {/* Recommendation disclaimer */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Based on your profile · Scores reflect compatibility, not guaranteed eligibility. Always check full requirements before applying.
          </p>

          {topMatchesWithScores.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topMatchesWithScores.map(({ scholarship: sch, eligibility }) => (
                <ScholarshipCard
                  key={sch.id}
                  scholarship={sch}
                  userProfile={userProfile}
                  isSaved={savedScholarshipIds.includes(sch.id)}
                  onToggleSave={onToggleSave}
                  onViewDetails={(id) => onNavigate(`/scholarships/${id}`)}
                  onStartApplication={onStartApplication}
                  showMatchScore={true}
                  matchScore={eligibility.score}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 mx-auto flex items-center justify-center">
                <Target size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">No strong matches yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Complete more of your profile to discover scholarships that fit you — especially your field of study, education level, and location.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => onNavigate('/profile')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  <UserCheck size={13} />
                  <span>Complete Profile</span>
                </button>
                <button
                  onClick={() => onNavigate('/scholarships')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                >
                  <Search size={13} />
                  <span>Browse All Scholarships</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: AI Advisor + Deadlines & Notifications & Documents */}
        <div className="space-y-6">
          {/* AI Advisor Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden border border-indigo-800/40">
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center">
                  <Sparkles size={14} className="animate-pulse text-indigo-200" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Scholavon AI
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                Ready
              </span>
            </div>
            <p className="text-xs text-indigo-200/90 leading-relaxed">
              Ask about personalized matches, readiness gaps, deadline alerts, or next actions.
            </p>
            <div className="pt-1">
              <button
                id="dashboard-ai-card-btn"
                onClick={() => onNavigate('/ai-assistant')}
                className="w-full py-2 px-3 bg-white hover:bg-indigo-50 text-indigo-950 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Chat with AI Assistant</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

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
                  <div 
                    key={n.id} 
                    onClick={() => {
                      const target = n.link || (n.relatedScholarshipId ? `/scholarships/${n.relatedScholarshipId}` : '/notifications');
                      onNavigate(target);
                    }}
                    className="p-2.5 rounded-xl bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-100/60 text-xs space-y-1 cursor-pointer transition-colors"
                  >
                    <span className="font-semibold text-slate-900 block">{n.title}</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{n.body || n.message}</p>
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
