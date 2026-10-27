import React, { useState, useEffect } from 'react';
import { 
  Search, ArrowRight, ShieldCheck, Shield,
  Sparkles, CheckCircle2, Clock, 
  FileCheck, Briefcase, UserCheck, ChevronRight
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

  // Take verified scholarships for featured showcase
  const featured = scholarships
    .filter(s => s.verificationStatus === 'verified')
    .slice(0, 3);

  const verifiedCount = scholarships.filter(s => s.verificationStatus === 'verified').length;

  // Slideshow State
  const slides = [
    {
      url: '/images/hero_scholavon_students_1792840568409.jpg',
      caption: 'International Scholars Collaborating at Oxford',
      subtext: 'Weston Library Courtyard, Academic Term',
    },
    {
      url: '/images/campus_library_study_1792841984361.jpg',
      caption: 'Prestigious Research Libraries & Scholar Stacks',
      subtext: 'Fully-Funded Graduate Study & Research Environments',
    },
    {
      url: '/images/university_quad_walk_1792841986239.jpg',
      caption: 'Historic Collegiate Campuses Across Global Universities',
      subtext: 'Endowments & Departmental Grants Worldwide',
    },
    {
      url: '/images/graduation_commencement_1792841985236.jpg',
      caption: 'Celebrating Academic Excellence & Commencement',
      subtext: 'Empowering Next-Generation Scholars With Zero Student Debt',
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  // Search filter inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('All Countries');
  const [filterLevel, setFilterLevel] = useState('All Levels');

  // Automatic slideshow timer: cycles smoothly every 6 seconds
  useEffect(() => {
    slides.forEach((slide) => {
      const img = new Image();
      img.src = slide.url;
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (filterCountry !== 'All Countries') params.append('country', filterCountry);
    if (filterLevel !== 'All Levels') params.append('level', filterLevel);
    
    const queryString = params.toString();
    onNavigate(queryString ? `/scholarships?${queryString}` : '/scholarships');
  };

  const handleSelectCategory = (categoryName: string) => {
    onNavigate(`/scholarships?category=${encodeURIComponent(categoryName)}`);
  };

  return (
    <div className="space-y-20 pb-20">
      {/* 1. HERO SECTION WITH 6-SECOND AUTO-CYCLE BACKGROUND SLIDESHOW */}
      <section 
        className="relative min-h-[560px] lg:min-h-[620px] flex items-center overflow-hidden bg-[#0B1F46]"
        aria-label="Welcome Hero Slideshow"
      >
        <div className="absolute inset-0 z-0">
          {slides.map((slide, index) => {
            const isActive = index === currentSlide;
            const hasError = imageError[index];

            return (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {!hasError ? (
                  <img
                    src={slide.url}
                    alt={slide.caption}
                    onError={() => setImageError((prev) => ({ ...prev, [index]: true }))}
                    className="w-full h-full object-cover object-center transform scale-100 brightness-[0.82] transition-transform duration-[6000ms] ease-out"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B1F46] via-[#102a5c] to-[#081530]" />
                )}
              </div>
            );
          })}

          <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#0B1F46]/95 via-[#0B1F46]/85 to-[#0B1F46]/60" />
          <div className="absolute inset-0 z-20 opacity-5 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none" />
        </div>

        <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 w-full">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-blue-200 text-xs font-semibold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2F80ED]" />
              <span>OPPORTUNITIES WITHIN REACH</span>
            </div>

            <h1 className="font-sans text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.14]">
              Your Future Deserves <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2F80ED] via-[#60A5FA] to-[#155EEF]">
                an Opportunity.
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-200/95 leading-relaxed font-normal">
              Discover verified scholarships, assess real-time eligibility matched to your profile, and navigate deadlines with confidence.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <button
                id="hero-btn-find-scholarships"
                onClick={() => onNavigate('/scholarships')}
                className="px-6 py-3.5 bg-[#155EEF] hover:bg-[#124bbf] text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all hover:shadow-xl cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Explore Scholarships</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                id="hero-btn-get-started"
                onClick={() => onNavigate('/register')}
                className="px-6 py-3.5 bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-sm rounded-xl text-sm font-semibold transition-colors cursor-pointer text-center"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SEARCH BAR DIRECTLY BELOW HERO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 relative z-30">
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-4 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs font-semibold text-[#0B1F46]">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#155EEF]" />
              <span>Search & Filter Scholarships</span>
            </div>
            <span className="text-[#64748B] font-normal hidden sm:inline">
              {scholarships.length > 0 ? `${scholarships.length} opportunities available` : 'Curated academic opportunities'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Keywords / University / Field
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Oxford, STEM, Computer Science..."
                className="w-full text-xs font-normal pl-3 pr-3 py-2.5 bg-[#F6F8FC] border border-[#E2E8F0] rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#155EEF] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Host Country
              </label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="w-full text-xs font-normal px-3 py-2.5 bg-[#F6F8FC] border border-[#E2E8F0] rounded-xl text-slate-800 focus:outline-none focus:border-[#155EEF] focus:bg-white cursor-pointer"
              >
                <option value="All Countries">All Countries</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Germany">Germany</option>
                <option value="Nigeria">Nigeria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Study Level
              </label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full text-xs font-normal px-3 py-2.5 bg-[#F6F8FC] border border-[#E2E8F0] rounded-xl text-slate-800 focus:outline-none focus:border-[#155EEF] focus:bg-white cursor-pointer"
              >
                <option value="All Levels">All Levels</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Postgraduate (Masters)">Postgraduate (Masters)</option>
                <option value="Doctorate (PhD)">Doctorate (PhD)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#155EEF] hover:bg-[#124bbf] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 3. PLATFORM REAL METRICS STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs text-center">
          <div>
            <span className="block text-2xl sm:text-3xl font-bold text-[#0B1F46]">
              {scholarships.length > 0 ? `${scholarships.length}+` : '100+'}
            </span>
            <span className="text-xs text-[#64748B] mt-0.5 block">Live Opportunities</span>
          </div>
          <div>
            <span className="block text-2xl sm:text-3xl font-bold text-[#155EEF]">
              {verifiedCount > 0 ? verifiedCount : '100%'}
            </span>
            <span className="text-xs text-[#64748B] mt-0.5 block">Verified & Institutional</span>
          </div>
          <div>
            <span className="block text-2xl sm:text-3xl font-bold text-[#0B1F46]">
              {allCategories.length > 0 ? allCategories.length : '12'}
            </span>
            <span className="text-xs text-[#64748B] mt-0.5 block">Academic Fields</span>
          </div>
          <div>
            <span className="block text-2xl sm:text-3xl font-bold text-emerald-600">
              100%
            </span>
            <span className="text-xs text-[#64748B] mt-0.5 block">Official Application Portals</span>
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

      {/* How Scholavon Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Workflow</span>
          <h2 className="text-3xl font-bold text-slate-900 mt-1">How Scholavon Works</h2>
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
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Matched to Your Profile</h3>
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
      <section className="bg-[#0B1F46] text-white py-16 -mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2F80ED]">Features</span>
            <h2 className="text-3xl font-bold text-white mt-1">Built for Serious Scholarship Applicants</h2>
            <p className="text-sm text-slate-300 mt-2">
              Everything you need to organize your applications in one secure, unified platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Verified Provider Records</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Every verified scholarship is thoroughly vetted and verified to ensure legitimate funding, real application deadlines, and genuine provider identity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Transparent Eligibility Breakdown</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Never wonder why you matched. View clear factor-by-factor criteria checks showing exactly how your GPA, nationality, and academic discipline align.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <Clock size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Deadline Alerts & Notifications</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Stay proactive with timely countdown badges and in-app alerts at 30, 14, 7, 3, and 1-day milestones before application cutoffs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <FileCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Reusable Document Vault</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Store CVs, certified transcripts, and letters of recommendation in your secure document library to instantly fulfill requirements on future applications.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Interactive Application Tracker</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Track status progression from Interested and Preparing to Applied, Under Review, Interview, and Awarded with custom notes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#155EEF]/20 text-[#2F80ED] flex items-center justify-center">
                <UserCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Profile Reuse</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your academic achievements, extracurriculars, and leadership experience automatically sync across all searches and scholarship matches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-10">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#155EEF] text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Start Your Scholarship Journey Today
            </h2>
            <p className="text-sm text-blue-100 leading-relaxed">
              Create your free student profile in under 2 minutes and let Scholavon match you with verified opportunities tailored to your goals.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('/register')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#155EEF] font-bold text-xs hover:bg-blue-50 transition-colors shadow-sm cursor-pointer"
              >
                Create Student Account
              </button>
              <button
                onClick={() => onNavigate('/scholarships')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#124bbf] text-white font-semibold text-xs hover:bg-[#0e3b97] transition-colors cursor-pointer"
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
