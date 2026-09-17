import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { VerificationStatus } from '../../types';

interface VerifiedBadgeProps {
  status?: VerificationStatus;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  status = 'verified',
  size = 'md',
  showDetails = false,
  verifiedAt,
  verifiedBy
}) => {
  if (status !== 'verified') return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <div className="inline-flex items-center">
      <span 
        id="badge-verified"
        className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs tracking-tight ${sizeClasses[size]}`}
      >
        <CheckCircle2 size={iconSizes[size]} className="text-emerald-600 stroke-[2.5]" />
        <span>Verified</span>
      </span>

      {showDetails && (
        <span className="ml-2 text-xs text-slate-500">
          Verified by ScholarPath
          {verifiedAt ? ` on ${new Date(verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </span>
      )}
    </div>
  );
};
