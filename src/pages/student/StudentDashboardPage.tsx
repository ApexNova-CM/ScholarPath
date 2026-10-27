import React, { useEffect } from 'react';
import { UserProfile, Scholarship, Application, InAppNotification, APPLICANT_STAGE_LABELS } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { evaluateEligibility } from '../../services/eligibility';
import { computeLifecycleStatus } from '../../services/scholarshipFilters';
import { processDueScholarshipReminders } from '../../services/reminderService';
import { formatScholarshipAmount } from '../../utils/formatters';
import { ContactSupportModal } from '../../components/common/ContactSupportModal';
import { 
  Sparkles, GraduationCap, Search, ArrowRight, Briefcase, 
  CheckCircle2, Bookmark, FileText, Bell, Clock, Target, AlertCircle, UserCheck, HelpCircle
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
  const [isSupportModalOpen, setIsSupportModalOpen] = React.useState(false);
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

  const stageBadge = userProfile.applicantStage 
    ? APPLICANT_STAGE_LABELS[userProfile.applicantStage] 
    : 'Verified Scholar Profile';

  const profileSubtitle = React.useMemo(() => {
    const parts: React.ReactNode[] = [];
    
    if (userProfile.applicantStage === 'secondary') {
      if (userProfile.secondarySchoolName) {
        parts.push(<span key="school" className="font-medium text-[#0B1F46]">{userProfile.secondarySchoolName}</span>);
      }
      parts.push(<span key="stage">Secondary School</span>);
      if (userProfile.targetMajor || userProfile.fieldOfStudy) {
        parts.push(<span key="target">Focus: {userProfile.targetMajor || userProfile.fieldOfStudy}</span>);
      }
      if (userProfile.secondaryGraduationYear) {
        parts.push(<span key="grad">Class of {userProfile.secondaryGraduationYear}</span>);
      }
    } else if (userProfile.applicantStage === 'vocational') {
      if (userProfile.institution) {
        parts.push(<span key="inst" className="font-medium text-[#0B1F46]">{userProfile.institution}</span>);
      }
      parts.push(<span key="stage">Vocational & Technical</span>);
      if (userProfile.tradeSpecialization) {
        parts.push(<span key="spec">Trade: {userProfile.tradeSpecialization}</span>);
      }
    } else if (userProfile.applicantStage === 'early_career') {
      if (userProfile.institution) {
        parts.push(<span key="inst" className="font-medium text-[#0B1F46]">{userProfile.institution}</span>);
      }
      parts.push(<span key="stage">Early Career / Graduate</span>);
      if (userProfile.targetIndustry) {
        parts.push(<span key="ind">Industry: {userProfile.targetIndustry}</span>);
      }
      if (userProfile.yearsOfExperience !== undefined && userProfile.yearsOfExperience !== null) {
        parts.push(<span key="yoe">{userProfile.yearsOfExperience} yr{userProfile.yearsOfExperience === 1 ? '' : 's'} exp</span>);
      }
    } else {
      // Undergraduate / Postgraduate / Legacy
      if (userProfile.institution) {
        parts.push(<span key="inst" className="font-medium text-[#0B1F46]">{userProfile.institution}</span>);
      }
      if (userProfile.educationLevel) {
        parts.push(<span key="lvl">{userProfile.educationLevel}</span>);
      }
      if (userProfile.fieldOfStudy) {
        parts.push(<span key="field">{userProfile.fieldOfStudy}</span>);
      }
    }
    
    if (userProfile.gpa) {
      parts.push(<span key="gpa" className="text-[#155EEF] font-semibold">GPA {userProfile.gpa}</span>);
    }
    
    return parts;
  }, [userProfile]);

  // Dynamically set layout background to match the deep navy dashboard theme on mount, restore on unmount
  useEffect(() => {
    const main = document.querySelector('main');
    const layoutContainer = main?.parentElement;
    const originalBg = layoutContainer?.style.backgroundColor;
    if (layoutContainer) {
      layoutContainer.style.backgroundColor = '#0B1F46';
    }
    return () => {
      if (layoutContainer) {
        layoutContainer.style.backgroundColor = originalBg || '';
      }
    };
  }, []);

  return (
    <div className="-m-4 sm:-m-6 md:-m-8 lg:-m-10 p-4 sm:p-6 md:p-8 lg:p-10 bg-[#0B1F46] min-h-[calc(100vh-4rem)] space-y-8">
      {/* 1. WELCOME BANNER - Soft Cool Off-White Card (#F1F5F9) */}
      <div className="bg-[#F1F5F9] rounded-3xl p-6 sm:p-8 text-[#0B1F46] shadow-sm border border-[#E2E8F0] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E2E8F0] text-[#155EEF] border border-[#CBD5E1] flex items-center justify-center font-extrabold text-xl shrink-0">
              {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#155EEF]">
                  {stageBadge}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-700 font-medium">Active Cycle</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F46] leading-tight">
                Welcome back, {userProfile.firstName} {userProfile.lastName}
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] flex flex-wrap items-center gap-2 font-normal leading-relaxed">
                {profileSubtitle.length > 0 ? (
                  profileSubtitle.map((item, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span className="text-[#CBD5E1]">·</span>}
                      {item}
                    </React.Fragment>
                  ))
                ) : (
                  <span>Opportunities Within Reach</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="student-btn-ask-ai"
              onClick={() => onNavigate('/ai-assistant')}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-[#0B1F46] rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer border border-[#E2E8F0] shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#155EEF]" />
              <span>Ask AI Assistant</span>
            </button>
            <button
              id="student-btn-quick-explore"
              onClick={() => onNavigate('/scholarships')}
              className="px-5 py-2.5 bg-[#155EEF] hover:bg-[#1048C7] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Find Opportunities</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. STATISTICS - Soft Off-White Cards (#F1F5F9) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          onClick={() => onNavigate('/scholarships')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-[#155EEF] transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-[#155EEF]">Top Matches</span>
          <div className="text-2xl font-extrabold text-[#155EEF] mt-1">{topMatches.length}</div>
          <span className="text-[10px] text-[#475569] font-medium">50%+ compatibility</span>
        </div>

        <div 
          onClick={() => onNavigate('/saved')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-[#155EEF] transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-[#155EEF]">Saved Opportunities</span>
          <div className="text-2xl font-extrabold text-[#155EEF] mt-1">{savedScholarshipIds.length}</div>
          <span className="text-[10px] text-[#475569] font-medium">Shortlisted</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-amber-400 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-amber-600">Preparing</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{appCounts.preparing}</div>
          <span className="text-[10px] text-[#475569] font-medium">In drafting</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-indigo-400 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-indigo-600">Applied</span>
          <div className="text-2xl font-extrabold text-[#0B1F46] mt-1">{appCounts.applied}</div>
          <span className="text-[10px] text-[#475569] font-medium">Submissions</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-purple-400 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-purple-600">In Review</span>
          <div className="text-2xl font-extrabold text-purple-600 mt-1">{appCounts.underReview + appCounts.shortlisted + appCounts.interview}</div>
          <span className="text-[10px] text-[#475569] font-medium">Review & Shortlist</span>
        </div>

        <div 
          onClick={() => onNavigate('/applications')}
          className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
        >
          <span className="text-[11px] font-bold text-[#0B1F46] block group-hover:text-emerald-600">Awarded</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{appCounts.awarded}</div>
          <span className="text-[10px] text-[#475569] font-medium">Won grants</span>
        </div>
      </div>

      {/* Main Content Grid: Top Matches + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recommended For You - Surrounding Blue with Soft Off-White Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#F8FAFC] flex items-center gap-2">
              <Target size={17} className="text-[#93C5FD]" />
              <span>Recommended for You</span>
            </h2>
            <button
              onClick={() => onNavigate('/scholarships')}
              className="text-xs font-semibold text-[#F8FAFC] hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg border border-white/15 transition-colors cursor-pointer"
            >
              Explore All ({scholarships.length})
            </button>
          </div>

          {/* Profile completion nudge — shown when profile < 60% */}
          {isProfileLow && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F1F5F9] border border-[#E2E8F0] text-xs shadow-xs">
              <div className="flex items-start gap-2.5">
                <UserCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B1F46]">Complete your profile to improve your matches</p>
                  <p className="text-[#475569] mt-0.5 leading-relaxed font-normal">
                    Your profile is {completion}% complete. Adding your education or pathway details, interests, and location helps us find opportunities that truly fit you.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('/profile')}
                className="shrink-0 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Complete Profile
              </button>
            </div>
          )}

          {/* Recommendation disclaimer on navy */}
          <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
            Based on your profile · Scores reflect compatibility, not guaranteed eligibility. Always check full requirements before applying.
          </p>

          {topMatchesWithScores.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>div]:!bg-[#F1F5F9] [&>div]:!border-[#E2E8F0] [&_div.bg-slate-50\/80]:!bg-[#E2E8F0]/60">
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
            <div className="bg-[#F1F5F9] rounded-2xl border border-[#E2E8F0] p-8 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#E2E8F0] text-[#155EEF] mx-auto flex items-center justify-center">
                <Target size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#0B1F46]">No strong matches yet</p>
                <p className="text-xs text-[#475569] max-w-sm mx-auto leading-relaxed">
                  Complete more of your profile to discover opportunities that fit you — especially your pathway, field or trade, and location.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => onNavigate('/profile')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#155EEF] hover:bg-[#1048C7] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <UserCheck size={13} />
                  <span>Complete Profile</span>
                </button>
                <button
                  onClick={() => onNavigate('/scholarships')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#0B1F46] border border-[#E2E8F0] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Search size={13} />
                  <span>Browse All Scholarships</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Soft Off-White Cards & Panels (#F1F5F9) */}
        <div className="space-y-6">
          {/* AI Advisor Card - Soft Cool Off-White */}
          <div className="bg-[#F1F5F9] text-[#0B1F46] rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden border border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E2E8F0] text-[#155EEF] border border-[#CBD5E1] flex items-center justify-center">
                  <Sparkles size={14} className="text-[#155EEF]" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F46]">
                  Vona AI Assistant
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Ready
              </span>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed font-normal">
              Ask Vona about personalized matches, readiness gaps, essay drafts, career tips, or platform guidance.
            </p>
            <div className="pt-1">
              <button
                id="dashboard-ai-card-btn"
                onClick={() => onNavigate('/ai-assistant')}
                className="w-full py-2.5 px-3 bg-[#155EEF] hover:bg-[#1048C7] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Chat with Vona</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Upcoming Deadlines - Soft Cool Off-White Card */}
          <div className="bg-[#F1F5F9] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F46] flex items-center gap-1.5">
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
                    className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#155EEF]/50 bg-white hover:bg-slate-50 cursor-pointer transition-all space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0B1F46] line-clamp-1">{sch.title}</span>
                      <DeadlineBadge deadline={sch.deadline} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#475569]">
                      <span>{sch.providerName}</span>
                      <span className="font-semibold text-[#0B1F46]">{formatScholarshipAmount(sch)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#475569] py-2 text-center">No immediate deadlines closing.</p>
            )}
          </div>

          {/* Quick Notifications - Soft Cool Off-White Card */}
          <div className="bg-[#F1F5F9] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F46] flex items-center gap-1.5">
                <Bell size={14} className="text-[#155EEF]" />
                <span>Recent Updates</span>
              </h3>
              <button
                onClick={() => onNavigate('/notifications')}
                className="text-xs text-[#155EEF] hover:text-[#1048C7] font-semibold cursor-pointer"
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
                    className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs space-y-1 cursor-pointer transition-colors"
                  >
                    <span className="font-semibold text-[#0B1F46] block">{n.title}</span>
                    <p className="text-[11px] text-[#475569] leading-relaxed font-normal">{n.body || n.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#475569] py-2 text-center">All caught up! No unread notifications.</p>
            )}
          </div>

          {/* Document & Profile Readiness Widget - Soft Cool Off-White Card */}
          <div className="bg-[#F1F5F9] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F46]">
                <FileText size={15} className="text-[#155EEF]" />
                <span>Application Readiness</span>
              </div>
              <span className="text-xs font-bold text-[#155EEF]">{userProfile.profileCompletion || 0}%</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-semibold text-[#475569]">
                <span>Profile Completion</span>
                <span>{userProfile.profileCompletion || 0}%</span>
              </div>
              <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#155EEF] rounded-full transition-all duration-500"
                  style={{ width: `${userProfile.profileCompletion || 0}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs">
              <span className="text-[#475569] font-medium">Vault Documents</span>
              <span className="font-bold text-[#0B1F46]">{documents?.length || 0} File{(documents?.length || 0) === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onNavigate('/profile')}
                className="py-2 bg-white hover:bg-slate-50 text-[#0B1F46] border border-[#E2E8F0] rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Edit Profile
              </button>
              <button
                onClick={() => onNavigate('/documents')}
                className="py-2 bg-[#155EEF] hover:bg-[#1048C7] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center shadow-2xs"
              >
                Document Vault
              </button>
            </div>
          </div>

          {/* Help & Support Card - Soft Cool Off-White Card */}
          <div className="bg-[#F1F5F9] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F46]">
              <HelpCircle size={15} className="text-[#155EEF]" />
              <span>Need Help or Support?</span>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed font-normal">
              Have questions or feedback? Contact our support desk at{' '}
              <a href="mailto:support@scholavon.com" className="font-semibold text-[#155EEF] hover:underline">
                support@scholavon.com
              </a>.
            </p>
            <div className="pt-1">
              <button
                onClick={() => setIsSupportModalOpen(true)}
                className="w-full py-2 bg-white hover:bg-slate-50 text-[#0B1F46] border border-[#E2E8F0] rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                Contact Human Support
              </button>
            </div>
          </div>
        </div>
      </div>

      <ContactSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        defaultEmail={userProfile.email}
      />
    </div>
  );
};
