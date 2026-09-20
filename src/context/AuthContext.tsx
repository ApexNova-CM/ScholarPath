import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { StorageService } from '../services/storage';
import {
  supabase,
  isSupabaseConfigured,
  SupabaseUser,
  Session,
} from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  loginAsStudent: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginAsAdmin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (rolePreference?: UserRole) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  registerStudent: (
    profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'profileCompletion' | 'role'>,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  updateUserProfile: (profile: UserProfile | Partial<UserProfile>) => Promise<UserProfile>;
  refreshUser: () => void;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveOrCreateProfile(sbUser: SupabaseUser, rolePreference: UserRole = 'student'): UserProfile {
  const isTargetAdmin = rolePreference === 'admin' || sbUser.email?.toLowerCase() === 'admin@scholarpath.org';
  let profile =
    StorageService.getUserById(sbUser.id) ||
    (sbUser.email ? StorageService.getUserByEmail(sbUser.email) : null);

  if (!profile) {
    const meta = sbUser.user_metadata || {};
    const fullName: string = meta.full_name || meta.name || '';
    const [firstName = (isTargetAdmin ? 'Admin' : 'User'), ...rest] = fullName.split(' ');
    const lastName = rest.join(' ') || (isTargetAdmin ? 'Operations' : '');
    profile = StorageService.createUser({
      id: sbUser.id,
      email: sbUser.email || '',
      role: isTargetAdmin ? 'admin' : 'student',
      firstName: meta.first_name || firstName,
      lastName: meta.last_name || lastName,
      country: 'International',
      educationLevel: 'Undergraduate',
      institution: isTargetAdmin ? 'ScholarPath Foundation' : '',
      fieldOfStudy: isTargetAdmin ? 'Administration' : '',
      gpa: 4.0,
      gpaScale: 4.0,
    });
  } else if (isTargetAdmin && profile.role !== 'admin') {
    profile.role = 'admin';
  }
  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore active session on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (cancelled) return;
        if (s?.user) {
          setSession(s);
          setSupabaseUser(s.user);
          setUser(resolveOrCreateProfile(s.user));
        }
        setIsLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, s) => {
        if (cancelled) return;
        setSession(s);
        if (s?.user) {
          setSupabaseUser(s.user);
          setUser(resolveOrCreateProfile(s.user));
        } else {
          setSupabaseUser(null);
          setUser(null);
        }
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } else {
      const uid = localStorage.getItem('scholarpath_active_session_uid');
      if (uid) {
        const found = StorageService.getUserById(uid);
        if (found) setUser(found);
        else localStorage.removeItem('scholarpath_active_session_uid');
      }
      setIsLoading(false);
    }
  }, []);

  const refreshUser = () => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (u) {
          setSupabaseUser(u);
          setUser(resolveOrCreateProfile(u));
        }
      });
    } else if (user) {
      const fresh = StorageService.getUserById(user.id);
      if (fresh) setUser(fresh);
    }
  };

  // ── Sign in (email + password) ────────────────────────────────────────
  const login = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const isAdminEmail =
      cleanEmail === 'admin@scholarpath.org' ||
      StorageService.getAdminUsers().some((a) => a.email.toLowerCase() === cleanEmail) ||
      StorageService.getUserByEmail(cleanEmail)?.role === 'admin';

    try {
      // 1. Supabase Auth
      if (isSupabaseConfigured && password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (data?.user) {
          const profile = resolveOrCreateProfile(data.user, isAdminEmail ? 'admin' : 'student');
          setUser(profile);
          return { success: true, role: profile.role };
        }

        // Resilient fallback for admin or local accounts if Supabase Auth user is unprovisioned
        if (isAdminEmail) {
          const { data: signUpData } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                first_name: 'Admin',
                last_name: 'User',
                role: 'admin',
              },
            },
          });

          if (signUpData?.user) {
            const profile = resolveOrCreateProfile(signUpData.user, 'admin');
            setUser(profile);
            return { success: true, role: 'admin' };
          }

          const foundAdmin = StorageService.getUserByEmail(cleanEmail) || StorageService.getUserById('usr-admin-001');
          if (foundAdmin) {
            setUser(foundAdmin);
            localStorage.setItem('scholarpath_active_session_uid', foundAdmin.id);
            return { success: true, role: 'admin' };
          }
        }

        const foundLocal = StorageService.getUserByEmail(cleanEmail);
        if (foundLocal) {
          setUser(foundLocal);
          localStorage.setItem('scholarpath_active_session_uid', foundLocal.id);
          return { success: true, role: foundLocal.role };
        }

        if (error) return { success: false, error: mapAuthError(error.message) };
        return { success: false, error: 'Invalid email or password.' };
      }

      // 2. Fallback: localStorage
      const found = StorageService.getUserByEmail(cleanEmail);
      if (!found) return { success: false, error: 'No account found with this email.' };
      setUser(found);
      localStorage.setItem('scholarpath_active_session_uid', found.id);
      return { success: true, role: found.role };
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsStudent = async (email: string, password?: string) => {
    return login(email, password);
  };

  const loginAsAdmin = async (email: string, password?: string) => {
    return login(email, password);
  };

  // ── Google OAuth ──────────────────────────────────────────────────────
  const loginWithGoogle = async (
    _rolePreference: UserRole = 'student'
  ): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Google sign-in requires OAuth configuration.',
      };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  // ── Register new student ──────────────────────────────────────────────
  const registerStudent = async (
    profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'profileCompletion' | 'role'>,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // 1. Supabase Auth
      if (isSupabaseConfigured && password) {
        const { data, error } = await supabase.auth.signUp({
          email: profileData.email.trim(),
          password,
          options: {
            data: {
              first_name: profileData.firstName,
              last_name: profileData.lastName,
              full_name: `${profileData.firstName} ${profileData.lastName}`.trim(),
            },
          },
        });
        if (error) return { success: false, error: mapAuthError(error.message) };
        if (!data.user) return { success: false, error: 'Registration failed. Please try again.' };

        const newUser = StorageService.createUser({
          ...profileData,
          id: data.user.id,
          role: 'student',
        });
        setUser(newUser);
        return { success: true };
      }

      // 2. Fallback: localStorage
      const existing = StorageService.getUserByEmail(profileData.email);
      if (existing) return { success: false, error: 'An account with this email already exists.' };
      const newUser = StorageService.createUser({ ...profileData, role: 'student' });
      setUser(newUser);
      localStorage.setItem('scholarpath_active_session_uid', newUser.id);
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────
  const logout = async () => {
    localStorage.removeItem('scholarpath_active_session_uid');

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    setUser(null);
    setSupabaseUser(null);
    setSession(null);
  };

  // ── Password reset email ──────────────────────────────────────────────
  const sendPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
    return { success: true };
  };

  // ── Update profile ────────────────────────────────────────────────────
  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    if (!user) throw new Error('Not authenticated');
    const sanitized = { ...updates };
    if (user.role === 'student') delete sanitized.role;

    const updated = StorageService.updateUserProfile(user.id, sanitized);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        loginAsStudent,
        loginAsAdmin,
        loginWithGoogle,
        registerStudent,
        logout,
        updateProfile,
        updateUserProfile: updateProfile,
        refreshUser,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please check your inbox and confirm your email before signing in.';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (m.includes('weak password') || m.includes('password should')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  return message || 'Authentication failed. Please try again.';
}
