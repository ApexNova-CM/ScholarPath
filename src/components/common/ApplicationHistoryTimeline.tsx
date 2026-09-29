import React from 'react';
import { ApplicationStatusHistoryItem, ApplicationStatus } from '../../types';
import { 
  CheckCircle2, Clock, Sparkles, Calendar, Trophy, 
  XCircle, AlertCircle, Shield, User, Info 
} from 'lucide-react';

interface ApplicationHistoryTimelineProps {
  history?: ApplicationStatusHistoryItem[];
  currentStatus: ApplicationStatus;
  createdAt: string;
}

const STATUS_ICONS: Record<string, any> = {
  Interested: Clock,
  Preparing: Clock,
  Applied: CheckCircle2,
  'Under Review': Clock,
  Shortlisted: Sparkles,
  Interview: Calendar,
  Awarded: Trophy,
  'Not Selected': XCircle,
  Withdrawn: AlertCircle,
  Successful: Trophy,
  Unsuccessful: XCircle,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Awarded: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Successful: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Shortlisted: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  Interview: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Under Review': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Applied: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Preparing: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  Interested: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  'Not Selected': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  Unsuccessful: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  Withdrawn: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

export const ApplicationHistoryTimeline: React.FC<ApplicationHistoryTimelineProps> = ({
  history,
  currentStatus,
  createdAt,
}) => {
  const items = (history && history.length > 0)
    ? [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [
        {
          id: 'hist-init',
          status: currentStatus,
          timestamp: createdAt || new Date().toISOString(),
          notes: 'Application milestone recorded',
          source: 'student_updated' as const,
        }
      ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
        <Clock size={14} className="text-indigo-600" />
        <span>Application Milestone History</span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {items.map((item, idx) => {
          const Icon = STATUS_ICONS[item.status] || Clock;
          const colors = STATUS_COLORS[item.status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
          const isLatest = idx === 0;

          return (
            <div key={item.id || idx} className="relative group">
              {/* Dot */}
              <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                isLatest ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-500'
              }`}>
                <Icon size={10} />
              </div>

              {/* Content Box */}
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {item.status}
                    </span>
                    {item.source && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <User size={10} />
                        {item.source === 'admin_updated' ? 'Admin update' : item.source === 'provider_confirmed' ? 'Provider confirmed' : 'Student update'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-slate-600 leading-relaxed pl-1 pt-0.5">
                    {item.notes}
                  </p>
                )}

                {/* Metadata summary if present */}
                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <div className="pt-1 text-[11px] text-slate-500 space-y-0.5 border-t border-slate-200/60 mt-1">
                    {Boolean(item.metadata.awardAmount) && (
                      <div>Award Amount: <strong>${Number(item.metadata.awardAmount).toLocaleString()}</strong> {String(item.metadata.awardCurrency || 'USD')}</div>
                    )}
                    {Boolean(item.metadata.interviewDate) && (
                      <div>Interview Date: <strong>{new Date(String(item.metadata.interviewDate)).toLocaleDateString()}</strong></div>
                    )}
                    {Boolean(item.metadata.nextStep) && (
                      <div>Next Step: <strong>{String(item.metadata.nextStep)}</strong></div>
                    )}
                    {Boolean(item.metadata.rejectionReason) && (
                      <div>Reason: <strong>{String(item.metadata.rejectionReason)}</strong></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
