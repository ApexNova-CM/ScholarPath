import React, { useState } from 'react';
import { Navbar } from '../common/Navbar';
import { Heart, Shield, Award, Mail, ExternalLink, MessageSquare, Globe, ShieldCheck } from 'lucide-react';
import { ContactSupportModal } from '../common/ContactSupportModal';

interface PublicLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, currentPath, onNavigate }) => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-slate-900 selection:bg-[#155EEF] selection:text-white">
      <Navbar currentPath={currentPath} onNavigate={onNavigate} />

      <main className="flex-1">
        {children}
      </main>

      {/* Collegiate Footer */}
      <footer className="bg-[#0B1F46] text-slate-400 border-t border-[#102a5c] mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-2 space-y-4">
              <div 
                onClick={() => onNavigate('/')}
                className="flex items-center gap-2.5 cursor-pointer select-none"
              >
                <img
                  src="/images/scholavon-logo.png"
                  alt="Scholavon"
                  className="h-9 w-auto object-contain shrink-0"
                />
                <span className="font-sans text-xl font-bold text-white tracking-tight">
                  Scholavon
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
                Opportunities Within Reach. A modern scholarship platform bridging ambitious scholars with verified university endowments, global research grants, and merit fellowships worldwide.
              </p>
              <div className="flex items-center gap-6 pt-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Verified Endowments
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#2F80ED]" />
                  160+ Countries
                </span>
              </div>
            </div>

            {/* Platform Navigation */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Platform</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors cursor-pointer">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships')} className="hover:text-white transition-colors cursor-pointer">
                    Find Scholarships
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/how-it-works')} className="hover:text-white transition-colors cursor-pointer">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/about')} className="hover:text-white transition-colors cursor-pointer">
                    About Us
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/resources')} className="hover:text-white transition-colors cursor-pointer">
                    Resources & Guides
                  </button>
                </li>
              </ul>
            </div>

            {/* Scholars Workstation */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Scholars</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <button onClick={() => onNavigate('/dashboard')} className="hover:text-white transition-colors cursor-pointer">
                    Student Dashboard
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/applications')} className="hover:text-white transition-colors cursor-pointer">
                    Application Tracker
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/saved')} className="hover:text-white transition-colors cursor-pointer">
                    Saved Awards & Comparison
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/profile')} className="hover:text-white transition-colors cursor-pointer">
                    Profile & Settings
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors cursor-pointer">
                    Sign In / Register
                  </button>
                </li>
              </ul>
            </div>

            {/* Support & Compliance */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Support & Trust</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                All scholarship opportunities on Scholavon undergo strict institutional verification to ensure legitimacy and student protection.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm pt-1">
                <li>
                  <a
                    href="mailto:support@scholavon.com"
                    className="hover:text-white transition-colors flex items-center gap-1.5 text-[#2F80ED] font-medium"
                  >
                    <Mail size={13} />
                    <span>support@scholavon.com</span>
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-left text-slate-300"
                  >
                    <MessageSquare size={13} />
                    <span>Contact Support Form</span>
                  </button>
                </li>
              </ul>
              <div className="pt-2 text-[11px] text-slate-400">
                FERPA & GDPR Compliant · Zero Application Surcharges
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-[#102a5c] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              © {new Date().getFullYear()} Scholavon. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => onNavigate('/privacy')} className="hover:text-slate-200 cursor-pointer">Privacy Policy</button>
              <button onClick={() => onNavigate('/terms')} className="hover:text-slate-200 cursor-pointer">Terms of Service</button>
              <span className="text-slate-500">Opportunities Within Reach</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Contact Support Modal */}
      <ContactSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
};
