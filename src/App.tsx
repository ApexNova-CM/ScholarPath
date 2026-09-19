import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StorageService } from './services/storage';
import { api } from './lib/apiClient';
import { bootstrapPublicData, bootstrapUserData } from './services/dataService';
import { Scholarship, Application, StoredDocument, InAppNotification, Provider, Category, UserProfile } from './types';


// Layouts
import { PublicLayout } from './components/layouts/PublicLayout';
import { StudentLayout } from './components/layouts/StudentLayout';
import { AdminLayout } from './components/layouts/AdminLayout';
import { AuthLayout } from './components/layouts/AuthLayout';

// Common Components
import { ApplicationModal } from './components/common/ApplicationModal';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { ScholarshipsPage } from './pages/public/ScholarshipsPage';
import { ScholarshipDetailPage } from './pages/public/ScholarshipDetailPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { AboutPage } from './pages/public/AboutPage';
import { PrivacyPage, TermsPage } from './pages/public/PrivacyPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';

// Student Pages
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { SavedScholarshipsPage } from './pages/student/SavedScholarshipsPage';
import { ApplicationsPage } from './pages/student/ApplicationsPage';
import { ProfilePage } from './pages/student/ProfilePage';
import { DocumentsPage } from './pages/student/DocumentsPage';
import { NotificationsPage } from './pages/student/NotificationsPage';
import { SettingsPage } from './pages/student/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminScholarshipsPage } from './pages/admin/AdminScholarshipsPage';
import { AdminAddEditScholarshipPage } from './pages/admin/AdminAddEditScholarshipPage';
import { AdminVerificationQueuePage } from './pages/admin/AdminVerificationQueuePage';
import { AdminProvidersPage } from './pages/admin/AdminProvidersPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminApplicationsPage } from './pages/admin/AdminApplicationsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminAdminsPage } from './pages/admin/AdminAdminsPage';

