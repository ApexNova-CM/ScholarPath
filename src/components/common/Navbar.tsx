import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Compass, Search, Bookmark, User, X, ArrowRight, ShieldCheck, FileText, Bell, Settings, LogOut, HelpCircle, Info } from 'lucide-react';
import { MobileHeader } from './MobileHeader';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { user, isAuthenticated, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
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
  };

  return (
    <>
      {/* 1. Desktop Header (hidden on mobile, visible on md+) */}
      <header className="hidden md:block sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
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
                <span className="text-base font-bold tracking-tight text-slate-900 block leading-none">
                  ScholarPath
                </span>
                <span className="text-[10px] font-medium text-indigo-600 block mt-0.5 tracking-wide">
                  Your path to the right scholarship
                </span>
              </div>
            </div>

            {/* Desktop Links */}
            <nav className="flex items-center gap-6">
              <button
                id="nav-link-scholarships"
                onClick={() => onNavigate('/scholarships')}
                className={`text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                  currentPath.startsWith('/scholarships') ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Find Scholarships
              </button>
              {isAuthenticated && role === 'student' && (
                <>
                  <button
                    id="nav-link-saved"
                    onClick={() => onNavigate('/saved')}
                    className={`text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                      currentPath === '/saved' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Saved
                  </button>
                  <button
                    id="nav-link-applications"
                    onClick={() => onNavigate('/applications')}
                    className={`text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                      currentPath === '/applications' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Applications
                  </button>
                </>
              )}
              <button
                id="nav-link-how-it-works"
                onClick={() => onNavigate('/how-it-works')}
                className={`text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                  currentPath === '/how-it-works' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                How It Works
              </button>
              <button
                id="nav-link-about"
                onClick={() => onNavigate('/about')}
                className={`text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                  currentPath === '/about' ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                About
              </button>
            </nav>

            {/* User / Auth Actions */}
            <div className="flex items-center gap-3">
              {isAuthenticated && user && role === 'student' ? (
                <div className="flex items-center gap-3">
                  <button
                    id="nav-student-dashboard"
                    onClick={() => onNavigate('/dashboard')}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <User size={14} />
                    <span>My Dashboard</span>
                  </button>
                  <button
                    id="nav-btn-logout"
                    onClick={logout}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : isAuthenticated && user && role === 'admin' ? (
                <div className="flex items-center gap-3">
                  <button
                    id="nav-admin-dashboard"
                    onClick={() => onNavigate('/admin/dashboard')}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    <span>Dashboard</span>
                  </button>
                  <button
                    id="nav-btn-logout"
                    onClick={logout}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    id="nav-btn-login"
                    onClick={() => onNavigate('/login')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    id="nav-btn-register"
                    onClick={() => onNavigate('/register')}
                    className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Mobile Header (hidden on desktop, visible on screens < md) */}
      <MobileHeader
        onOpenMenu={() => setMobileMenuOpen(true)}
        onNavigate={onNavigate}
        portalType={role === 'admin' ? 'admin' : role === 'student' ? 'student' : 'public'}
      />

      {/* 3. Mobile Navigation Drawer Overlay (screens < md) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sliding Drawer Container */}
          <aside
            id="nav-mobile-drawer"
            className="relative z-50 w-72 sm:w-80 max-w-[85vw] bg-white text-slate-700 shadow-2xl flex flex-col h-full h-[100dvh] select-none animate-in slide-in-from-left duration-200"
            aria-label="Mobile Navigation Drawer"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div
                onClick={() => handleNav('/')}
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
                  <span className="text-[10px] text-indigo-600 font-medium block mt-0.5">
                    Your path to the right scholarship
                  </span>
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

            {/* Drawer Body - Scrollable with comfortable spacing */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
              {/* If Authenticated Student */}
              {isAuthenticated && user && role === 'student' ? (
                <div className="space-y-4">
                  {/* User Profile Summary */}
                  <div 
                    onClick={() => handleNav('/profile')}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      id="mob-nav-dashboard"
                      onClick={() => handleNav('/dashboard')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <User size={16} className={currentPath === '/dashboard' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Student Dashboard</span>
                    </button>
                    <button
                      id="mob-nav-scholarships"
                      onClick={() => handleNav('/scholarships')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath.startsWith('/scholarships') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Search size={16} className={currentPath.startsWith('/scholarships') ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Find Scholarships</span>
                    </button>
                    <button
                      id="mob-nav-saved"
                      onClick={() => handleNav('/saved')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/saved' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Bookmark size={16} className={currentPath === '/saved' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Saved Scholarships</span>
                    </button>
                    <button
                      id="mob-nav-applications"
                      onClick={() => handleNav('/applications')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/applications' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Compass size={16} className={currentPath === '/applications' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Applications</span>
                    </button>
                    <button
                      id="mob-nav-profile"
                      onClick={() => handleNav('/profile')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/profile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <User size={16} className={currentPath === '/profile' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>My Profile</span>
                    </button>
                    <button
                      id="mob-nav-documents"
                      onClick={() => handleNav('/documents')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <FileText size={16} className={currentPath === '/documents' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Documents</span>
                    </button>
                    <button
                      id="mob-nav-notifications"
                      onClick={() => handleNav('/notifications')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/notifications' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Bell size={16} className={currentPath === '/notifications' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Notifications</span>
                    </button>
                    <button
                      id="mob-nav-settings"
                      onClick={() => handleNav('/settings')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Settings size={16} className={currentPath === '/settings' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Settings</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <button
                      id="mob-nav-public-how-it-works-student"
                      onClick={() => handleNav('/how-it-works')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle size={16} className="text-slate-400" />
                      <span>How It Works</span>
                    </button>
                    <button
                      id="mob-nav-public-about-student"
                      onClick={() => handleNav('/about')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      <Info size={16} className="text-slate-400" />
                      <span>About ScholarPath</span>
                    </button>
                  </div>
                </div>
              ) : isAuthenticated && user && role === 'admin' ? (
                /* Admin in Public Layout */
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-xs font-bold shrink-0">
                      {user.firstName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-[10px] text-slate-500 truncate">System Administrator</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      id="mob-nav-admin-console"
                      onClick={() => handleNav('/admin/dashboard')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                    >
                      <ShieldCheck size={16} className="text-indigo-600" />
                      <span>Admin Dashboard</span>
                    </button>
                    <button
                      id="mob-nav-scholarships-admin"
                      onClick={() => handleNav('/scholarships')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                    >
                      <Search size={16} className="text-slate-400" />
                      <span>Find Scholarships</span>
                    </button>
                    <button
                      id="mob-nav-how-it-works-admin"
                      onClick={() => handleNav('/how-it-works')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle size={16} className="text-slate-400" />
                      <span>How It Works</span>
                    </button>
                    <button
                      id="mob-nav-about-admin"
                      onClick={() => handleNav('/about')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                    >
                      <Info size={16} className="text-slate-400" />
                      <span>About ScholarPath</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Public / Unauthenticated User */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <button
                      id="mob-nav-public-scholarships"
                      onClick={() => handleNav('/scholarships')}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left cursor-pointer ${
                        currentPath.startsWith('/scholarships') ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Search size={18} className={currentPath.startsWith('/scholarships') ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>Find Scholarships</span>
                    </button>
                    <button
                      id="mob-nav-public-how-it-works"
                      onClick={() => handleNav('/how-it-works')}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/how-it-works' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <HelpCircle size={18} className={currentPath === '/how-it-works' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>How It Works</span>
                    </button>
                    <button
                      id="mob-nav-public-about"
                      onClick={() => handleNav('/about')}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors text-left cursor-pointer ${
                        currentPath === '/about' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Info size={18} className={currentPath === '/about' ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>About ScholarPath</span>
                    </button>
                  </div>

                  {/* Auth Actions in Drawer */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                    <button
                      id="mob-nav-signin"
                      onClick={() => handleNav('/login')}
                      className="w-full py-3 px-4 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors text-center min-h-[44px] flex items-center justify-center cursor-pointer"
                    >
                      Sign In
                    </button>
                    <button
                      id="mob-nav-register"
                      onClick={() => handleNav('/register')}
                      className="w-full py-3 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors text-center shadow-xs min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Get Started</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Pin */}
            <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 shrink-0">
              {isAuthenticated ? (
                <button
                  id="mob-nav-logout"
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              ) : (
                <p className="text-[11px] text-slate-500 text-center font-medium">
                  Verified Scholarships • Deterministic Matching
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
