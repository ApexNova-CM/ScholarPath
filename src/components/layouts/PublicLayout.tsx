import React, { useState } from 'react';
import { Navbar } from '../common/Navbar';
import { Heart, Shield, Award, Mail, ExternalLink, MessageSquare } from 'lucide-react';
import { ContactSupportModal } from '../common/ContactSupportModal';

interface PublicLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, currentPath, onNavigate }) => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

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
                  src="/images/scholavon-logo.png"
                  alt="Scholavon"
                  className="h-8 w-auto object-contain shrink-0"
                />
                <span className="text-lg font-bold text-white tracking-tight">
                  Scholavon
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Empowering students to discover vetted scholarships, assess real-time eligibility matched to your profile, and navigate deadlines with confidence.
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
                  <button onClick={() => onNavigate('/scholarships')} className="hover:text-white transition-colors cursor-pointer">
                    Find Scholarships
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=stem')} className="hover:text-white transition-colors cursor-pointer">
                    STEM Fellowships
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=undergraduate')} className="hover:text-white transition-colors cursor-pointer">
                    Undergraduate Awards
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/scholarships?category=postgraduate')} className="hover:text-white transition-colors cursor-pointer">
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
                  <button onClick={() => onNavigate('/how-it-works')} className="hover:text-white transition-colors cursor-pointer">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/about')} className="hover:text-white transition-colors cursor-pointer">
                    About Scholavon
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors cursor-pointer">
                    Student Portal
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">
                    Privacy Policy
                  </button>
                </li>
              </ul>
            </div>

            {/* Human Support */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Support & Help</h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <a
                    href="mailto:support@scholavon.com"
                    className="hover:text-white transition-colors flex items-center gap-1.5 text-indigo-400 font-semibold"
                  >
                    <Mail size={13} />
                    <span>support@scholavon.com</span>
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                  >
                    <MessageSquare size={13} />
                    <span>Contact Support Form</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">
                    Terms of Service
                  </button>
                </li>
                <li className="text-[11px] text-slate-500 pt-1">
                  Transparent criteria • Dedicated support
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} Scholavon. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Opportunities within reach
            </p>
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
