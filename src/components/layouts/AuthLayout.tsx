import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  portal?: string;
  onNavigate: (path: string) => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, onNavigate }) => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-xs">
        <div 
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <img
            src="/images/scholarpath-logo.png"
            alt="ScholarPath"
            className="h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          <div>
            <span className="text-sm font-bold tracking-tight block text-slate-900">
              ScholarPath
            </span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('/')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>Back to Home</span>
        </button>
      </header>

      {/* Main card container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white/40">
        <p>ScholarPath • Your path to the right scholarship</p>
      </footer>
    </div>
  );
};
