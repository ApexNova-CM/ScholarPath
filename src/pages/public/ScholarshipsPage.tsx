import React, { useState, useMemo, useEffect } from 'react';
import { Scholarship, UserProfile, EducationLevel, FundingType } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { evaluateEligibility } from '../../services/eligibility';
import { StorageService } from '../../services/storage';
import { 
  isScholarshipExpired, isScholarshipUpcoming, isScholarshipActive 
} from '../../services/scholarshipFilters';
import { 
  Search, Filter, SlidersHorizontal, CheckCircle2, RotateCcw, 
  X, ArrowUpDown, ArrowLeft, Bookmark, Sparkles, FolderTree, Clock 
} from 'lucide-react';

interface ScholarshipsPageProps {
  scholarships: Scholarship[];
  userProfile: UserProfile | null;
  onNavigate: (path: string) => void;
  onToggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  onStartApplication: (sch: Scholarship) => void;
  currentPath?: string;
  initialCategory?: string;
}

const DEFAULT_CATEGORIES = [
  'all',
  'STEM & Tech',
  'Business & Finance',
  'Arts & Humanities',
  'Undergraduate',
  'Postgraduate & PhD',
  'Health & Medicine'
];

const normalizeCategory = (input: string): string => {
  const lower = (input || '').toLowerCase().trim();
  if (!lower || lower === 'all') return 'all';
  if (lower.includes('stem') || lower.includes('tech')) return 'STEM & Tech';
  if (lower.includes('business') || lower.includes('finan')) return 'Business & Finance';
  if (lower.includes('art') || lower.includes('humanit')) return 'Arts & Humanities';
  if (lower.includes('undergrad')) return 'Undergraduate';
  if (lower.includes('postgrad') || lower.includes('phd') || lower.includes('doctor')) return 'Postgraduate & PhD';
  if (lower.includes('health') || lower.includes('med')) return 'Health & Medicine';
  return input;
};

