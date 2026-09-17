import React from 'react';
import { Menu } from 'lucide-react';

export interface MobileHeaderProps {
  onOpenMenu: () => void;
  onNavigate: (path: string) => void;
  portalType?: 'public' | 'student' | 'admin';
  subtitle?: string;
  badge?: number | string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenMenu,
  onNavigate,
  portalType = 'public',
  subtitle,
  badge
}) => {
  const getSubtitle = () => {
    if (subtitle) return subtitle;
    if (portalType === 'student') return 'Student Portal';
    if (portalType === 'admin') return 'Admin Console';
    return 'Your path to the right scholarship';
  };

  const handleBrandClick = () => {
    if (portalType === 'admin') {
      onNavigate('/admin/dashboard');
    } else if (portalType === 'student') {
      onNavigate('/dashboard');
    } else {
      onNavigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 md:hidden shrink-0">
      <div className="px-4 sm:px-6 flex items-center justify-between h-16 max-w-7xl mx-auto">
        {/* Left: ScholarPath Brand Logo & Title */}
        <div
          onClick={handleBrandClick}
          className="flex items-center gap-2.5 cursor-pointer select-none group min-w-0"
          title="ScholarPath Home"
        >
          <img
            src="/images/scholarpath-logo.png"
            alt="ScholarPath"
            className="h-8 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 block leading-none truncate">
              ScholarPath
            </span>
            <span
              className={`text-[10px] font-medium block mt-0.5 tracking-wide truncate ${
                portalType === 'admin'
                  ? 'text-amber-700 font-semibold uppercase tracking-wider'
                  : 'text-indigo-600'
              }`}
            >
              {getSubtitle()}
            </span>
          </div>
        </div>

        {/* Right: Notification badge (optional) + Hamburger Menu Button */}
        <div className="flex items-center gap-2 shrink-0">
          {badge !== undefined && Number(badge) > 0 && (
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
          <button
            id="mobile-header-menu-btn"
            type="button"
            onClick={onOpenMenu}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu size={22} className="stroke-[2.2]" />
          </button>
        </div>
      </div>
    </header>
  );
};
