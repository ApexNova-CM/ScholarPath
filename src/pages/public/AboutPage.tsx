import React from 'react';
import { ShieldCheck, Globe2, Award } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Hero Header */}
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#155EEF]">
          About Scholavon
        </span>
        <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0B1F46]">
          Opportunities Within Reach.
        </h1>
        <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
          Scholavon was founded on a simple conviction: financial limitations should never preclude exceptional scholars from accessing world-class education. We partner with universities, philanthropic trusts, and governments to make global funding transparent, verifiable, and within reach.
        </p>
      </div>

      {/* Core Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="font-sans text-base font-bold text-[#0B1F46]">Zero Applicant Fees</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Scholavon is strictly free for students. We never charge application processing fees or sell student data to commercial marketing agencies.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] flex items-center justify-center">
            <Globe2 className="w-5 h-5" />
          </div>
          <h2 className="font-sans text-base font-bold text-[#0B1F46]">International Inclusion</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            We actively index full-ride fellowships supporting scholars across 160+ developing and emerging nations, bridging regional educational divides.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#155EEF] flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <h2 className="font-sans text-base font-bold text-[#0B1F46]">Institutional Rigor</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every scholarship listing is audited by university compliance officers to ensure legitimate faculty sponsorship and confirmed grant disbursements.
          </p>
        </div>
      </div>

      {/* Verification Philosophy Box */}
      <div className="bg-[#0B1F46] rounded-3xl p-8 sm:p-12 text-white space-y-6">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs uppercase font-medium text-blue-200">Our Guarantee</span>
          <h2 className="text-2xl font-bold font-sans">Direct Application Portals</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Every scholarship listed on Scholavon directs students to the genuine institutional application portal. We reject predatory pay-to-apply schemes and guarantee transparent criteria.
          </p>
        </div>
      </div>

    </div>
  );
};
