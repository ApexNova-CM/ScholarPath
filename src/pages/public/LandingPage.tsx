import React from 'react';
import { 
  Compass, Search, CheckCircle2, Shield, Sparkles, 
  Calendar, Briefcase, FileCheck, ArrowRight, UserCheck, 
  GraduationCap, Clock, Award, ChevronRight 
} from 'lucide-react';
import { Scholarship, UserProfile, Category } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { CategorySection } from '../../components/common/CategorySection';

interface LandingPageProps {
  scholarships: Scholarship[];
  userProfile: UserProfile | null;
  onNavigate: (path: string) => void;
  onToggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  onStartApplication: (sch: Scholarship) => void;
  categories?: Category[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  scholarships,
  userProfile,
  onNavigate,
  onToggleSave,
  isSaved,
  onStartApplication,
  categories
}) => {
  const allCategories = categories || [];

  // Take the verified scholarships for featured showcase
  const featured = scholarships
    .filter(s => s.verificationStatus === 'verified')
    .slice(0, 3);

  const handleSelectCategory = (categoryName: string) => {
    onNavigate(`/scholarships?category=${encodeURIComponent(categoryName)}`);
  };

  const verifiedCount = scholarships.filter(s => s.verificationStatus === 'verified').length;

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 md:pt-20 pb-16 bg-gradient-to-b from-indigo-50/60 via-slate-50 to-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <img
              src="/images/scholarpath-logo.png"
              alt="ScholarPath"
              className="h-20 sm:h-28 w-auto object-contain mx-auto"
            />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
              Find Scholarships That Fit Your Path.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
              Discover scholarship opportunities, check your eligibility, prepare your application, and stay ahead of every deadline.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="hero-btn-find-scholarships"
                onClick={() => onNavigate('/scholarships')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Search size={16} />
                <span>Find Scholarships</span>
              </button>

              <button
                id="hero-btn-get-started"
                onClick={() => onNavigate('/register')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm transition-all border border-slate-200/90 shadow-xs flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Get Started</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Quick stats banner */}
            <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto border-t border-slate-200/60 text-center">
              <div>
                <span className="block text-2xl font-bold text-slate-900">{scholarships.length > 0 ? `${scholarships.length}+` : '0'}</span>
                <span className="text-xs text-slate-500">Live Opportunities</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-slate-900">{verifiedCount}</span>
                <span className="text-xs text-slate-500">Verified & Vetted</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-slate-900">{allCategories.length}</span>
                <span className="text-xs text-slate-500">Funding Fields</span>
              </div>
              <div>
                <span className="block text-2xl font-bold text-slate-900">Official</span>
                <span className="text-xs text-slate-500">Direct Application Links</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section - Clickable filter navigation */}
      <section id="section-scholarship-categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <CategorySection
          categories={allCategories}
          scholarships={scholarships}
          onSelectCategory={handleSelectCategory}
          onExploreAll={() => onNavigate('/scholarships')}
        />
      </section>

      {/* Featured Verified Scholarships Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              <Shield size={14} className="text-emerald-600" />
              <span>Verified Opportunities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Featured Scholarships</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Hand-reviewed funding opportunities with validated deadlines and official portal URLs.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/scholarships')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Explore All Scholarships</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featured.map(sch => (
            <ScholarshipCard
              key={sch.id}
              scholarship={sch}
              userProfile={userProfile}
              isSaved={isSaved(sch.id)}
              onToggleSave={onToggleSave}
              onViewDetails={(id) => onNavigate(`/scholarships/${id}`)}
              onStartApplication={onStartApplication}
            />
          ))}
        </div>
      </section>

      {/* How ScholarPath Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Workflow</span>
          <h2 className="text-3xl font-bold text-slate-900 mt-1">How ScholarPath Works</h2>
          <p className="text-sm text-slate-600 mt-2">
            A structured path from discovering an opportunity to submitting on the official provider portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Build Academic Profile</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Input your education level, GPA, field of study, and target degree once to power all matching.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Deterministic Match</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our matching engine strictly verifies hard requirements (GPA, location, degree) without deceptive inflated scores.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Prepare Documents</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Generate automatic document checklists for CVs, transcripts, and personal statements from your private vault.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
              4
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Apply & Track</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Launch directly to official verified application pages, mark as applied, and receive deadline reminder alerts.
            </p>
          </div>
        </div>
      </section>

      {/* Core Platform Capabilities Grid */}
      <section className="bg-slate-900 text-white py-16 -mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Features</span>
            <h2 className="text-3xl font-bold text-white mt-1">Built for Serious Scholarship Applicants</h2>
            <p className="text-sm text-slate-400 mt-2">
              Everything you need to organize your applications in one secure, unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Verified Provider Records</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every verified scholarship is thoroughly vetted and verified to ensure legitimate funding, real application deadlines, and genuine provider identity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Transparent Eligibility Breakdown</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Never wonder why you matched. View clear factor-by-factor criteria checks showing exactly how your GPA, nationality, and academic discipline align.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Clock size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Deadline Alerts & Notifications</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stay proactive with timely countdown badges and in-app alerts at 30, 14, 7, 3, and 1-day milestones before application cutoffs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <FileCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Reusable Document Vault</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Store CVs, certified transcripts, and letters of recommendation in your secure document library to instantly fulfill requirements on future applications.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Interactive Application Tracker</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track status progression from Interested and Preparing to Applied, Under Review, Interview, and Awarded with custom notes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <UserCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Profile Reuse</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your academic achievements, extracurriculars, and leadership experience automatically sync across all searches and scholarship matches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-10">
        <div className="p-8 sm:p-12 rounded-3xl bg-indigo-600 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Start Your Scholarship Journey Today
            </h2>
            <p className="text-sm text-indigo-100 leading-relaxed">
              Create your free student profile in under 2 minutes and let ScholarPath match you with verified opportunities tailored to your goals.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('/register')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-indigo-700 font-bold text-xs hover:bg-indigo-50 transition-colors shadow-sm"
              >
                Create Student Account
              </button>
              <button
                onClick={() => onNavigate('/scholarships')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-700 text-white font-semibold text-xs hover:bg-indigo-800 transition-colors"
              >
                Browse Scholarships
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
