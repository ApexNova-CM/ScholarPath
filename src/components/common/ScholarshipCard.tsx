import React from 'react';
import { Scholarship, UserProfile } from '../../types';
import { Bookmark, MapPin, GraduationCap, ArrowUpRight, DollarSign } from 'lucide-react';

interface ScholarshipCardProps {
  scholarship: Scholarship;
  userProfile?: UserProfile | null;
  isSaved?: boolean;
  onToggleSave?: (scholarshipId: string) => void;
  onViewDetails?: (scholarshipId: string) => void;
  onStartApplication?: (scholarship: Scholarship) => void;
}

export const ScholarshipCard: React.FC<ScholarshipCardProps> = ({
  scholarship,
  userProfile,
  isSaved = false,
  onToggleSave,
  onViewDetails,
  onStartApplication
}) => {
  const formattedAmount = scholarship.amountDisplay || (
    scholarship.amount !== undefined && scholarship.amount !== null && scholarship.amount > 0
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: scholarship.currency || 'USD',
          maximumFractionDigits: 0
        }).format(scholarship.amount)
      : scholarship.fundingType || 'Award varies'
  );

  const locationText = 
    !scholarship.eligibleCountries || scholarship.eligibleCountries.length === 0 || scholarship.eligibleCountries.includes('All')
      ? 'Global / All Countries'
      : scholarship.eligibleCountries.slice(0, 2).join(', ') + (scholarship.eligibleCountries.length > 2 ? ` +${scholarship.eligibleCountries.length - 2}` : '');

  return (
    <div 
      id={`scholarship-card-${scholarship.id}`}
      className="group relative flex flex-col justify-between bg-white border border-slate-200/90 rounded-xl p-5 hover:border-indigo-400/80 hover:shadow-md transition-all duration-200"
    >
      <div>
        {/* Title, Provider and Bookmark Save Action */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3 
              onClick={() => onViewDetails?.(scholarship.id)}
              className="text-base font-bold text-slate-900 line-clamp-2 hover:text-indigo-600 cursor-pointer transition-colors"
            >
              {scholarship.title}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">
              {scholarship.providerName}
            </p>
          </div>

          {onToggleSave && (
            <button
              id={`btn-save-${scholarship.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(scholarship.id);
              }}
              title={isSaved ? 'Remove from saved' : 'Save scholarship'}
              className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                isSaved 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <Bookmark size={16} className={isSaved ? 'fill-indigo-600' : ''} />
            </button>
          )}
        </div>

        {/* Short description */}
        <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
          {scholarship.shortDescription || scholarship.description}
        </p>

        {/* Key Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4 bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            <DollarSign size={14} className="text-emerald-600 shrink-0" />
            <span>{formattedAmount}</span>
            <span className="text-[10px] font-normal text-slate-500">({scholarship.fundingType})</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600">
            <GraduationCap size={14} className="text-indigo-500 shrink-0" />
            <span className="truncate">{scholarship.educationLevels[0] || 'Undergraduate'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
            <MapPin size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          id={`btn-view-${scholarship.id}`}
          onClick={() => onViewDetails?.(scholarship.id)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          <span>View Scholarship</span>
          <ArrowUpRight size={13} />
        </button>

        {onStartApplication && (
          <button
            id={`btn-apply-prep-${scholarship.id}`}
            onClick={() => onStartApplication(scholarship)}
            className="text-xs font-medium bg-slate-900 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
          >
            Start Application
          </button>
        )}
      </div>
    </div>
  );
};
