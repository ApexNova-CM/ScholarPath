import React, { useState } from 'react';
import { Scholarship, UserProfile } from '../../types';
import { ScholarshipCard } from '../../components/common/ScholarshipCard';
import { Bookmark, Search, ArrowRight } from 'lucide-react';

interface SavedScholarshipsPageProps {
  scholarships: Scholarship[];
  userProfile: UserProfile;
  savedScholarshipIds: string[];
  onToggleSave: (id: string) => void;
  onNavigate: (path: string) => void;
  onStartApplication: (sch: Scholarship) => void;
}

export const SavedScholarshipsPage: React.FC<SavedScholarshipsPageProps> = ({
  scholarships,
  userProfile,
  savedScholarshipIds,
  onToggleSave,
  onNavigate,
  onStartApplication
}) => {
  const [query, setQuery] = useState('');

  const savedScholarships = scholarships
    .filter(s => savedScholarshipIds.includes(s.id))
    .filter(s => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.providerName.toLowerCase().includes(q) ||
        s.fieldsOfStudy.some(f => f.toLowerCase().includes(q))
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Bookmark size={14} />
            <span>Shortlisted Opportunities</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Saved Scholarships
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Keep track of scholarships you are considering. Review requirements and launch applications when ready.
          </p>
        </div>

        {savedScholarshipIds.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter saved..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
        )}
      </div>

      {savedScholarships.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedScholarships.map(sch => (
            <ScholarshipCard
              key={sch.id}
              scholarship={sch}
              userProfile={userProfile}
              isSaved={true}
              onToggleSave={onToggleSave}
              onViewDetails={(id) => onNavigate(`/scholarships/${id}`)}
              onStartApplication={onStartApplication}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            <Bookmark size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {savedScholarshipIds.length === 0 ? 'No Saved Scholarships Yet' : 'No matches found'}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {savedScholarshipIds.length === 0 
              ? 'When exploring opportunities, click the bookmark icon on any scholarship card to save it here for quick reference.' 
              : 'Try clearing your search term to see all your saved scholarships.'}
          </p>
          <button
            onClick={() => onNavigate('/scholarships')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <span>Discover Scholarships</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
