import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, LayoutDashboard, Award, PlusCircle, 
  CheckCircle2, Clock, Building2, Users, FileSpreadsheet, 
  FolderTree, Bell, Settings, UserCog, LogOut, ArrowLeft, X
} from 'lucide-react';

interface AdminSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  pendingVerificationCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentPath,
  onNavigate,
  pendingVerificationCount = 0,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user, logout } = useAuth();

  // Handle body scroll lock and escape key for mobile drawer
  useEffect(() => {
    if (!isMobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  const overviewNav = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }
  ];

  const scholarshipNav = [
    { label: 'All Scholarships', path: '/admin/scholarships', icon: Award },
    { label: 'Add Scholarship', path: '/admin/scholarships/new', icon: PlusCircle },
    { label: 'Pending Verification', path: '/admin/verification', icon: CheckCircle2, badge: pendingVerificationCount },
    { label: 'Verified Scholarships', path: '/admin/scholarships?status=verified', icon: CheckCircle2 },
    { label: 'Expired Scholarships', path: '/admin/scholarships?status=expired', icon: Clock }
  ];

  const managementNav = [
    { label: 'Admin Management', path: '/admin/admins', icon: ShieldCheck },
    { label: 'Providers', path: '/admin/providers', icon: Building2 },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Applications', path: '/admin/applications', icon: FileSpreadsheet },
    { label: 'Categories', path: '/admin/categories', icon: FolderTree }
  ];

  const systemNav = [
    { label: 'Notifications', path: '/admin/notifications', icon: Bell },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
    { label: 'Admin Profile', path: '/admin/profile', icon: UserCog }
  ];

  const handleNav = (path: string, isMobile = false) => {
    onNavigate(path);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavSections = (isMobile = false) => (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 no-scrollbar">
      {/* Overview */}
      <div>
        <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Overview
        </span>
        <div className="mt-1 space-y-0.5">
          {overviewNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                id={`${isMobile ? 'mob-' : ''}admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleNav(item.path, isMobile)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scholarship Management */}
      <div>
        <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Scholarship Management
        </span>
        <div className="mt-1 space-y-0.5">
          {scholarshipNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                id={`${isMobile ? 'mob-' : ''}admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleNav(item.path, isMobile)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Management */}
      <div>
        <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Management
        </span>
        <div className="mt-1 space-y-0.5">
          {managementNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                id={`${isMobile ? 'mob-' : ''}admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleNav(item.path, isMobile)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* System */}
      <div>
        <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          System
        </span>
        <div className="mt-1 space-y-0.5">
          {systemNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                id={`${isMobile ? 'mob-' : ''}admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleNav(item.path, isMobile)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Admin Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 bg-white text-slate-700 border-r border-slate-200 h-screen sticky top-0 shrink-0 select-none z-20">
        {/* Admin Brand Header */}
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div 
            onClick={() => onNavigate('/admin/dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <img
              src="/images/scholarpath-logo.png"
              alt="ScholarPath"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none">
                ScholarPath
              </span>
              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mt-0.5">
                Admin Console
              </span>
            </div>
          </div>
        </div>

        {/* Admin User info */}
        {user && (
          <div className="mx-3 my-3 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                System Administrator
              </p>
            </div>
          </div>
        )}

        {/* Scrollable Navigation */}
        {renderNavSections(false)}

        {/* Footer */}
        <div className="p-3 border-t border-slate-200/80 space-y-1 shrink-0">
          <button
            onClick={() => onNavigate('/')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>View Public Site</span>
          </button>
          <button
            id="admin-btn-logout"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Mobile Admin Navigation Drawer (overlay on screens < md) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <aside
            className="relative z-50 w-72 max-w-[85vw] bg-white text-slate-700 shadow-2xl flex flex-col h-full h-[100dvh] select-none animate-in slide-in-from-left duration-200"
            aria-label="Admin Navigation Drawer"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div
                onClick={() => handleNav('/admin/dashboard', true)}
                className="flex items-center gap-2.5 cursor-pointer select-none"
              >
                <img
                  src="/images/scholarpath-logo.png"
                  alt="ScholarPath"
                  className="h-8 w-auto object-contain shrink-0"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none">
                    Scholar Path
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block mt-0.5">
                    Admin Console
                  </span>
                </div>
              </div>

              <button
                id="btn-close-admin-drawer"
                type="button"
                onClick={onCloseMobile}
                className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Admin User info in Drawer */}
            {user && (
              <div className="mx-3 my-2.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    System Administrator
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable Navigation */}
            {renderNavSections(true)}

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-200/80 space-y-1 shrink-0 bg-slate-50/50">
              <button
                onClick={() => handleNav('/', true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>View Public Site</span>
              </button>
              <button
                id="admin-drawer-btn-logout"
                onClick={() => { logout(); onCloseMobile?.(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
