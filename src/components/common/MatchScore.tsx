import React from 'react';
import { EligibilityResult } from '../../types';
import { Sparkles, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface MatchScoreProps {
  result: EligibilityResult;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const MatchScore: React.FC<MatchScoreProps> = ({
  result,
  size = 'md',
  showLabel = true
}) => {
  let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = HelpCircle;

  if (result.hardDisqualified || result.status === 'not_eligible') {
    badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200/80';
    Icon = AlertCircle;
  } else if (result.status === 'strong_match') {
    badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    Icon = Sparkles;
  } else if (result.status === 'eligible') {
    badgeClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
    Icon = CheckCircle2;
  } else if (result.status === 'partial_match') {
    badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200/80';
    Icon = AlertCircle;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold'
  };

  const getLabel = () => {
    if (result.hardDisqualified) return 'Ineligible';
    if (result.status === 'profile_incomplete') return 'Profile Incomplete';
    return `${result.score}% Match`;
  };

  return (
    <div
      id="match-score-badge"
      title={result.summary}
      className={`inline-flex items-center rounded-full border shadow-2xs select-none ${badgeClasses} ${sizeClasses[size]}`}
    >
      <Icon size={size === 'sm' ? 12 : 14} className="stroke-[2.2]" />
      <span>{getLabel()}</span>
    </div>
  );
};
