import React from 'react';
import { Shield } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Shield size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-xs text-slate-500">Last updated: September 2026</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <h3 className="font-bold text-slate-900 text-base">1. Document Privacy & Security</h3>
        <p>
          Documents uploaded to your ScholarPath Document Vault (including transcripts, CVs, and letters of recommendation) are strictly private. They are accessible exclusively by you and are never published or made searchable to third parties.
        </p>

        <h3 className="font-bold text-slate-900 text-base pt-2">2. Data We Collect</h3>
        <p>
          We collect basic academic criteria (institution, degree level, major, and cumulative GPA) solely for the purpose of deterministic eligibility calculations. We do not sell your personal contact information or academic records to marketers.
        </p>

        <h3 className="font-bold text-slate-900 text-base pt-2">3. External Links</h3>
        <p>
          When you click "Continue to Official Application", you navigate to external provider websites. We recommend reviewing the privacy notices of external institutions before providing sensitive identifying information.
        </p>
      </div>
    </div>
  );
};

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Terms of Service</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <h3 className="font-bold text-slate-900 text-base">1. Platform Service</h3>
        <p>
          ScholarPath operates as an informational discovery, checklist preparation, and application tracker. ScholarPath does not award scholarships directly, nor do we guarantee external admission or funding approval.
        </p>
        <h3 className="font-bold text-slate-900 text-base pt-2">2. Accuracy of Information</h3>
        <p>
          While our editorial and verification team verifies scholarship details prior to marking them with the <em>✓ Verified</em> badge, scholarship providers may modify application deadlines or funding terms at their discretion.
        </p>
      </div>
    </div>
  );
};
