import React from 'react';
import { Clock, AlertTriangle, Calendar } from 'lucide-react';
import { formatDeadlineBadge } from '../../services/notifications';

interface DeadlineBadgeProps {
  deadline: string;
  size?: 'sm' | 'md';
}

export const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({ deadline, size = 'md' }) => {
  const info = formatDeadlineBadge(deadline);

  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Calendar;

  if (info.isExpired) {
    style = 'bg-slate-100 text-slate-500 border-slate-300 line-through';
    Icon = Clock;
  } else if (info.isUrgent) {
    style = 'bg-amber-50 text-amber-800 border-amber-300/80 font-semibold animate-pulse';
    Icon = AlertTriangle;
  }

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      id="deadline-badge"
      className={`inline-flex items-center rounded-md border font-medium ${sizeClass} ${style}`}
    >
      <Icon size={12} className={info.isUrgent ? 'text-amber-600' : 'text-slate-500'} />
      <span>{info.label}</span>
    </span>
  );
};
