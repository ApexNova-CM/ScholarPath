import React from 'react';
import { Compass, CheckCircle2, Shield, Search, FileText, ArrowRight } from 'lucide-react';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Platform Guide</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">How ScholarPath Works</h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Learn how our deterministic matching engine, verified opportunity audit, and application checklist system simplify your scholarship discovery.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex gap-6 items-start">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">1</div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">One-Time Academic Profile Setup</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              When you register as a student, you provide core eligibility variables: your current institution, degree level, cumulative GPA, nationality, and academic discipline. This reusable profile is securely stored and never shared publicly.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex gap-6 items-start">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">2</div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">Deterministic Eligibility Matching</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Unlike generic keyword matching, ScholarPath uses rule-based constraints. If an award requires a 3.5 GPA and you have a 3.2, you are explicitly notified why you do not meet the criteria, preventing wasted application time.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex gap-6 items-start">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">3</div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">Document Vault & Readiness Check</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Upload your CV, transcripts, and faculty recommendation letters once to your private Document Vault. When applying, ScholarPath checks which required documents you already have ready.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex gap-6 items-start">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">4</div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">Official Portal Submission & Milestone Tracking</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ScholarPath links directly to verified official provider portals. After applying externally, click "I've Applied" to track interview, review, and decision milestones with automated deadline countdown reminders.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => onNavigate('/scholarships')}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <span>Explore Verified Scholarships</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
