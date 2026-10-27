import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { api } from '../lib/apiClient';
import {
  supabase,
  isSupabaseConfigured,
  SupabaseUser,
  Session,
} from '../lib/supabase';
import { calculateProfileCompletion } from '../utils/formatters';

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
  ) => Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  updateUserProfile: (profile: UserProfile | Partial<UserProfile>) => Promise<UserProfile>;
  refreshUser: () => void;
  refreshProfile: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Fetch profile from Supabase public.users table ──────────────────────────
// This is the SINGLE source of truth for role.
async function fetchProfileFromSupabase(sbUser: SupabaseUser): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  // 1. Primary lookup by authenticated user ID (UUID)
  let { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', sbUser.id)
    .maybeSingle();

  // 2. Secondary lookup by email if id query yielded no row
  if (!data && sbUser.email) {
    const cleanEmail = sbUser.email.trim().toLowerCase();
    const { data: emailUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (emailUser) {
      data = emailUser;
      // If the row existed with a legacy/seeded id, link it to the actual auth id
      if (emailUser.id !== sbUser.id) {
        try {
          await supabase
            .from('users')
            .update({ id: sbUser.id })
            .eq('email', cleanEmail);
          data.id = sbUser.id;
        } catch {
          // Ignore if updating primary key is restricted by foreign key
        }
      }
    }
  }

  // 3. Fallback: If no profile row exists, provision safe default 'student' profile
  // Client-controlled metadata (user_metadata, app_metadata) is NEVER trusted for role escalation.
  if (error || !data) {
    const meta = sbUser.user_metadata || {};
    const fullName: string = meta.full_name || meta.name || '';
    const [firstName = 'User', ...rest] = fullName.split(' ');
    const lastName = rest.join(' ') || '';

    return createProfileInSupabase(sbUser, {
      firstName: meta.first_name || firstName,
      lastName: meta.last_name || lastName,
      role: 'student',
      country: 'International',
      educationLevel: 'Undergraduate',
      institution: '',
      fieldOfStudy: meta.assigned_department || '',
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
    applicantStage?: string;
    secondarySchoolName?: string;
    secondaryGraduationYear?: number;
    targetMajor?: string;
    tradeSpecialization?: string;
    tradeCertifications?: string[];
    yearsOfExperience?: number;
    targetIndustry?: string;
    skills?: string[];
    portfolioUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    institution?: string;
    fieldOfStudy?: string;
    gpa?: number;
    gpaScale?: number;
  }
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const row: Record<string, unknown> = {
    id: sbUser.id,
    email: (sbUser.email ?? '').trim().toLowerCase(),
    role: extra.role,
    first_name: extra.firstName,
    last_name: extra.lastName,
    country: extra.country ?? 'International',
    education_level: extra.educationLevel ?? null,
    applicant_stage: extra.applicantStage ?? null,
    secondary_school_name: extra.secondarySchoolName ?? null,
    secondary_graduation_year: extra.secondaryGraduationYear ?? null,
    target_major: extra.targetMajor ?? null,
    trade_specialization: extra.tradeSpecialization ?? null,
    trade_certifications: extra.tradeCertifications ?? [],
    years_of_experience: extra.yearsOfExperience ?? 0,
    target_industry: extra.targetIndustry ?? null,
    skills: extra.skills ?? [],
    portfolio_url: extra.portfolioUrl ?? null,
    linkedin_url: extra.linkedinUrl ?? null,
    github_url: extra.githubUrl ?? null,
    institution: extra.institution ?? (extra.role === 'admin' ? 'Scholavon Foundation' : ''),
    field_of_study: extra.fieldOfStudy ?? '',
    gpa: extra.gpa !== undefined ? extra.gpa : null,
    gpa_scale: extra.gpaScale !== undefined ? extra.gpaScale : null,
    profile_completion: 0,
  };

  const { data, error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to create profile in Supabase:', error?.message);
    return null;
  }

  return mapSupabaseRowToProfile(data);
}

// ─── Frontend Staging Plus Test Override Guard ────────────────────────────────
function checkFrontendStagingPlusOverride(email: string): boolean {
  if (import.meta.env.VITE_ALLOW_STAGING_PLUS_OVERRIDE !== 'true') {
    return false;
  }

  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname.toLowerCase();
    if (
      host === 'scholavon.com' ||
      host === 'www.scholavon.com' ||
      host === 'scholavon.org' ||
      host === 'www.scholavon.org'
    ) {
      return false;
    }
  }

  const authorizedEmail = (
    import.meta.env.VITE_STAGING_PLUS_OVERRIDE_EMAIL || 'apexnovacm@gmail.com'
  ).toLowerCase().trim();
  if (authorizedEmail !== 'apexnovacm@gmail.com') {
    return false;
  }

  return (email || '').toLowerCase().trim() === 'apexnovacm@gmail.com';
}

// ─── Map a Supabase DB row → UserProfile ──────────────────────────────────────
function mapSupabaseRowToProfile(row: Record<string, unknown>): UserProfile {
  const rawRole = String(row.role || '').trim().toLowerCase();
  const role: UserRole = rawRole === 'admin' || rawRole === 'super admin' ? 'admin' : 'student';

  const profile: UserProfile = {
    id: row.id as string,
    email: (row.email as string) ?? '',
    role,
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    country: (row.country as string) ?? 'International',
    phone: row.phone as string | undefined,
    dateOfBirth: row.date_of_birth as string | undefined,
    state: row.state as string | undefined,
    city: row.city as string | undefined,
    educationLevel: (row.education_level as UserProfile['educationLevel']) || undefined,
    applicantStage: (row.applicant_stage as UserProfile['applicantStage']) || undefined,
    secondarySchoolName: (row.secondary_school_name as string) || undefined,
    secondaryGraduationYear: (row.secondary_graduation_year as number) || undefined,
    targetMajor: (row.target_major as string) || undefined,
    tradeSpecialization: (row.trade_specialization as string) || undefined,
    tradeCertifications: (row.trade_certifications as string[]) || [],
    yearsOfExperience: (row.years_of_experience as number) || undefined,
    targetIndustry: (row.target_industry as string) || undefined,
    skills: (row.skills as string[]) || [],
    portfolioUrl: (row.portfolio_url as string) || undefined,
    linkedinUrl: (row.linkedin_url as string) || undefined,
    githubUrl: (row.github_url as string) || undefined,
    institution: (row.institution as string) ?? '',
    fieldOfStudy: (row.field_of_study as string) ?? '',
    course: row.course as string | undefined,
    yearLevel: row.year_level as string | undefined,
    graduationYear: row.graduation_year as number | undefined,
    gpa: row.gpa !== null && row.gpa !== undefined ? Number(row.gpa) : undefined,
    gpaScale: row.gpa_scale !== null && row.gpa_scale !== undefined ? Number(row.gpa_scale) : undefined,
    financialNeed: (row.financial_need as boolean) ?? false,
    gender: row.gender as UserProfile['gender'],
    awards: (row.awards as string[]) ?? [],
    achievements: (row.achievements as string[]) ?? [],
    extracurriculars: (row.extracurriculars as string[]) ?? [],
    certifications: (row.certifications as string[]) ?? [],
    leadership: (row.leadership as string[]) ?? [],
    volunteering: (row.volunteering as string[]) ?? [],
    workExperience: (row.work_experience as string[]) ?? [],
    profileCompletion: 0,
    notificationPreferences: row.notification_preferences as UserProfile['notificationPreferences'],
    // Subscription status from public.users.subscription_status.
    // Written by server webhook only — never trusted from client.
    // Falls back to 'free' for users who haven't subscribed or before migration v4.
    subscriptionStatus: ((row.subscription_status as string) || 'free') as UserProfile['subscriptionStatus'],
    isTestOverride: false,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };

  if (checkFrontendStagingPlusOverride(profile.email)) {
    profile.subscriptionStatus = 'premium';
    profile.isTestOverride = true;
  }

  profile.profileCompletion = calculateProfileCompletion(profile);
  return profile;
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
        if (s.access_token) api.setToken(s.access_token);
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
        if (s.access_token) api.setToken(s.access_token);
        const profile = await fetchProfileFromSupabase(s.user);
        if (!cancelled) setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
        api.setToken(null);
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

  const refreshProfile = async (): Promise<void> => {
    if (!isSupabaseConfigured || !supabaseUser) return;
    const p = await fetchProfileFromSupabase(supabaseUser);
    if (p) setUser(p);
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

      // Fetch role from database — public.users is the source of truth
      const profile = await fetchProfileFromSupabase(data.user);

      if (!profile) {
        return { success: false, error: 'Could not load user profile from database.' };
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
      return { success: true, role: 'admin' as UserRole };
    }
    return result;
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
    return { success: true, role: 'admin' as UserRole };
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
  ): Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }> => {
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
      await createProfileInSupabase(data.user, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        role: 'student',
        country: profileData.country,
        educationLevel: profileData.educationLevel,
        applicantStage: profileData.applicantStage,
        secondarySchoolName: profileData.secondarySchoolName,
        secondaryGraduationYear: profileData.secondaryGraduationYear,
        targetMajor: profileData.targetMajor,
        tradeSpecialization: profileData.tradeSpecialization,
        tradeCertifications: profileData.tradeCertifications,
        yearsOfExperience: profileData.yearsOfExperience,
        targetIndustry: profileData.targetIndustry,
        skills: profileData.skills,
        portfolioUrl: profileData.portfolioUrl,
        linkedinUrl: profileData.linkedinUrl,
        githubUrl: profileData.githubUrl,
        institution: profileData.institution,
        fieldOfStudy: profileData.fieldOfStudy,
        gpa: profileData.gpa,
        gpaScale: profileData.gpaScale,
      });

      // If Supabase email confirmation is enabled, session will be null after signUp.
      // This is the grandfathering boundary: new users must confirm; existing users
      // who already have a session are never touched by this code path.
      if (!data.session) {
        // Email confirmation required — do NOT log the user in yet
        return { success: true, requiresConfirmation: true };
      }

      // Email confirmation disabled (or auto-confirmed) — log in immediately
      const newProfile = await fetchProfileFromSupabase(data.user);
      setUser(newProfile);
      return { success: true, requiresConfirmation: false };
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
    api.setToken(null);
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
  };

  // ── Password reset ────────────────────────────────────────────────────────
  const sendPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    // For Supabase OAuth users: delegate to Supabase Auth
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // For email+password users: call our own server endpoint
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      if (res?.message) return { success: true };
      return { success: true };
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Something went wrong. Please try again.';
      return { success: false, error: msg };
    }
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
        applicant_stage: sanitized.applicantStage,
        secondary_school_name: sanitized.secondarySchoolName,
        secondary_graduation_year: sanitized.secondaryGraduationYear,
        target_major: sanitized.targetMajor,
        trade_specialization: sanitized.tradeSpecialization,
        trade_certifications: sanitized.tradeCertifications,
        years_of_experience: sanitized.yearsOfExperience,
        target_industry: sanitized.targetIndustry,
        skills: sanitized.skills,
        portfolio_url: sanitized.portfolioUrl,
        linkedin_url: sanitized.linkedinUrl,
        github_url: sanitized.githubUrl,
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
        refreshProfile,
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

