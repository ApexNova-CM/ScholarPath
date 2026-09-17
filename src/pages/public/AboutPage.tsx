import React from 'react';
import { Compass, Shield, Award, Users, CheckCircle2 } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Our Mission</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">About ScholarPath</h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Dedicated to removing barriers, eliminating predatory scholarship scams, and connecting hardworking students with genuine academic funding.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-slate-900">The Problem We Solve</h2>
        <p>
          Students worldwide spend hundreds of hours browsing through outdated search engines, encountering scam links, dead deadlines, or vague eligibility criteria that leave them uncertain of their chances.
        </p>
        <p>
          ScholarPath was founded on the principle of complete transparency. We believe every scholarship listed should link to a legitimate provider, clearly disclose all hard and soft requirements, and allow students to evaluate their real fit before applying.
        </p>

        <h2 className="text-lg font-bold text-slate-900 pt-4">Our Verification Philosophy</h2>
        <p>
          Rather than relying on algorithmic aggregators or inflated trust promises, our verification review team individually audits each submitted opportunity. We confirm provider credentials, verify deadline validity, and provide direct application URLs to official endowment websites.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Integrity First</h4>
            <p className="text-xs text-slate-500 mt-1">No paid placement or unverified promotional listings.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Deterministic Matching</h4>
            <p className="text-xs text-slate-500 mt-1">Realistic match scores with explicit reasons for every check.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Student Privacy</h4>
            <p className="text-xs text-slate-500 mt-1">Your documents and academic records remain private.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
