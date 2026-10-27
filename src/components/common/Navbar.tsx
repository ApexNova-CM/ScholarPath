import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Compass, Search, Bookmark, User, X, ArrowRight, ShieldCheck,
  FileText, Bell, Settings, LogOut, HelpCircle, Info, ChevronDown,
  LayoutDashboard, Menu, BarChart2, Users, CheckSquare, Building2,
  Tag, MessageSquare, FolderOpen, Globe,
} from 'lucide-react';

type PortalType = 'public' | 'student' | 'admin';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  portalType?: PortalType;
  unreadCount?: number;
  savedCount?: number;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  portalType = 'public',
  unreadCount = 0,
  savedCount = 0,
  pendingCount = 0,
}) => {
  const { user, isAuthenticated, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileDropdownOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [profileDropdownOpen]);

  // Lock body scroll and listen for Escape when mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleNav = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  };

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    logout();
  };

  const avatarInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const isActive = (path: string) =>
    path === '/' ? currentPath === '/' : currentPath.startsWith(path);

  const navLinkClass = (path: string) =>
    `text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
      isActive(path) ? 'text-[#155EEF]' : 'text-slate-600 hover:text-[#0B1F46]'
    }`;

  const dropdownLinkClass = (path: string) =>
    `w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
      isActive(path)
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-700 hover:bg-slate-50 font-medium'
    }`;

  // â”€â”€ Profile Pill + Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ProfileDropdown = () => (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setProfileDropdownOpen((o) => !o)}
        className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full border border-[#E2E8F0] bg-white hover:bg-slate-50 transition-colors cursor-pointer select-none"
        aria-haspopup="true"
        aria-expanded={profileDropdownOpen}
      >
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold shrink-0">
          {avatarInitials}
        </div>
        <span className="text-xs font-semibold text-slate-800 max-w-[80px] truncate">
          {user?.firstName ?? 'Account'}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-150 ${profileDropdownOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {profileDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E2E8F0] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900 truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{user?.email}</p>
          </div>

          <div className="py-1">
            {portalType === 'student' && (
              <>
                <button onClick={() => handleNav('/dashboard')} className={dropdownLinkClass('/dashboard')}>
                  <LayoutDashboard size={14} className="shrink-0" /> Student Dashboard
                </button>
                <button onClick={() => handleNav('/scholarships')} className={dropdownLinkClass('/scholarships')}>
                  <Search size={14} className="shrink-0" /> Find Scholarships
                </button>
                <button onClick={() => handleNav('/applications')} className={dropdownLinkClass('/applications')}>
                  <Compass size={14} className="shrink-0" /> My Applications
                </button>
                <button onClick={() => handleNav('/saved')} className={dropdownLinkClass('/saved')}>
                  <Bookmark size={14} className="shrink-0" />
                  <span className="flex-1">Saved Scholarships</span>
                  {savedCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5">
                      {savedCount}
                    </span>
                  )}
                </button>
                <button onClick={() => handleNav('/profile')} className={dropdownLinkClass('/profile')}>
                  <User size={14} className="shrink-0" /> My Profile
                </button>
                <button onClick={() => handleNav('/documents')} className={dropdownLinkClass('/documents')}>
                  <FileText size={14} className="shrink-0" /> Document Vault
                </button>
                <button onClick={() => handleNav('/notifications')} className={dropdownLinkClass('/notifications')}>
                  <Bell size={14} className="shrink-0" />
                  <span className="flex-1">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-rose-100 text-rose-600 rounded-full px-1.5 py-0.5">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button onClick={() => handleNav('/settings')} className={dropdownLinkClass('/settings')}>
                  <Settings size={14} className="shrink-0" /> Settings
                </button>
                <button
                  onClick={() => { setProfileDropdownOpen(false); setShowHelpModal(true); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <HelpCircle size={14} className="shrink-0" /> Help &amp; Guide
                </button>
              </>
            )}

            {portalType === 'admin' && (
              <>
                <button onClick={() => handleNav('/admin/dashboard')} className={dropdownLinkClass('/admin/dashboard')}>
                  <LayoutDashboard size={14} className="shrink-0" /> Admin Dashboard
                </button>
                <button onClick={() => handleNav('/admin/scholarships')} className={dropdownLinkClass('/admin/scholarships')}>
                  <Search size={14} className="shrink-0" /> All Scholarships
                </button>
                <button onClick={() => handleNav('/admin/verification')} className={dropdownLinkClass('/admin/verification')}>
                  <CheckSquare size={14} className="shrink-0" />
                  <span className="flex-1">Pending Verification</span>
                  {pendingCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button onClick={() => handleNav('/admin/applications')} className={dropdownLinkClass('/admin/applications')}>
                  <Compass size={14} className="shrink-0" /> Applications
                </button>
                <button onClick={() => handleNav('/admin/providers')} className={dropdownLinkClass('/admin/providers')}>
                  <Building2 size={14} className="shrink-0" /> Providers
                </button>
                <button onClick={() => handleNav('/admin/users')} className={dropdownLinkClass('/admin/users')}>
                  <Users size={14} className="shrink-0" /> Users
                </button>
                <button onClick={() => handleNav('/admin/reports')} className={dropdownLinkClass('/admin/reports')}>
                  <BarChart2 size={14} className="shrink-0" /> Reports
                </button>
                <button onClick={() => handleNav('/admin/settings')} className={dropdownLinkClass('/admin/settings')}>
                  <Settings size={14} className="shrink-0" /> Settings
                </button>
              </>
            )}
          </div>

          <div className="border-t border-slate-100 pt-1">
            {portalType === 'admin' && (
              <button
                onClick={() => handleNav('/')}
                className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Globe size={14} className="shrink-0" /> View Public Site
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <LogOut size={14} className="shrink-0" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // â”€â”€ Desktop nav links per portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DesktopNavLinks = () => {
    if (portalType === 'student') {
      return (
        <nav className="flex items-center gap-5">
          <button onClick={() => handleNav('/dashboard')} className={navLinkClass('/dashboard')}>Dashboard</button>
          <button onClick={() => handleNav('/scholarships')} className={navLinkClass('/scholarships')}>Find Scholarships</button>
          <button onClick={() => handleNav('/applications')} className={navLinkClass('/applications')}>Applications</button>
          <button onClick={() => handleNav('/saved')} className={navLinkClass('/saved')}>
            Saved
            {savedCount > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 inline-block">{savedCount}</span>
            )}
          </button>
        </nav>
      );
    }
    if (portalType === 'admin') {
      return (
        <nav className="flex items-center gap-5">
          <button onClick={() => handleNav('/admin/dashboard')} className={navLinkClass('/admin/dashboard')}>Dashboard</button>
          <button onClick={() => handleNav('/admin/scholarships')} className={navLinkClass('/admin/scholarships')}>Scholarships</button>
          <button onClick={() => handleNav('/admin/verification')} className={navLinkClass('/admin/verification')}>
            Verification
            {pendingCount > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 inline-block">{pendingCount}</span>
            )}
          </button>
          <button onClick={() => handleNav('/admin/applications')} className={navLinkClass('/admin/applications')}>Applications</button>
          <button onClick={() => handleNav('/admin/users')} className={navLinkClass('/admin/users')}>Users</button>
        </nav>
      );
    }
    return (
      <nav className="flex items-center gap-6">
        <button id="nav-link-scholarships" onClick={() => handleNav('/scholarships')} className={navLinkClass('/scholarships')}>Find Scholarships</button>
        {isAuthenticated && role === 'student' && (
          <>
            <button id="nav-link-saved" onClick={() => handleNav('/saved')} className={navLinkClass('/saved')}>Saved</button>
            <button id="nav-link-applications" onClick={() => handleNav('/applications')} className={navLinkClass('/applications')}>Applications</button>
          </>
        )}
        <button id="nav-link-how-it-works" onClick={() => handleNav('/how-it-works')} className={navLinkClass('/how-it-works')}>How It Works</button>
        <button id="nav-link-about" onClick={() => handleNav('/about')} className={navLinkClass('/about')}>About</button>
        <button id="nav-link-resources" onClick={() => handleNav('/resources')} className={navLinkClass('/resources')}>Resources</button>
      </nav>
    );
  };

  // â”€â”€ Desktop right-side actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DesktopActions = () => {
    if ((portalType === 'student' || portalType === 'admin') && isAuthenticated && user) {
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNav(portalType === 'admin' ? '/admin/notifications' : '/notifications')}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-rose-500 text-white rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <ProfileDropdown />
        </div>
      );
    }
    if (isAuthenticated && user && role === 'student') {
      return (
        <div className="flex items-center gap-3">
          <button id="nav-student-dashboard" onClick={() => handleNav('/dashboard')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#155EEF] text-white px-3.5 py-2 rounded-xl hover:bg-[#124bbf] transition-colors shadow-2xs cursor-pointer">
            <User size={14} /><span>My Dashboard</span>
          </button>
          <button id="nav-btn-logout" onClick={logout} className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 transition-colors cursor-pointer">Logout</button>
        </div>
      );
    }
    if (isAuthenticated && user && role === 'admin') {
      return (
        <div className="flex items-center gap-3">
          <button id="nav-admin-dashboard" onClick={() => handleNav('/admin/dashboard')} className="flex items-center gap-1.5 text-xs font-semibold bg-[#155EEF] text-white px-3.5 py-2 rounded-xl hover:bg-[#124bbf] transition-colors shadow-2xs cursor-pointer">
            <ShieldCheck size={14} /><span>Dashboard</span>
          </button>
          <button id="nav-btn-logout" onClick={logout} className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 transition-colors cursor-pointer">Logout</button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <button id="nav-btn-login" onClick={() => handleNav('/login')} className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">Sign In</button>
        <button id="nav-btn-register" onClick={() => handleNav('/register')} className="text-xs font-semibold bg-[#155EEF] hover:bg-[#124bbf] text-white px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
          <span>Get Started</span><ArrowRight size={13} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Header (md+) */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div
              onClick={() => onNavigate(portalType === 'admin' ? '/admin/dashboard' : portalType === 'student' ? '/dashboard' : '/')}
              className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
            >
              <img src="/images/scholavon-logo.png" alt="Scholavon" className="h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-base font-bold tracking-tight text-[#0B1F46] block leading-none">Scholavon</span>
                <span className="text-[10px] font-medium text-[#155EEF] block mt-0.5 tracking-wide">Opportunities Within Reach</span>
              </div>
            </div>
            <DesktopNavLinks />
            <DesktopActions />
          </div>
        </div>
      </header>

      {/* 2. Mobile Header bar (< md) */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-white border-b border-[#E2E8F0] h-14 flex items-center px-4 justify-between">
        <div
          onClick={() => handleNav(portalType === 'admin' ? '/admin/dashboard' : portalType === 'student' ? '/dashboard' : '/')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <img src="/images/scholavon-logo.png" alt="Scholavon" className="h-7 w-auto object-contain shrink-0" />
          <span className="text-sm font-bold text-[#0B1F46] tracking-tight">Scholavon</span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={() => handleNav(portalType === 'admin' ? '/admin/notifications' : '/notifications')}
              className="relative p-1.5 text-slate-500 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-rose-500 text-white rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center min-w-[40px] min-h-[40px]"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* 3. Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="nav-mobile-drawer"
            className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white text-slate-700 shadow-2xl flex flex-col h-full h-[100dvh] select-none animate-in slide-in-from-left duration-200"
            aria-label="Mobile Navigation Drawer"
          >
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div
                onClick={() => handleNav(portalType === 'admin' ? '/admin/dashboard' : portalType === 'student' ? '/dashboard' : '/')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <img src="/images/scholavon-logo.png" alt="Scholavon" className="h-8 w-auto object-contain shrink-0" />
                <div>
                  <span className="text-sm font-bold text-[#0B1F46] tracking-tight block leading-none">Scholavon</span>
                  <span className="text-[10px] text-[#155EEF] font-medium block mt-0.5">Opportunities Within Reach</span>
                </div>
              </div>
              <button
                id="btn-close-public-drawer"
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
              {/* Student Drawer */}
              {portalType === 'student' && isAuthenticated && user ? (
                <div className="space-y-4">
                  <div
                    onClick={() => handleNav('/profile')}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">{avatarInitials}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {([
                      { label: 'Student Dashboard', path: '/dashboard', icon: <LayoutDashboard size={16} /> },
                      { label: 'Find Scholarships', path: '/scholarships', icon: <Search size={16} /> },
                      { label: 'Saved Scholarships', path: '/saved', icon: <Bookmark size={16} />, badge: savedCount },
                      { label: 'Applications', path: '/applications', icon: <Compass size={16} /> },
                      { label: 'My Profile', path: '/profile', icon: <User size={16} /> },
                      { label: 'Document Vault', path: '/documents', icon: <FileText size={16} /> },
                      { label: 'Notifications', path: '/notifications', icon: <Bell size={16} />, badge: unreadCount },
                      { label: 'My Reports', path: '/my-reports', icon: <BarChart2 size={16} /> },
                      { label: 'Settings', path: '/settings', icon: <Settings size={16} /> },
                    ] as Array<{ label: string; path: string; icon: React.ReactNode; badge?: number }>).map(({ label, path, icon, badge }) => (
                      <button
                        key={path}
                        onClick={() => handleNav(path)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                          isActive(path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={isActive(path) ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
                        <span className="flex-1">{label}</span>
                        {badge && badge > 0 ? (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-600 rounded-full px-1.5 py-0.5">{badge}</span>
                        ) : null}
                      </button>
                    ))}
                    <button
                      onClick={() => { setMobileMenuOpen(false); setShowHelpModal(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle size={16} className="text-slate-400" /><span>Help &amp; Guide</span>
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <button onClick={() => handleNav('/how-it-works')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer">
                      <HelpCircle size={16} className="text-slate-400" /><span>How It Works</span>
                    </button>
                    <button onClick={() => handleNav('/about')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer">
                      <Info size={16} className="text-slate-400" /><span>About Scholavon</span>
                    </button>
                  </div>
                </div>
              ) : portalType === 'admin' && isAuthenticated && user ? (
                /* Admin Drawer */
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">{avatarInitials}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-slate-500 truncate">System Administrator</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {([
                      { label: 'Admin Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={16} /> },
                      { label: 'All Scholarships', path: '/admin/scholarships', icon: <Search size={16} /> },
                      { label: 'Pending Verification', path: '/admin/verification', icon: <CheckSquare size={16} />, badge: pendingCount },
                      { label: 'Applications', path: '/admin/applications', icon: <Compass size={16} /> },
                      { label: 'Reports', path: '/admin/reports', icon: <BarChart2 size={16} /> },
                      { label: 'Providers', path: '/admin/providers', icon: <Building2 size={16} /> },
                      { label: 'Users', path: '/admin/users', icon: <Users size={16} /> },
                      { label: 'Categories', path: '/admin/categories', icon: <Tag size={16} /> },
                      { label: 'Admins', path: '/admin/admins', icon: <ShieldCheck size={16} /> },
                      { label: 'Notifications', path: '/admin/notifications', icon: <MessageSquare size={16} /> },
                      { label: 'Settings', path: '/admin/settings', icon: <Settings size={16} /> },
                      { label: 'Admin Profile', path: '/admin/profile', icon: <User size={16} /> },
                    ] as Array<{ label: string; path: string; icon: React.ReactNode; badge?: number }>).map(({ label, path, icon, badge }) => (
                      <button
                        key={path}
                        onClick={() => handleNav(path)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                          isActive(path) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                      >
                        <span className={isActive(path) ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
                        <span className="flex-1">{label}</span>
                        {badge && badge > 0 ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">{badge}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <button onClick={() => handleNav('/')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer">
                      <Globe size={16} className="text-slate-400" /><span>View Public Site</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Public Drawer */
                <div className="space-y-4">
                  {isAuthenticated && user && (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">{avatarInitials}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    {[
                      { label: 'Find Scholarships', path: '/scholarships', icon: <Search size={18} /> },
                      { label: 'How It Works', path: '/how-it-works', icon: <HelpCircle size={18} /> },
                      { label: 'About Scholavon', path: '/about', icon: <Info size={18} /> },
                      { label: 'Resources', path: '/resources', icon: <FolderOpen size={18} /> },
                    ].map(({ label, path, icon }) => (
                      <button
                        key={path}
                        onClick={() => handleNav(path)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left cursor-pointer ${
                          isActive(path) ? 'bg-blue-50 text-[#155EEF]' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={isActive(path) ? 'text-[#155EEF]' : 'text-slate-400'}>{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                  {!isAuthenticated && (
                    <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                      <button id="mob-nav-signin" onClick={() => handleNav('/login')} className="w-full py-3 px-4 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors text-center min-h-[44px] flex items-center justify-center cursor-pointer">Sign In</button>
                      <button id="mob-nav-register" onClick={() => handleNav('/register')} className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-xl transition-colors text-center shadow-xs min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer">
                        <span>Get Started</span><ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 shrink-0">
              {isAuthenticated ? (
                <button
                  id="mob-nav-logout"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} /><span>Sign Out</span>
                </button>
              ) : (
                <p className="text-[11px] text-slate-500 text-center font-medium">
                  Verified Scholarships â€¢ Matched to Your Profile
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 4. Help Modal (student portal) */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle size={18} className="text-indigo-600" />
                <span>Scholavon Help &amp; Guide</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p><strong>Eligibility Matching:</strong> Matches are computed accurately against your academic profile criteria (GPA, major, education level, country). Keep your profile 100% updated for optimal accuracy.</p>
              <p><strong>Applying:</strong> Scholavon prepares your document checklists and provides direct links to verified official provider portals. After applying externally, click "I've Applied" to track milestones.</p>
              <p><strong>Verification:</strong> The <em>âœ“ Verified</em> badge denotes opportunities audited for legitimacy by the Scholavon verification review board.</p>
              <p><strong>Human Support:</strong> Need direct assistance or found incorrect scholarship information? Contact our support team at <a href="mailto:support@scholavon.com" className="text-indigo-600 font-semibold hover:underline">support@scholavon.com</a>.</p>
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
