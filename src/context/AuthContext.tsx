import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
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

// ─── Fetch profile from Supabase public.users table ──────────────────────────
// This is the SINGLE source of truth for role. No localStorage, no email
// matching — only what is stored in the database.
async function fetchProfileFromSupabase(sbUser: SupabaseUser): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', sbUser.id)
    .single();

  const meta = sbUser.user_metadata || {};
  const isAuthAdmin = meta.role === 'admin' || sbUser.app_metadata?.role === 'admin';

  if (error || !data) {
    // If authenticated in Supabase Auth but public.users row is missing:
    // Auto-provision profile row using Supabase Auth metadata
    const role: UserRole = isAuthAdmin ? 'admin' : 'student';
    const fullName: string = meta.full_name || meta.name || '';
    const [firstName = 'User', ...rest] = fullName.split(' ');
    const lastName = rest.join(' ') || '';

    return createProfileInSupabase(sbUser, {
      firstName: meta.first_name || firstName,
      lastName: meta.last_name || lastName,
      role,
      country: 'International',
      educationLevel: 'Undergraduate',
      institution: role === 'admin' ? 'ScholarPath Foundation' : '',
      fieldOfStudy: meta.assigned_department || '',
    });
  }

  // Auto-healing: If Supabase Auth metadata specifies admin role but public.users row says student, heal DB row
  if (data.role !== 'admin' && isAuthAdmin) {
    data.role = 'admin';
    supabase.from('users').update({ role: 'admin' }).eq('id', sbUser.id).then(({ error: healErr }) => {
      if (healErr) console.warn('Role auto-healing update notice:', healErr.message);
    });
  }

  return mapSupabaseRowToProfile(data);
}



// ─── Create a new profile row in public.users ─────────────────────────────────
async function createProfileInSupabase(
  sbUser: SupabaseUser,
  extra: {
    firstName: string;
    lastName: string;
    role: UserRole;
    country?: string;
    educationLevel?: string;
    institution?: string;
    fieldOfStudy?: string;
  }
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const row = {
    id: sbUser.id,
    email: sbUser.email ?? '',
    role: extra.role,
    first_name: extra.firstName,
    last_name: extra.lastName,
    country: extra.country ?? 'International',
    education_level: extra.educationLevel ?? 'Undergraduate',
    institution: extra.institution ?? '',
    field_of_study: extra.fieldOfStudy ?? '',
    gpa: 0.0,
    gpa_scale: 4.0,
    profile_completion: 0,
  };

  const { data, error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create profile in Supabase:', error?.message);
    return null;
  }

  return mapSupabaseRowToProfile(data);
}

