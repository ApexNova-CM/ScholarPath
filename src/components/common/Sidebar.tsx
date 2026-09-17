import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Search, Bookmark, Briefcase, 
  UserCheck, FileText, Bell, Settings, HelpCircle, 
  LogOut, ArrowLeft, X, ChevronLeft, ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  unreadNotificationCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  unreadNotificationCount = 0,
  isMobileOpen = false,
  onCloseMobile = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {}
}) => {
  const { user, logout } = useAuth();
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Independent scroll state for subtle visual scroll cues
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const [canScrollUpDesktop, setCanScrollUpDesktop] = useState(false);
  const [canScrollDownDesktop, setCanScrollDownDesktop] = useState(false);
  const [canScrollUpMobile, setCanScrollUpMobile] = useState(false);
  const [canScrollDownMobile, setCanScrollDownMobile] = useState(false);

  const checkScrollDesktop = () => {
    if (desktopNavRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = desktopNavRef.current;
      setCanScrollUpDesktop(scrollTop > 4);
      setCanScrollDownDesktop(scrollTop + clientHeight < scrollHeight - 4);
    }
  };

  const checkScrollMobile = () => {
    if (mobileNavRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = mobileNavRef.current;
      setCanScrollUpMobile(scrollTop > 4);
      setCanScrollDownMobile(scrollTop + clientHeight < scrollHeight - 4);
    }
  };

  useEffect(() => {
    checkScrollDesktop();
    const el = desktopNavRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollDesktop, { passive: true });
    }
    window.addEventListener('resize', checkScrollDesktop);
    return () => {
      if (el) el.removeEventListener('scroll', checkScrollDesktop);
      window.removeEventListener('resize', checkScrollDesktop);
    };
  }, [isCollapsed]);

  useEffect(() => {
    if (isMobileOpen) {
      checkScrollMobile();
      const el = mobileNavRef.current;
      if (el) {
        el.addEventListener('scroll', checkScrollMobile, { passive: true });
      }
      return () => {
        if (el) el.removeEventListener('scroll', checkScrollMobile);
      };
    }
  }, [isMobileOpen]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const overviewNav = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Find Scholarships', path: '/scholarships', icon: Search }
  ];

  const applicationsNav = [
    { label: 'Applications', path: '/applications', icon: Briefcase },
    { label: 'Saved Grants', path: '/saved', icon: Bookmark }
  ];

  const personalNav = [
    { label: 'Academic Profile', path: '/profile', icon: UserCheck },
    { label: 'Document Vault', path: '/documents', icon: FileText },
    { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadNotificationCount },
    { label: 'Settings', path: '/settings', icon: Settings }
  ];

  const handleNav = (path: string, isMobileAction = false) => {
    onNavigate(path);
    if (isMobileAction) {
      onCloseMobile();
    }
  };

  const handleLogout = () => {
    logout();
    onCloseMobile();
  };

  return (
    <>
      {/* ============================================================ */}
      {/* 1. DESKTOP & TABLET SIDEBAR (Collapsible, Independent Scroll) */}
      {/* ============================================================ */}
      <aside 
        className={`hidden md:flex flex-col bg-white text-slate-700 border-r border-slate-200 h-full max-h-screen sticky top-0 shrink-0 select-none z-20 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Top Section (Fixed / Shrink-0) */}
        <div className={`p-4 border-b border-slate-200/80 flex items-center shrink-0 ${
          isCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'
        }`}>
          <div 
            onClick={() => handleNav('/dashboard')}
            className={`flex items-center gap-2.5 cursor-pointer select-none ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="ScholarPath Student Portal"
          >
            <img
              src="/images/scholarpath-logo.png"
              alt="ScholarPath"
              className="h-8 w-auto object-contain shrink-0"
            />
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none truncate">
                  ScholarPath
                </span>
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block mt-0.5">
                  Student Portal
                </span>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Collapse Toggle Button */}
          <button
            id="sidebar-btn-collapse"
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* User Mini Card (Fixed / Shrink-0) */}
        {user && (
          <div className="p-3 shrink-0">
            {isCollapsed ? (
              <div 
                onClick={() => handleNav('/profile')}
                className="w-10 h-10 mx-auto rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
                title={`${user.firstName} ${user.lastName} (${user.profileCompletion}% complete)`}
                aria-label="View Profile"
              >
                {user.firstName[0]}{user.lastName[0]}
              </div>
            ) : (
              <div 
                onClick={() => handleNav('/profile')}
                className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col gap-2 cursor-pointer hover:bg-slate-100/70 transition-colors group"
                title="View Academic Profile"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {user.educationLevel || 'Undergraduate'}
                    </p>
                  </div>
                </div>

                {/* Profile completion bar */}
                <div className="pt-1.5 border-t border-slate-200/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>Profile Strength</span>
                    <span className="font-semibold text-indigo-600">{user.profileCompletion}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${user.profileCompletion}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Navigation Area: INDEPENDENTLY SCROLLABLE, HIDDEN SCROLLBAR */}
        {/* ============================================================ */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Subtle scroll cue top */}
          {canScrollUpDesktop && (
            <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-b from-slate-200/60 to-transparent pointer-events-none z-10" />
          )}

          <div 
            ref={desktopNavRef}
            className="h-full overflow-y-auto no-scrollbar px-3 py-2 space-y-4"
          >
            {/* Overview */}
            <div>
              {!isCollapsed ? (
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Overview
                </span>
              ) : (
                <div className="my-1 mx-2 border-t border-slate-200/80" />
              )}
              <div className="mt-1 space-y-0.5">
                {overviewNav.map((item) => {
                  const Icon = item.icon;
                  const basePath = currentPath.split('?')[0];
                  const isActive = basePath === item.path;
                  return (
                    <button
                      key={item.path}
                      id={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleNav(item.path)}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={`w-full flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                      } ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Applications */}
            <div>
              {!isCollapsed ? (
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Applications
                </span>
              ) : (
                <div className="my-1 mx-2 border-t border-slate-200/80" />
              )}
              <div className="mt-1 space-y-0.5">
                {applicationsNav.map((item) => {
                  const Icon = item.icon;
                  const basePath = currentPath.split('?')[0];
                  const isActive = basePath === item.path;
                  return (
                    <button
                      key={item.path}
                      id={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleNav(item.path)}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={`w-full flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                      } ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account & Records */}
            <div>
              {!isCollapsed ? (
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account & Records
                </span>
              ) : (
                <div className="my-1 mx-2 border-t border-slate-200/80" />
              )}
              <div className="mt-1 space-y-0.5">
                {personalNav.map((item) => {
                  const Icon = item.icon;
                  const basePath = currentPath.split('?')[0];
                  const isActive = basePath === item.path;
                  return (
                    <button
                      key={item.path}
                      id={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleNav(item.path)}
                      title={isCollapsed ? (item.badge ? `${item.label} (${item.badge})` : item.label) : undefined}
                      aria-label={item.label}
                      className={`relative w-full flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                      } ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {item.badge ? (
                        isCollapsed ? (
                          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-indigo-600" />
                        ) : (
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded-full shrink-0">
                            {item.badge}
                          </span>
                        )
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Subtle scroll cue bottom */}
          {canScrollDownDesktop && (
            <div className="absolute bottom-0 inset-x-0 h-3 bg-gradient-to-t from-slate-200/60 to-transparent pointer-events-none z-10" />
          )}
        </div>

        {/* ============================================================ */}
        {/* Bottom Section: PINNED TO BOTTOM, NEVER REQUIRES PAGE SCROLL */}
        {/* ============================================================ */}
        <div className="p-3 border-t border-slate-200/80 bg-white shrink-0 space-y-1">
          <button
            onClick={() => handleNav('/')}
            title={isCollapsed ? 'View Public Site' : undefined}
            aria-label="View Public Site"
            className={`w-full flex items-center rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <ArrowLeft size={16} className="shrink-0" />
            {!isCollapsed && <span className="truncate">View Public Site</span>}
          </button>

          <button
            id="sidebar-btn-help"
            onClick={() => setShowHelpModal(true)}
            title={isCollapsed ? 'Help & Guide' : undefined}
            aria-label="Help and Guide"
            className={`w-full flex items-center rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <HelpCircle size={16} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Help & Guide</span>}
          </button>

          <button
            id="sidebar-btn-logout"
            onClick={handleLogout}
            title={isCollapsed ? 'Logout' : undefined}
            aria-label="Logout"
            className={`w-full flex items-center rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <LogOut size={16} className="shrink-0" />
            {!isCollapsed && <span className="truncate font-semibold">Logout</span>}
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MOBILE DRAWER (Overlay on screens < md, Independent Scroll) */}
      {/* ============================================================ */}
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
            aria-label="Mobile Navigation Drawer"
          >
            {/* Header with Brand & Close Button */}
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div 
                onClick={() => handleNav('/dashboard', true)}
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
                  <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block mt-0.5">
                    Student Portal
                  </span>
                </div>
              </div>

              <button
                id="btn-close-mobile-drawer"
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* User Mini Card in Drawer */}
            {user && (
              <div className="p-3 shrink-0">
                <div 
                  onClick={() => handleNav('/profile', true)}
                  className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col gap-2 cursor-pointer hover:bg-slate-100/70 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {user.educationLevel || 'Undergraduate'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>Profile Strength</span>
                      <span className="font-semibold text-indigo-600">{user.profileCompletion}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${user.profileCompletion}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Independently Scrollable Navigation */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {canScrollUpMobile && (
                <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-b from-slate-200/60 to-transparent pointer-events-none z-10" />
              )}

              <div 
                ref={mobileNavRef}
                className="h-full overflow-y-auto no-scrollbar px-3 py-2 space-y-4"
              >
                {/* Overview */}
                <div>
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Overview
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {overviewNav.map((item) => {
                      const Icon = item.icon;
                      const basePath = currentPath.split('?')[0];
                      const isActive = basePath === item.path;
                      return (
                        <button
                          key={item.path}
                          id={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => handleNav(item.path, true)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                          }`}
                        >
                          <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Applications */}
                <div>
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Applications
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {applicationsNav.map((item) => {
                      const Icon = item.icon;
                      const basePath = currentPath.split('?')[0];
                      const isActive = basePath === item.path;
                      return (
                        <button
                          key={item.path}
                          id={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => handleNav(item.path, true)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                          }`}
                        >
                          <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account & Records */}
                <div>
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Account & Records
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {personalNav.map((item) => {
                      const Icon = item.icon;
                      const basePath = currentPath.split('?')[0];
                      const isActive = basePath === item.path;
                      return (
                        <button
                          key={item.path}
                          id={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => handleNav(item.path, true)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={16} className={isActive ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge ? (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded-full">
                              {item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {canScrollDownMobile && (
                <div className="absolute bottom-0 inset-x-0 h-3 bg-gradient-to-t from-slate-200/60 to-transparent pointer-events-none z-10" />
              )}
            </div>

            {/* Mobile Drawer Bottom Section (Fixed & Pinned) */}
            <div className="p-3 border-t border-slate-200/80 bg-white shrink-0 space-y-1">
              <button
                onClick={() => handleNav('/', true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>View Public Site</span>
              </button>

              <button
                id="mobile-sidebar-btn-help"
                onClick={() => {
                  setShowHelpModal(true);
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                <HelpCircle size={16} />
                <span>Help & Guide</span>
              </button>

              <button
                id="mobile-sidebar-btn-logout"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span className="font-semibold">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle size={18} className="text-indigo-600" />
                <span>ScholarPath Help & Guide</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Eligibility Matching:</strong> Matches are computed deterministically against your academic profile criteria (GPA, major, education level, country). Keep your profile 100% updated for optimal accuracy.
              </p>
              <p>
                <strong>Applying:</strong> ScholarPath prepares your document checklists and provides direct links to verified official provider portals. After applying externally, click "I've Applied" to track milestones.
              </p>
              <p>
                <strong>Verification:</strong> The <em>✓ Verified</em> badge denotes opportunities audited for legitimacy by the ScholarPath verification review board.
              </p>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
