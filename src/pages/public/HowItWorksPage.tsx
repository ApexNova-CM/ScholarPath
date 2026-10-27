import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface HowItWorksPageProps {
  onNavigate: (path: string) => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#155EEF]">
          Platform Architecture & Process
        </span>
        <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0B1F46]">
          How Scholavon Bridges the Funding Gap
        </h1>
        <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
          Scholavon eliminates the fragmentation of traditional scholarship searches by aggregating, verifying, and tracking university endowments and international research grants in one unified workstation.
        </p>
      </div>

      {/* 4 Detailed Milestones in 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] font-mono font-bold text-sm flex items-center justify-center">
            01
          </div>
          <h2 className="font-sans text-xl font-bold text-[#0B1F46]">
            1. Direct Institutional Verification
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Every scholarship listing on Scholavon is verified directly against university charters, governmental departments, and trust foundations to ensure active funding cycles and legitimate non-fee application processes.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 pt-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero third-party marketing leads or scam solicitations</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official committee deadlines synchronized weekly</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] font-mono font-bold text-sm flex items-center justify-center">
            02
          </div>
          <h2 className="font-sans text-xl font-bold text-[#0B1F46]">
            2. Multi-Factor Academic Matching
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Our match engine compares student GPAs, degrees, study fields, and nationalities against strict donor mandates to ensure precision.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 pt-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Calculated match strength with transparent criteria checks</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Clear feedback on eligibility requirements</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] font-mono font-bold text-sm flex items-center justify-center">
            03
          </div>
          <h2 className="font-sans text-xl font-bold text-[#0B1F46]">
            3. Document Vault & Readiness Check
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Upload your CV, transcripts, and faculty recommendation letters once to your private Document Vault. When applying, Scholavon checks which required documents you already have ready.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 pt-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automated document checklist validation</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Secure, encrypted file storage for multiple cycles</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] font-mono font-bold text-sm flex items-center justify-center">
            04
          </div>
          <h2 className="font-sans text-xl font-bold text-[#0B1F46]">
            4. Official Portal Submission & Milestone Tracking
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Scholavon links directly to verified official provider portals. After applying externally, track interview, review, and decision milestones with automated deadline countdown reminders.
          </p>
          <ul className="space-y-2 text-xs text-slate-700 pt-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full lifecycle milestone tracking from draft to award</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Real-time reminder notifications before deadline cutoffs</span>
            </li>
          </ul>
        </div>

      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => onNavigate('/scholarships')}
          className="px-8 py-3.5 bg-[#155EEF] hover:bg-[#124bbf] text-white font-semibold text-xs rounded-xl transition-colors shadow-xs inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Explore Verified Scholarships</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