function MainApp() {
  const { user, isAuthenticated, role, updateUserProfile } = useAuth();

  // App-wide state synced with StorageService
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  // Routing State Helper
  const normalizePath = (rawPath: string): string => {
    let path = rawPath || '/';
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  };

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return normalizePath(window.location.pathname);
  });

  // Modal State for "Start Application"
  const [modalScholarship, setModalScholarship] = useState<Scholarship | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);

  const [isDataLoading, setIsDataLoading] = useState(true);

  // ── Load public data from Supabase on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsDataLoading(true);
    bootstrapPublicData().then(({ scholarships: s, providers: p, categories: c }) => {
      if (cancelled) return;
      setScholarships(s);
      setProviders(p);
      setCategories(c);
      setIsDataLoading(false);
    }).catch(() => {
      // Fallback to localStorage
      if (!cancelled) {
        setScholarships(StorageService.getScholarships());
        setProviders(StorageService.getProviders());
        setCategories(StorageService.getCategories());
        setIsDataLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Load user-specific data from Supabase when user logs in/out ────────────
  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      setApplications([]);
      setDocuments([]);
      setNotifications([]);
      setUsers([]);
      return;
    }
    const isAdmin = user.role === 'admin';
    bootstrapUserData(user.id, isAdmin).then(({ applications: a, savedIds: s, documents: d, notifications: n, users: u }) => {
      setApplications(a);
      setSavedIds(s);
      setDocuments(d);
      setNotifications(n as any);
      if (u.length > 0) setUsers(u);
      else if (isAdmin) setUsers(StorageService.getUsers());
    }).catch(() => {
      // Fallback to localStorage
      if (isAdmin) {
        setUsers(StorageService.getUsers());
        setApplications(StorageService.getApplications());
      } else {
        setSavedIds(StorageService.getSavedScholarshipIds(user.id));
        setApplications(StorageService.getApplications(user.id));
        setDocuments(StorageService.getDocuments(user.id));
        setNotifications(StorageService.getNotifications(user.id) as any);
      }
    });
  }, [user]);



  // Handle browser popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Safe client navigation
  const navigate = (path: string) => {
    const target = normalizePath(path);
    setCurrentPath(target);
    try {
      window.history.pushState({}, '', target);
    } catch (e) {
      // In constrained iframe environments, ignore pushState errors
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle bookmark save
  const handleToggleSave = async (scholarshipId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post<{ saved: boolean; ids: string[] }>(`/student/saved/${scholarshipId}`);
      if (res?.ids) {
        setSavedIds(res.ids);
        return;
      }
    } catch {}
    const updated = StorageService.toggleSavedScholarship(user.id, scholarshipId);
    setSavedIds(updated);
  };

  // Start Application flow
  const handleStartApplication = (scholarship: Scholarship) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setModalScholarship(scholarship);
    setIsAppModalOpen(true);
  };

  // Admin actions — all use optimistic updates so UI responds instantly
  const handleVerifyScholarship = (id: string) => {
    const adminIdentity = user ? `${user.firstName} ${user.lastName} (${user.role})`.trim() : 'System Admin Operations';
    const updated = StorageService.verifyScholarship(id, adminIdentity, user?.email);
    if (updated) {
      setScholarships((prev) => prev.map((s) => s.id === id ? updated : s));
    }
    api.post(`/admin/verifications/${id}/decision`, { decision: 'verified' }).catch(() => {});
  };

  const handleUnverifyScholarship = (id: string) => {
    const updated = StorageService.unverifyScholarship(id);
    if (updated) {
      setScholarships((prev) => prev.map((s) => s.id === id ? updated : s));
    }
    api.post(`/admin/verifications/${id}/decision`, { decision: 'pending_verification' }).catch(() => {});
  };

  const handleRejectScholarship = (id: string, reason: string) => {
    const updated = StorageService.rejectScholarship(id, reason);
    if (updated) {
      setScholarships((prev) => prev.map((s) => s.id === id ? updated : s));
    }
    api.post(`/admin/verifications/${id}/decision`, { decision: 'rejected', notes: reason }).catch(() => {});
  };

  const handleArchiveScholarship = (id: string) => {
    const updated = StorageService.archiveScholarship(id);
    if (updated) {
      setScholarships((prev) => prev.map((s) => s.id === id ? updated : s));
    }
    api.post(`/admin/scholarships/${id}/archive`).catch(() => {});
  };

  const handleDeleteScholarship = (id: string) => {
    // Optimistic update — remove from UI instantly, no page refresh
    setScholarships((prev) => prev.filter((s) => s.id !== id));
    // Persist to local storage
    StorageService.deleteScholarship(id);
    // Fire-and-forget API sync (UI already updated)
    api.delete(`/admin/scholarships/${id}`).catch((err) =>
      console.error('Failed to sync delete with API:', err)
    );
  };

  // Route parser & matcher
  const renderRoute = () => {
    // 1. Check scholarship detail route: /scholarships/:id
    const scholarshipMatch = currentPath.match(/^\/scholarships\/([^/?#]+)$/);
    if (scholarshipMatch && scholarshipMatch[1]) {
      const id = scholarshipMatch[1];
      if (isAuthenticated && role === 'student') {
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <ScholarshipDetailPage
              scholarshipId={id}
              scholarships={scholarships}
              userProfile={user}
              documents={documents}
              isSaved={savedIds.includes(id)}
              onToggleSave={handleToggleSave}
              onNavigate={navigate}
              onStartApplication={handleStartApplication}
            />
          </StudentLayout>
        );
      }
      return (
        <PublicLayout currentPath={currentPath} onNavigate={navigate}>
          <ScholarshipDetailPage
            scholarshipId={id}
            scholarships={scholarships}
            userProfile={user}
            documents={documents}
            isSaved={savedIds.includes(id)}
            onToggleSave={handleToggleSave}
            onNavigate={navigate}
            onStartApplication={handleStartApplication}
          />
        </PublicLayout>
      );
    }

    // 2. Check admin edit route: /admin/scholarships/:id/edit
    const adminEditMatch = currentPath.match(/^\/admin\/scholarships\/([^/?#]+)\/edit$/);
    if (adminEditMatch && adminEditMatch[1]) {
      const id = adminEditMatch[1];
      if (!isAuthenticated || role !== 'admin') {
        return (
          <AuthLayout portal="unified" onNavigate={navigate}>
            <LoginPage onNavigate={navigate} />
          </AuthLayout>
        );
      }
      return (
        <AdminLayout currentPath={currentPath} onNavigate={navigate}>
          <AdminAddEditScholarshipPage
            scholarshipId={id}
            scholarships={scholarships}
            providers={providers}
            categories={categories}
            onNavigate={navigate}
            onDeleteScholarship={handleDeleteScholarship}
            onScholarshipSaved={(saved) => {
              setScholarships((prev) => {
                const idx = prev.findIndex((s) => s.id === saved.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = saved;
                  return copy;
                }
                return [saved, ...prev];
              });
            }}
          />
        </AdminLayout>
      );
    }

    // 3. Path switches with query string support
    const basePath = currentPath.split('?')[0];
    const queryParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
    const categoryParam = queryParams.get('category') || undefined;

    switch (basePath) {
      // ----------------------------------------------------
      // PUBLIC ROUTES
      // ----------------------------------------------------
      case '/':
        if (isAuthenticated && role === 'student' && user) {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <LandingPage
                scholarships={scholarships}
                userProfile={user}
                onNavigate={navigate}
                onToggleSave={handleToggleSave}
                isSaved={(id) => savedIds.includes(id)}
                onStartApplication={handleStartApplication}
                categories={categories}
              />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <LandingPage
              scholarships={scholarships}
              userProfile={user}
              onNavigate={navigate}
              onToggleSave={handleToggleSave}
              isSaved={(id) => savedIds.includes(id)}
              onStartApplication={handleStartApplication}
              categories={categories}
            />
          </PublicLayout>
        );

      case '/scholarships':
        if (isAuthenticated && role === 'student' && user) {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <ScholarshipsPage
                scholarships={scholarships}
                userProfile={user}
                onNavigate={navigate}
                onToggleSave={handleToggleSave}
                isSaved={(id) => savedIds.includes(id)}
                onStartApplication={handleStartApplication}
                currentPath={currentPath}
                initialCategory={categoryParam}
              />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <ScholarshipsPage
              scholarships={scholarships}
              userProfile={user}
              onNavigate={navigate}
              onToggleSave={handleToggleSave}
              isSaved={(id) => savedIds.includes(id)}
              onStartApplication={handleStartApplication}
              currentPath={currentPath}
              initialCategory={categoryParam}
            />
          </PublicLayout>
        );

      case '/how-it-works':
        if (isAuthenticated && role === 'student') {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <HowItWorksPage onNavigate={navigate} />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <HowItWorksPage onNavigate={navigate} />
          </PublicLayout>
        );

      case '/about':
        if (isAuthenticated && role === 'student') {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <AboutPage />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <AboutPage />
          </PublicLayout>
        );

      case '/privacy':
        if (isAuthenticated && role === 'student') {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <PrivacyPage />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <PrivacyPage />
          </PublicLayout>
        );

      case '/terms':
        if (isAuthenticated && role === 'student') {
          return (
            <StudentLayout currentPath={currentPath} onNavigate={navigate}>
              <TermsPage />
            </StudentLayout>
          );
        }
        return (
          <PublicLayout currentPath={currentPath} onNavigate={navigate}>
            <TermsPage />
          </PublicLayout>
        );

      case '/login':
        if (isAuthenticated) {
          if (role === 'admin') {
            return (
              <AdminLayout currentPath="/admin/dashboard" onNavigate={navigate}>
                <AdminDashboardPage
                  scholarships={scholarships}
                  providers={providers}
                  users={users}
                  applications={applications}
                  onNavigate={navigate}
                  onVerifyScholarship={handleVerifyScholarship}
                  onRejectScholarship={handleRejectScholarship}
                />
              </AdminLayout>
            );
          }
          if (role === 'student' && user) {
            return (
              <StudentLayout currentPath="/dashboard" onNavigate={navigate}>
                <StudentDashboardPage
                  userProfile={user}
                  scholarships={scholarships}
                  applications={applications}
                  notifications={notifications}
                  savedScholarshipIds={savedIds}
                  onToggleSave={handleToggleSave}
                  onNavigate={navigate}
                  onStartApplication={handleStartApplication}
                />
              </StudentLayout>
            );
          }
        }
        return (
          <AuthLayout portal="unified" onNavigate={navigate}>
            <LoginPage onNavigate={navigate} />
          </AuthLayout>
        );

      case '/register':
        if (isAuthenticated && role === 'student') {
          return (
            <StudentLayout currentPath="/dashboard" onNavigate={navigate}>
              <StudentDashboardPage
                userProfile={user!}
                scholarships={scholarships}
                applications={applications}
                notifications={notifications}
                savedScholarshipIds={savedIds}
                onToggleSave={handleToggleSave}
                onNavigate={navigate}
                onStartApplication={handleStartApplication}
              />
            </StudentLayout>
          );
        }
        return (
          <AuthLayout portal="student" onNavigate={navigate}>
            <RegisterPage onNavigate={navigate} />
          </AuthLayout>
        );

      case '/forgot-password':
        return (
          <AuthLayout portal="student" onNavigate={navigate}>
            <ForgotPasswordPage onNavigate={navigate} />
          </AuthLayout>
        );

      // ----------------------------------------------------
      // STUDENT PORTAL ROUTES
      // ----------------------------------------------------
      case '/dashboard':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <StudentDashboardPage
              userProfile={user}
              scholarships={scholarships}
              applications={applications}
              notifications={notifications}
              savedScholarshipIds={savedIds}
              documents={documents}
              onToggleSave={handleToggleSave}
              onNavigate={navigate}
              onStartApplication={handleStartApplication}
            />
          </StudentLayout>
        );

      case '/saved':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <SavedScholarshipsPage
              scholarships={scholarships}
              userProfile={user}
              savedScholarshipIds={savedIds}
              onToggleSave={handleToggleSave}
              onNavigate={navigate}
              onStartApplication={handleStartApplication}
            />
          </StudentLayout>
        );

      case '/applications':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <ApplicationsPage
              applications={applications}
              scholarships={scholarships}
              onUpdateApplication={(updated) => {
                setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              }}
              onNavigate={navigate}
            />
          </StudentLayout>
        );

      case '/profile':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <ProfilePage
              userProfile={user}
              onUpdateProfile={(updated) => {
                updateUserProfile(updated);
              }}
            />
          </StudentLayout>
        );

      case '/documents':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <DocumentsPage
              userProfile={user}
              documents={documents}
              onDocumentsChange={(docs) => setDocuments(docs)}
            />
          </StudentLayout>
        );

      case '/notifications':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <NotificationsPage
              userProfile={user}
              notifications={notifications}
              onNotificationsChange={(n) => setNotifications(n)}
              onNavigate={navigate}
            />
          </StudentLayout>
        );

      case '/settings':
        if (!isAuthenticated || !user || role !== 'student') {
          return (
            <AuthLayout portal="student" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <StudentLayout currentPath={currentPath} onNavigate={navigate}>
            <SettingsPage
              userProfile={user}
              onUpdateProfile={(updated) => updateUserProfile(updated)}
            />
          </StudentLayout>
        );

      // ----------------------------------------------------
      // ADMIN PORTAL ROUTES
      // ----------------------------------------------------
      case '/admin/login':
        if (isAuthenticated) {
          if (role === 'admin') {
            return (
              <AdminLayout currentPath="/admin/dashboard" onNavigate={navigate}>
                <AdminDashboardPage
                  scholarships={scholarships}
                  providers={providers}
                  users={users}
                  applications={applications}
                  onNavigate={navigate}
                  onVerifyScholarship={handleVerifyScholarship}
                  onRejectScholarship={handleRejectScholarship}
                />
              </AdminLayout>
            );
          }
          if (role === 'student' && user) {
            return (
              <StudentLayout currentPath="/dashboard" onNavigate={navigate}>
                <StudentDashboardPage
                  userProfile={user}
                  scholarships={scholarships}
                  applications={applications}
                  notifications={notifications}
                  savedScholarshipIds={savedIds}
                  onToggleSave={handleToggleSave}
                  onNavigate={navigate}
                  onStartApplication={handleStartApplication}
                />
              </StudentLayout>
            );
          }
        }
        return (
          <AuthLayout portal="unified" onNavigate={navigate}>
            <LoginPage onNavigate={navigate} />
          </AuthLayout>
        );

      case '/admin':
      case '/admin/dashboard':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath="/admin/dashboard" onNavigate={navigate}>
            <AdminDashboardPage
              scholarships={scholarships}
              providers={providers}
              users={users}
              applications={applications}
              onNavigate={navigate}
              onVerifyScholarship={handleVerifyScholarship}
              onRejectScholarship={handleRejectScholarship}
            />
          </AdminLayout>
        );

      case '/admin/scholarships':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminScholarshipsPage
              scholarships={scholarships}
              categories={categories}
              onNavigate={navigate}
              onVerifyScholarship={handleVerifyScholarship}
              onUnverifyScholarship={handleUnverifyScholarship}
              onArchiveScholarship={handleArchiveScholarship}
              onDeleteScholarship={handleDeleteScholarship}
            />
          </AdminLayout>
        );

      case '/admin/scholarships/new':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminAddEditScholarshipPage
              scholarships={scholarships}
              providers={providers}
              categories={categories}
              onNavigate={navigate}
              onDeleteScholarship={handleDeleteScholarship}
              onScholarshipSaved={(saved) => {
                setScholarships((prev) => {
                  const idx = prev.findIndex((s) => s.id === saved.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = saved;
                    return copy;
                  }
                  return [saved, ...prev];
                });
              }}
            />
          </AdminLayout>
        );

      case '/admin/verification':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminVerificationQueuePage
              scholarships={scholarships}
              onNavigate={navigate}
              onVerifyScholarship={handleVerifyScholarship}
              onRejectScholarship={handleRejectScholarship}
            />
          </AdminLayout>
        );

      case '/admin/providers':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminProvidersPage
              providers={providers}
              onProvidersChange={(updated) => setProviders(updated)}
            />
          </AdminLayout>
        );

      case '/admin/users':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminUsersPage users={users} />
          </AdminLayout>
        );

      case '/admin/applications':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminApplicationsPage applications={applications} />
          </AdminLayout>
        );

      case '/admin/categories':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminCategoriesPage
              categories={categories}
              onCategoriesChange={(updated) => setCategories(updated)}
            />
          </AdminLayout>
        );

      case '/admin/admins':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <AdminAdminsPage />
          </AdminLayout>
        );

      case '/admin/notifications':
      case '/admin/settings':
      case '/admin/profile':
        if (!isAuthenticated || role !== 'admin') {
          return (
            <AuthLayout portal="unified" onNavigate={navigate}>
              <LoginPage onNavigate={navigate} />
            </AuthLayout>
          );
        }
        return (
          <AdminLayout currentPath={currentPath} onNavigate={navigate}>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 max-w-2xl mx-auto space-y-4 text-xs text-slate-700 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                System Administration Configuration
              </h2>
              <p className="leading-relaxed text-slate-600">
                Platform operations are running in active audit mode. System notifications are automatically broadcast to students when scholarships are verified or nearing deadline cutoffs.
              </p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block">Active Administrator:</span>
                <p className="text-slate-700">
                  {user ? `${user.firstName} ${user.lastName} (${user.role}) • ${user.email}` : 'System Administrator • admin@scholarpath.org'}
                </p>
                <p className="text-emerald-700 font-semibold">Security Clearance: Enterprise Full Access</p>
              </div>
            </div>
          </AdminLayout>
        );

      default:
        // Default fallback to landing page
        return (
          <PublicLayout currentPath="/" onNavigate={navigate}>
            <LandingPage
              scholarships={scholarships}
              userProfile={user}
              onNavigate={navigate}
              onToggleSave={handleToggleSave}
              isSaved={(id) => savedIds.includes(id)}
              onStartApplication={handleStartApplication}
            />
          </PublicLayout>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
      {renderRoute()}

      {/* Global Application Readiness Modal */}
      <ApplicationModal
        scholarship={modalScholarship}
        userProfile={user}
        documents={documents}
        isOpen={isAppModalOpen}
        onClose={() => {
          setIsAppModalOpen(false);
          setModalScholarship(null);
        }}
        onNavigate={navigate}
        onApplicationCreated={(newApp) => {
          if (user) {
            setApplications((prev) => {
              const idx = prev.findIndex((a) => a.id === newApp.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = newApp;
                return copy;
              }
              return [newApp, ...prev];
            });
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
