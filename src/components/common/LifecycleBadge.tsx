import React from 'react';
import { Scholarship } from '../../types';
import { computeLifecycleStatus, getLifecycleBadgeStyle } from '../../services/scholarshipFilters';
import { CheckCircle2, Clock, XCircle, Archive } from 'lucide-react';

interface LifecycleBadgeProps {
  scholarship: Scholarship;
  size?: 'sm' | 'md';
  /** When true, only renders for Closing Soon, Closed, and Archived — hides Active badge */
  hideActive?: boolean;
}

const statusIcons = {
  active: CheckCircle2,
  closing_soon: Clock,
  closed: XCircle,
  archived: Archive,
};

export const LifecycleBadge: React.FC<LifecycleBadgeProps> = ({
  scholarship,
  size = 'md',
  hideActive = false,
}) => {
  const status = computeLifecycleStatus(scholarship);

  if (hideActive && status === 'active') return null;

  const { bg, text, border, label, animate } = getLifecycleBadgeStyle(status);
  const Icon = statusIcons[status];
  const sizeClass = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold ${sizeClass} ${bg} ${text} ${border} ${animate ?? ''}`}
    >
      <Icon size={size === 'sm' ? 11 : 13} className="shrink-0" />
      <span>{label}</span>
    </span>
  );
};
