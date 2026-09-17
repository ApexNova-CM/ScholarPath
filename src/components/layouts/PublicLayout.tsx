import React from 'react';
import { Navbar } from '../common/Navbar';
import { Heart, Shield, Award, Mail, ExternalLink } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, currentPath, onNavigate }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="flex-1">
        {children}
      </main>

      {/* Modern Footer */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-slate-850">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <div 
                onClick={() => onNavigate('/')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <img
                  src="/images/scholarpath-logo.png"
                  alt="ScholarPath"
                  className="h-8 w-auto object-contain shrink-0"
                />
                <span className="text-lg font-bold text-white tracking-tight">
                  ScholarPath
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Empowering students to discover vetted scholarships, assess real-time eligibility with deterministic matching, and navigate deadlines with confidence.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2">
                <Shield size={14} className="text-emerald-500" />
                <span>Verified Provider Network & Authentic Application Portals</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Discovery</h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <button onClick={() => onNavigate('/scholarships')} className="hover:text-white transition-colors">
                    Find Scholarships
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=stem')} className="hover:text-white transition-colors">
                    STEM Fellowships
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=undergraduate')} className="hover:text-white transition-colors">
                    Undergraduate Awards
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=postgraduate')} className="hover:text-white transition-colors">
                    Postgraduate & PhD Grants
                  </button>
                </li>
              </ul>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Platform</h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <button onClick={() => onNavigate('/how-it-works')} className="hover:text-white transition-colors">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/about')} className="hover:text-white transition-colors">
                    About ScholarPath
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors">
                    Student Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Trust & Safety</h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors">
                    Terms of Service
                  </button>
                </li>
                <li className="text-[11px] text-slate-500 pt-2">
                  Transparent criteria • No unverified claims
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} ScholarPath. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Your path to the right scholarship
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