// ─── Map a Supabase DB row → UserProfile ──────────────────────────────────────
function mapSupabaseRowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: (row.email as string) ?? '',
    role: (row.role as UserRole) ?? 'student',
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    country: (row.country as string) ?? 'International',
    phone: row.phone as string | undefined,
    dateOfBirth: row.date_of_birth as string | undefined,
    state: row.state as string | undefined,
    city: row.city as string | undefined,
    educationLevel: ((row.education_level as string) || 'Undergraduate') as UserProfile['educationLevel'],
    institution: (row.institution as string) ?? '',
    fieldOfStudy: (row.field_of_study as string) ?? '',
    course: row.course as string | undefined,
    yearLevel: row.year_level as string | undefined,
    graduationYear: row.graduation_year as number | undefined,
    gpa: (row.gpa as number) ?? 0,
    gpaScale: (row.gpa_scale as number) ?? 4.0,
    financialNeed: (row.financial_need as boolean) ?? false,
    gender: row.gender as UserProfile['gender'],
    awards: (row.awards as string[]) ?? [],
    achievements: (row.achievements as string[]) ?? [],
    extracurriculars: (row.extracurriculars as string[]) ?? [],
    certifications: (row.certifications as string[]) ?? [],
    leadership: (row.leadership as string[]) ?? [],
    volunteering: (row.volunteering as string[]) ?? [],
    workExperience: (row.work_experience as string[]) ?? [],
    profileCompletion: (row.profile_completion as number) ?? 0,
    notificationPreferences: row.notification_preferences as UserProfile['notificationPreferences'],
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore active Supabase session on mount ──────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    // Load existing session from Supabase (handles browser storage automatically)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      if (s?.user) {
        setSession(s);
        setSupabaseUser(s.user);
        const profile = await fetchProfileFromSupabase(s.user);
        if (!cancelled) setUser(profile);
      }
      if (!cancelled) setIsLoading(false);
    });

    // Subscribe to future auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        setSupabaseUser(s.user);
        const profile = await fetchProfileFromSupabase(s.user);
        if (!cancelled) setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = () => {
    if (!isSupabaseConfigured || !supabaseUser) return;
    fetchProfileFromSupabase(supabaseUser).then((p) => {
      if (p) setUser(p);
    });
  };

  // ── Sign in with email + password ────────────────────────────────────────
  const login = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication service is not configured.' };
    }
    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: mapAuthError(error.message) };
      }

      if (!data.user) {
        return { success: false, error: 'Sign in failed. Please try again.' };
      }

      // Fetch role from database — this is the single source of truth
      const profile = await fetchProfileFromSupabase(data.user);

      if (!profile) {
        // Auth user exists but no profile row yet — create one using role from user_metadata
        const meta = data.user.user_metadata || {};
        const role: UserRole = meta.role === 'admin' || data.user.app_metadata?.role === 'admin' ? 'admin' : 'student';
        const fullName: string = meta.full_name || meta.name || '';
        const [firstName = 'User', ...rest] = fullName.split(' ');
        const lastName = rest.join(' ') || '';
        const newProfile = await createProfileInSupabase(data.user, {
          firstName: meta.first_name || firstName,
          lastName: meta.last_name || lastName,
          role,
        });
        setUser(newProfile);
        return { success: true, role: newProfile?.role ?? role };
      }


      setUser(profile);
      return { success: true, role: profile.role };
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsStudent = async (email: string, password?: string) => {
    const result = await login(email, password);
    if (result.success && result.role === 'admin') {
      // An admin trying the student flow — still let them in, auth context handles routing
      return { success: true };
    }
    return { success: result.success, error: result.error };
  };

  const loginAsAdmin = async (email: string, password?: string) => {
    const result = await login(email, password);
    if (!result.success) return result;
    if (result.role !== 'admin') {
      // Signed in but not an admin — sign them out and reject
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      return { success: false, error: 'This account does not have administrator privileges.' };
    }
    return { success: true };
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const loginWithGoogle = async (
    _rolePreference: UserRole = 'student'
  ): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Google sign-in requires OAuth configuration.' };
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

  // ── Register new student ──────────────────────────────────────────────────
  const registerStudent = async (
    profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'profileCompletion' | 'role'>,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Authentication service is not configured.' };
    }
    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    setIsLoading(true);
    try {
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

      // Create the public profile row with role = 'student'
      const newProfile = await createProfileInSupabase(data.user, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        role: 'student',
        country: profileData.country,
        educationLevel: profileData.educationLevel,
        institution: profileData.institution,
        fieldOfStudy: profileData.fieldOfStudy,
      });

      setUser(newProfile);
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
  };

  // ── Password reset ────────────────────────────────────────────────────────
  const sendPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) return { success: true };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  // ── Update profile ────────────────────────────────────────────────────────
  const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    if (!user) throw new Error('Not authenticated');
    if (!isSupabaseConfigured) throw new Error('Database not configured');

    // Prevent non-admin users from elevating their own role
    const sanitized = { ...updates };
    if (user.role !== 'admin') delete sanitized.role;

    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: sanitized.firstName,
        last_name: sanitized.lastName,
        phone: sanitized.phone,
        country: sanitized.country,
        state: sanitized.state,
        city: sanitized.city,
        education_level: sanitized.educationLevel,
        institution: sanitized.institution,
        field_of_study: sanitized.fieldOfStudy,
        gpa: sanitized.gpa,
        gpa_scale: sanitized.gpaScale,
        financial_need: sanitized.financialNeed,
        gender: sanitized.gender,
        awards: sanitized.awards,
        achievements: sanitized.achievements,
        extracurriculars: sanitized.extracurriculars,
        certifications: sanitized.certifications,
        leadership: sanitized.leadership,
        volunteering: sanitized.volunteering,
        work_experience: sanitized.workExperience,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    const updated = mapSupabaseRowToProfile(data);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        role: user?.role ?? null,
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
    return 'Your email address has not been confirmed yet. If email confirmation is enabled in your Supabase Auth settings, please check your inbox or disable email confirmation in the Supabase Dashboard.';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (m.includes('weak password') || m.includes('password should')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (m.includes('row-level security') || m.includes('rls') || m.includes('permission denied')) {
    return 'Database permission error (RLS policy). Please check that your Supabase RLS policies allow admin profile creation.';
  }
  return message || 'Authentication failed. Please try again.';
}

