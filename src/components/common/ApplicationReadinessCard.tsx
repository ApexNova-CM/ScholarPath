import React from 'react';
import { ComprehensiveReadinessResult } from '../../types';
import { 
  GraduationCap, CheckCircle2, XCircle, AlertTriangle, 
  ArrowRight, User, BookOpen, FileText, Sparkles 
} from 'lucide-react';

interface ApplicationReadinessCardProps {
  readiness: ComprehensiveReadinessResult;
  onNavigate: (path: string) => void;
  onStartApplication?: () => void;
}

export const ApplicationReadinessCard: React.FC<ApplicationReadinessCardProps> = ({
  readiness,
  onNavigate,
  onStartApplication,
}) => {
  if (!readiness.hasStructuredRequirements) {
    return (
      <div 
        id="application-readiness-panel"
        className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <GraduationCap size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Application Readiness
          </h2>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <p className="text-xs font-bold text-slate-800">
            Readiness information unavailable
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {readiness.summary}
          </p>
        </div>
      </div>
    );
  }

  const { score, category, categoryColors, summary, items, missingCount, needsReviewCount } = readiness;

  const missingOrReviewItems = items.filter(i => i.status === 'missing' || i.status === 'needs_review');

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'Profile':
        return <User size={13} className="text-indigo-500" />;
      case 'Academic':
        return <BookOpen size={13} className="text-emerald-500" />;
      case 'Documents':
        return <FileText size={13} className="text-blue-500" />;
      default:
        return <Sparkles size={13} className="text-amber-500" />;
    }
  };

  return (
    <div 
      id="application-readiness-panel"
      className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5"
    >
      {/* Header with Title & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GraduationCap size={20} className="text-indigo-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Application Readiness
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Scholarship-specific preparation score
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span 
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${categoryColors.bg} ${categoryColors.text} ${categoryColors.border}`}
          >
            <span>{score}% Ready</span>
            <span className="opacity-70 font-normal">· {category}</span>
          </span>
        </div>
      </div>

      {/* Progress Bar & Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Overall Readiness</span>
          <span className="text-slate-900 font-bold">{score}%</span>
        </div>
        <div 
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Application readiness: ${score}% ${category}`}
          className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden"
        >
          <div 
            className={`h-full rounded-full transition-all duration-300 ${categoryColors.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-xs text-slate-600 leading-relaxed pt-1">
          {summary}
        </p>
      </div>

      {/* Checklist Breakdown */}
      <div className="space-y-2.5 pt-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Requirements Checklist ({readiness.completeCount}/{readiness.totalCount} Complete)
        </h3>

        <div className="space-y-2">
          {items.map((item) => {
            const isComplete = item.status === 'complete';
            const isMissing = item.status === 'missing';
            const isNeedsReview = item.status === 'needs_review';

            return (
              <div 
                key={item.id}
                className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-3 ${
                  isComplete 
                    ? 'bg-emerald-50/40 border-emerald-100/80 text-slate-800'
                    : isMissing
                    ? 'bg-rose-50/40 border-rose-100/80 text-slate-800'
                    : 'bg-amber-50/40 border-amber-100/80 text-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="shrink-0 mt-0.5">
                    {isComplete && (
                      <CheckCircle2 size={16} className="text-emerald-600 stroke-[2.5]" aria-label="Complete" />
                    )}
                    {isMissing && (
                      <XCircle size={16} className="text-rose-600 stroke-[2.5]" aria-label="Missing" />
                    )}
                    {isNeedsReview && (
                      <AlertTriangle size={16} className="text-amber-500 stroke-[2.5]" aria-label="Needs Review" />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                        {getCategoryIcon(item.category)}
                        <span>{item.category}</span>
                      </span>
                      {item.isRequired && (
                        <span className="text-[10px] text-slate-400 font-medium">· Required</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.actionLabel && item.actionPath && (
                  <button
                    onClick={() => onNavigate(item.actionPath!)}
                    className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-colors cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer for Missing Items */}
      {missingOrReviewItems.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/70 p-4 rounded-xl">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-800">
              {missingCount > 0 
                ? `${missingCount} required item${missingCount === 1 ? '' : 's'} to complete before applying`
                : `${needsReviewCount} item${needsReviewCount === 1 ? '' : 's'} to review before applying`}
            </p>
            <p className="text-[11px] text-slate-500">
              You can still start your application or prepare your materials now.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onStartApplication && (
              <button
                onClick={onStartApplication}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Complete Requirements</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