export const ScholarshipsPage: React.FC<ScholarshipsPageProps> = ({
  scholarships,
  userProfile,
  onNavigate,
  onToggleSave,
  isSaved,
  onStartApplication,
  currentPath,
  initialCategory
}) => {
  // Parse initial category from props or URL
  const getInitialCategory = (): string => {
    if (initialCategory) return normalizeCategory(initialCategory);
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat) return normalizeCategory(cat);
    }
    if (currentPath && currentPath.includes('?')) {
      const params = new URLSearchParams(currentPath.split('?')[1]);
      const cat = params.get('category');
      if (cat) return normalizeCategory(cat);
    }
    return 'all';
  };

  const getInitialStatus = (): 'all' | 'active' | 'upcoming' | 'expired' => {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('status') || params.get('filter');
      if (s === 'expired' || s === 'upcoming' || s === 'active' || s === 'all') return s;
    }
    if (currentPath && currentPath.includes('?')) {
      const params = new URLSearchParams(currentPath.split('?')[1]);
      const s = params.get('status') || params.get('filter');
      if (s === 'expired' || s === 'upcoming' || s === 'active' || s === 'all') return s;
    }
    return 'all';
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(getInitialCategory());
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'expired'>(getInitialStatus());
  const [selectedEducationLevel, setSelectedEducationLevel] = useState<string>('all');
  const [selectedFundingType, setSelectedFundingType] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(false);
  const [selectedDeadlineWindow, setSelectedDeadlineWindow] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'amount' | 'recent'>('match');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Sync if initialCategory or currentPath query changes
  useEffect(() => {
    const cat = getInitialCategory();
    if (cat && cat !== selectedCategory) {
      setSelectedCategory(cat);
    }
    const st = getInitialStatus();
    if (st && st !== selectedStatusFilter) {
      setSelectedStatusFilter(st);
    }
  }, [initialCategory, currentPath]);

  // Dynamic categories from StorageService + active scholarships
  const availableCategories = useMemo(() => {
    const loaded = StorageService.getCategories();
    const set = new Set<string>();
    loaded.forEach(c => {
      if (c.name) set.add(c.name);
    });
    scholarships.forEach(s => {
      if (s.category) set.add(s.category);
    });
    if (set.size === 0) {
      DEFAULT_CATEGORIES.forEach(c => {
        if (c !== 'all') set.add(c);
      });
    }
    return ['all', ...Array.from(set)];
  }, [scholarships]);

  // Available unique options extracted from scholarships
  const educationLevels: EducationLevel[] = [
    'High School',
    'Undergraduate',
    'Postgraduate (Masters)',
    'Doctorate (PhD)',
    'Vocational / Technical'
  ];

  const fundingTypes: FundingType[] = [
    'Fully funded',
    'Partial funding',
    'Tuition only',
    'Stipend',
    'Grant',
    'Other'
  ];

  // Filtering & Sorting logic
  const filteredScholarships = useMemo(() => {
    return scholarships.filter(sch => {
      // In student-facing discovery, only show verified or pending active scholarships (not archived/rejected)
      if (sch.status === 'rejected' || sch.status === 'archived') return false;

      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = sch.title.toLowerCase().includes(q);
        const matchesProvider = sch.providerName.toLowerCase().includes(q);
        const matchesDesc = (sch.shortDescription || sch.description).toLowerCase().includes(q);
        const matchesField = sch.fieldsOfStudy.some(f => f.toLowerCase().includes(q));
        const matchesTag = sch.tags.some(t => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesProvider && !matchesDesc && !matchesField && !matchesTag) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        const targetNorm = normalizeCategory(selectedCategory);
        const schNorm = normalizeCategory(sch.category);
        const directMatch = schNorm === targetNorm || sch.category.toLowerCase() === selectedCategory.toLowerCase();

        let fieldMatch = false;
        if (targetNorm === 'STEM & Tech') {
          fieldMatch = sch.fieldsOfStudy.some(f => /computer|engineer|tech|science|math|data/i.test(f));
        } else if (targetNorm === 'Business & Finance') {
          fieldMatch = sch.fieldsOfStudy.some(f => /business|finance|economics|accounting|management/i.test(f));
        } else if (targetNorm === 'Arts & Humanities') {
          fieldMatch = sch.fieldsOfStudy.some(f => /art|history|literature|philosophy|design|humanities/i.test(f));
        } else if (targetNorm === 'Undergraduate') {
          fieldMatch = sch.educationLevels.includes('Undergraduate');
        } else if (targetNorm === 'Postgraduate & PhD') {
          fieldMatch = sch.educationLevels.some(l => l.includes('Postgraduate') || l.includes('Doctorate'));
        } else if (targetNorm === 'Health & Medicine') {
          fieldMatch = sch.fieldsOfStudy.some(f => /health|medicine|nursing|biomedical|epidemiology/i.test(f));
        }

        if (!directMatch && !fieldMatch) {
          return false;
        }
      }

      // 3. Education level filter
      if (selectedEducationLevel !== 'all') {
        const matchesLevel = sch.educationLevels.includes(selectedEducationLevel as EducationLevel);
        if (!matchesLevel) return false;
      }

      // 4. Funding type filter
      if (selectedFundingType !== 'all') {
        if (sch.fundingType !== selectedFundingType) return false;
      }

      // 5. Country filter
      if (selectedCountry !== 'all') {
        const isGlobal = !sch.eligibleCountries || sch.eligibleCountries.length === 0 || sch.eligibleCountries.includes('All');
        const matchesCountry = isGlobal || sch.eligibleCountries.some(c => c.toLowerCase() === selectedCountry.toLowerCase());
        if (!matchesCountry) return false;
      }

      // 6. Min amount filter
      if (minAmount > 0 && sch.amount < minAmount) {
        return false;
      }

      // 7. Verified only filter
      if (verifiedOnly && sch.verificationStatus !== 'verified') {
        return false;
      }

      // 8. Eligibility filter (if student profile exists)
      if (eligibleOnly && userProfile) {
        const eligibility = evaluateEligibility(sch, userProfile);
        if (eligibility.hardDisqualified || eligibility.status === 'not_eligible') {
          return false;
        }
      }

      // 9. Deadline window filter
      if (selectedDeadlineWindow !== 'all') {
        const now = new Date().getTime();
        const deadlineTime = new Date(sch.deadline).getTime();
        const daysLeft = Math.ceil((deadlineTime - now) / (1000 * 60 * 60 * 24));

        if (selectedDeadlineWindow === 'active' && daysLeft < 0) return false;
        if (selectedDeadlineWindow === '30' && (daysLeft < 0 || daysLeft > 30)) return false;
        if (selectedDeadlineWindow === '60' && (daysLeft < 0 || daysLeft > 60)) return false;
      }

      // 10. Lifecycle Status filter
      if (selectedStatusFilter === 'expired') {
        if (!isScholarshipExpired(sch)) return false;
      } else if (selectedStatusFilter === 'active') {
        if (!isScholarshipActive(sch)) return false;
      } else if (selectedStatusFilter === 'upcoming') {
        if (!isScholarshipUpcoming(sch)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sorting
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      if (sortBy === 'deadline') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Default: Best match score
      if (userProfile) {
        const scoreA = evaluateEligibility(a, userProfile).score;
        const scoreB = evaluateEligibility(b, userProfile).score;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [
    scholarships,
    searchQuery,
    selectedCategory,
    selectedStatusFilter,
    selectedEducationLevel,
    selectedFundingType,
    selectedCountry,
    minAmount,
    verifiedOnly,
    eligibleOnly,
    selectedDeadlineWindow,
    sortBy,
    userProfile
  ]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const newPath = cat === 'all' ? '/scholarships' : `/scholarships?category=${encodeURIComponent(cat)}`;
    try {
      window.history.pushState({}, '', newPath);
    } catch (e) {}
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedEducationLevel('all');
    setSelectedFundingType('all');
    setSelectedCountry('all');
    setMinAmount(0);
    setVerifiedOnly(false);
    setEligibleOnly(false);
    setSelectedDeadlineWindow('all');
    setSelectedStatusFilter('all');
    try {
      window.history.pushState({}, '', '/scholarships');
    } catch (e) {}
  };

  const hasActiveFilters = 
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedEducationLevel !== 'all' ||
    selectedFundingType !== 'all' ||
    selectedCountry !== 'all' ||
    minAmount > 0 ||
    verifiedOnly ||
    eligibleOnly ||
    selectedDeadlineWindow !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <button
            id="btn-nav-back"
            onClick={() => {
              if (userProfile) {
                onNavigate('/dashboard');
              } else {
                onNavigate('/');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-semibold transition-colors shadow-2xs min-h-[40px]"
          >
            <ArrowLeft size={14} />
            <span>{userProfile ? 'Back to Dashboard' : 'Back to Home'}</span>
          </button>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-slate-800 font-semibold hidden sm:inline">Find Scholarships</span>
          {selectedCategory !== 'all' && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-indigo-600 font-bold hidden sm:inline">{selectedCategory}</span>
            </>
          )}
        </div>

        {userProfile && (
          <button
            id="btn-nav-to-saved"
            onClick={() => onNavigate('/saved')}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 min-h-[40px] px-2 py-1 transition-colors"
          >
            <Bookmark size={14} />
            <span>View Saved Scholarships</span>
          </button>
        )}
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1.5">
          <Sparkles size={14} />
          <span>Scholarship Directory</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Find Scholarships
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          Explore vetted funding opportunities matched to your academic criteria, discipline, and aspirations.
        </p>

        {/* Search & Sort Row */}
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="input-scholarship-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scholarships, fields, degrees, providers..."
              className="w-full pl-10 pr-9 py-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Sort Selector */}
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="select-scholarship-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto px-3.5 py-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 appearance-none pr-8 cursor-pointer focus:outline-hidden focus:border-indigo-500 shadow-2xs min-h-[44px]"
              >
                <option value="match">Sort: Best Match</option>
                <option value="deadline">Sort: Deadline (Soonest)</option>
                <option value="amount">Sort: Amount (Highest)</option>
                <option value="recent">Sort: Recently Added</option>
              </select>
              <ArrowUpDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Mobile filters toggle */}
            <button
              id="btn-toggle-mobile-filters"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden px-3.5 py-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs min-h-[44px]"
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </button>
          </div>
        </div>

        {/* Lifecycle Status Filter Bar */}
        <div className="mt-4 pt-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <Clock size={13} className="text-indigo-600" />
            Status:
          </span>
          <button
            id="pill-status-all"
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none min-h-[34px] flex items-center ${
              selectedStatusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs font-bold'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            All Opportunities
          </button>
          <button
            id="pill-status-active"
            onClick={() => setSelectedStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none min-h-[34px] flex items-center ${
              selectedStatusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Active
          </button>
          <button
            id="pill-status-upcoming"
            onClick={() => setSelectedStatusFilter('upcoming')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none min-h-[34px] flex items-center ${
              selectedStatusFilter === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Upcoming
          </button>
          <button
            id="pill-status-expired"
            onClick={() => setSelectedStatusFilter('expired')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none min-h-[34px] flex items-center ${
              selectedStatusFilter === 'expired'
                ? 'bg-rose-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            Expired
          </button>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <FolderTree size={13} className="text-indigo-600" />
            Category:
          </span>
          {availableCategories.map(cat => {
            const isSelected = (cat === 'all' && selectedCategory === 'all') || selectedCategory === cat;
            return (
              <button
                key={cat}
                id={`pill-category-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer select-none min-h-[34px] flex items-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {cat === 'all' ? 'All Opportunities' : cat}
              </button>
            );
          })}
        </div>

        {/* Active Category Banner Indicator */}
        {selectedCategory !== 'all' && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-950">Active Category:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-bold text-xs">
                {selectedCategory}
              </span>
              <span className="text-indigo-700 text-xs">
                ({filteredScholarships.length} scholarships available)
              </span>
            </div>
            <button
              id="btn-remove-category-filter"
              onClick={() => handleCategoryChange('all')}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs"
            >
              <X size={14} />
              <span>Remove Category Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Filters Sidebar + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Filter Panel (Desktop & Mobile Drawer) */}
        <div className={`
          lg:block lg:sticky lg:top-20 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6
          ${showMobileFilters ? 'block fixed inset-x-4 top-20 z-50 max-h-[80vh] overflow-y-auto shadow-2xl' : 'hidden'}
        `}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Filter size={14} className="text-indigo-600" />
              <span>Filters</span>
            </h3>
            {hasActiveFilters && (
              <button
                id="btn-reset-filters-sidebar"
                onClick={resetFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
              >
                <RotateCcw size={12} />
                <span>Reset All</span>
              </button>
            )}
            {showMobileFilters && (
              <button 
                onClick={() => setShowMobileFilters(false)} 
                className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Toggles */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                id="checkbox-verified-only"
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <span>Verified Only</span>
                <CheckCircle2 size={12} className="text-emerald-600" />
              </span>
            </label>

            {userProfile && (
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  id="checkbox-eligible-only"
                  type="checkbox"
                  checked={eligibleOnly}
                  onChange={(e) => setEligibleOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <span>Matches My Profile</span>
              </label>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Scholarship Category</label>
            <select
              id="select-filter-category"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            >
              <option value="all">All Categories</option>
              {availableCategories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Education Level */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Education Level</label>
            <select
              id="select-filter-education"
              value={selectedEducationLevel}
              onChange={(e) => setSelectedEducationLevel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            >
              <option value="all">All Levels</option>
              {educationLevels.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>

          {/* Funding Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Funding Type</label>
            <select
              id="select-filter-funding"
              value={selectedFundingType}
              onChange={(e) => setSelectedFundingType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            >
              <option value="all">All Funding Types</option>
              {fundingTypes.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Minimum Award Amount */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Min. Award</span>
              <span className="text-indigo-600 font-semibold">${minAmount.toLocaleString()}</span>
            </div>
            <input
              id="range-filter-amount"
              type="range"
              min={0}
              max={35000}
              step={2500}
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Deadline Window */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Deadline Window</label>
            <select
              id="select-filter-deadline"
              value={selectedDeadlineWindow}
              onChange={(e) => setSelectedDeadlineWindow(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            >
              <option value="all">Any Deadline</option>
              <option value="active">Active Only (Not Expired)</option>
              <option value="30">Closing in 30 Days</option>
              <option value="60">Closing in 60 Days</option>
            </select>
          </div>

          {showMobileFilters && (
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-xs"
            >
              Apply Filters ({filteredScholarships.length} Results)
            </button>
          )}
        </div>

        {/* Results Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
            <span>Showing {filteredScholarships.length} {filteredScholarships.length === 1 ? 'scholarship' : 'scholarships'}</span>
            {userProfile && (
              <span className="text-indigo-600 font-medium">
                Tailored to {userProfile.educationLevel} • {userProfile.fieldOfStudy}
              </span>
            )}
          </div>

          {filteredScholarships.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredScholarships.map(sch => (
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
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Search size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No scholarships match your criteria</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {selectedCategory !== 'all' 
                  ? `No programs currently match "${selectedCategory}" with the applied filters. Try clearing the category or adjusting your search.`
                  : 'Try widening your search terms or clearing specific filter criteria like minimum award or verification status.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  id="btn-empty-reset-filters"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  <RotateCcw size={13} />
                  <span>Reset All Filters</span>
                </button>
                {selectedCategory !== 'all' && (
                  <button
                    id="btn-empty-all-categories"
                    onClick={() => handleCategoryChange('all')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <span>Browse All Categories</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
