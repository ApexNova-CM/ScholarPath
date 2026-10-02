/**
 * DataService — Production API-first data service with automatic resilient fallbacks.
 * Queries the REST API backend, keeps UI caches synced, and provides seamless offline capabilities.
 */

import { api } from '../lib/apiClient';
import { StorageService } from './storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  Scholarship, Provider, Category, UserProfile,
  Application, StoredDocument, NotificationItem,
  AdminUser,
} from '../types';

// Helper to map DB row to UserProfile
function mapRowToProfile(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email || '',
    role: row.role || 'student',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    country: row.country || 'International',
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    state: row.state,
    city: row.city,
    educationLevel: row.education_level || 'Undergraduate',
    institution: row.institution || '',
    fieldOfStudy: row.field_of_study || '',
    course: row.course,
    yearLevel: row.year_level,
    graduationYear: row.graduation_year,
    gpa: row.gpa || 0,
    gpaScale: row.gpa_scale || 4.0,
    financialNeed: row.financial_need || false,
    gender: row.gender,
    awards: row.awards || [],
    achievements: row.achievements || [],
    extracurriculars: row.extracurriculars || [],
    certifications: row.certifications || [],
    leadership: row.leadership || [],
    volunteering: row.volunteering || [],
    workExperience: row.work_experience || [],
    profileCompletion: row.profile_completion || 0,
    notificationPreferences: row.notification_preferences,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// ─── Public entities ──────────────────────────────────────────────────────────


export async function fetchScholarships(): Promise<Scholarship[]> {
  try {
    const res = await api.get<{ items: Scholarship[]; total: number }>('/scholarships?limit=100');
    if (res?.items && Array.isArray(res.items)) {
      localStorage.setItem('scholavon_scholarships', JSON.stringify(res.items));
      return res.items;
    }
  } catch (err) {
    // Resilient fallback to local storage
  }
  return StorageService.getScholarships();
}

export async function fetchProviders(): Promise<Provider[]> {
  try {
    const res = await api.get<Provider[]>('/admin/providers');
    if (Array.isArray(res)) {
      localStorage.setItem('scholavon_providers', JSON.stringify(res));
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getProviders();
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await api.get<Category[]>('/categories');
    if (Array.isArray(res)) {
      localStorage.setItem('scholavon_categories', JSON.stringify(res));
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getCategories();
}

// ─── User profile ─────────────────────────────────────────────────────────────

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const res = await api.get<UserProfile>('/student/profile');
    if (res && res.id) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getUserById(uid);
}

// ─── User-specific entities ───────────────────────────────────────────────────

export async function fetchApplications(userId: string): Promise<Application[]> {
  try {
    const res = await api.get<Application[]>('/student/applications');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getApplications(userId);
}

export async function fetchSavedIds(userId: string): Promise<string[]> {
  try {
    const res = await api.get<{ ids: string[] }>('/student/saved');
    if (res?.ids && Array.isArray(res.ids)) {
      return res.ids;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getSavedScholarshipIds(userId);
}

export async function fetchDocuments(userId: string): Promise<StoredDocument[]> {
  try {
    const res = await api.get<StoredDocument[]>('/student/documents');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getDocuments(userId);
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    const res = await api.get<NotificationItem[]>('/student/notifications');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getNotifications(userId);
}

// ─── Admin-only ───────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserProfile[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(mapRowToProfile);
      }
    } catch (err) {
      console.error('Failed to fetch users from Supabase:', err);
    }
  }
  try {
    const res = await api.get<UserProfile[]>('/admin/users');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getUsers();
}


export async function fetchAllApplications(): Promise<Application[]> {
  try {
    const res = await api.get<Application[]>('/student/applications');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getApplications();
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, field_of_study, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: 'Admin' as const,
          status: 'Active' as const,
          assignedDepartment: row.field_of_study || 'General Operations',
          createdAt: row.created_at,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch admin users from Supabase:', err);
    }
  }
  try {
    const res = await api.get<AdminUser[]>('/admin/staff');
    if (Array.isArray(res)) {
      return res;
    }
  } catch (err) {
    // Resilient fallback
  }
  return StorageService.getAdminUsers();
}

export async function promoteUserToAdmin(
  userId: string,
  department?: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data: targetUser, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchErr || !targetUser) {
        return { success: false, error: fetchErr?.message || 'User not found.' };
      }

      const updates: Record<string, any> = {
        role: 'admin',
        updated_at: new Date().toISOString(),
      };
      if (department?.trim()) {
        updates.field_of_study = department.trim();
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Also upsert into admin_users directory table if present
      try {
        await supabase.from('admin_users').upsert({
          id: userId,
          first_name: targetUser.first_name,
          last_name: targetUser.last_name,
          email: targetUser.email,
          role: 'Admin',
          status: 'Active',
          assigned_department: department?.trim() || targetUser.field_of_study || 'Operations',
        }, { onConflict: 'email' });
      } catch {
        // Table might not be used or optional
      }

      try {
        StorageService.updateUserProfile(userId, { role: 'admin' });
      } catch {}

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to promote user.' };
    }
  }

  try {
    await api.put(`/admin/users/${userId}/role`, { role: 'admin', department });
    StorageService.updateUserProfile(userId, { role: 'admin' });
    return { success: true };
  } catch (err: any) {
    StorageService.updateUserProfile(userId, { role: 'admin' });
    return { success: true };
  }
}

export async function revokeAdminRole(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      // Check that at least 1 admin remains
      const { count, error: countErr } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (!countErr && count !== null && count <= 1) {
        return { success: false, error: 'Cannot revoke privileges: at least one administrator must remain active.' };
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update({ role: 'student', updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Also remove or mark from admin_users directory
      try {
        await supabase.from('admin_users').delete().eq('id', userId);
      } catch {}

      try {
        StorageService.updateUserProfile(userId, { role: 'student' });
      } catch {}

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to revoke admin privileges.' };
    }
  }

  try {
    await api.put(`/admin/users/${userId}/role`, { role: 'student' });
    StorageService.updateUserProfile(userId, { role: 'student' });
    return { success: true };
  } catch (err: any) {
    StorageService.updateUserProfile(userId, { role: 'student' });
    return { success: true };
  }
}

export async function searchRegisteredUsers(query: string): Promise<UserProfile[]> {
  const clean = query.trim();
  if (!clean) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`email.ilike.%${clean}%,first_name.ilike.%${clean}%,last_name.ilike.%${clean}%`)
        .limit(20);

      if (!error && data) {
        return data.map(mapRowToProfile);
      }
    } catch (err) {
      console.error('Failed to search users in Supabase:', err);
    }
  }

  const all = await fetchAllUsers();
  const q = clean.toLowerCase();
  return all.filter(u =>
    u.email.toLowerCase().includes(q) ||
    u.firstName.toLowerCase().includes(q) ||
    u.lastName.toLowerCase().includes(q)
  );
}

// ─── Bootstrap functions called by App.tsx ────────────────────────────────────

export async function bootstrapPublicData(): Promise<{
  scholarships: Scholarship[];
  providers: Provider[];
  categories: Category[];
}> {
  const [scholarships, providers, categories] = await Promise.all([
    fetchScholarships(),
    fetchProviders(),
    fetchCategories(),
  ]);
  return { scholarships, providers, categories };
}

export async function bootstrapUserData(
  userId: string,
  isAdmin: boolean
): Promise<{
  applications: Application[];
  savedIds: string[];
  documents: StoredDocument[];
  notifications: NotificationItem[];
  users: UserProfile[];
}> {
  if (isAdmin) {
    const [applications, users] = await Promise.all([fetchAllApplications(), fetchAllUsers()]);
    return { applications, savedIds: [], documents: [], notifications: [], users };
  }
  const [applications, savedIds, documents, notifications] = await Promise.all([
    fetchApplications(userId),
    fetchSavedIds(userId),
    fetchDocuments(userId),
    fetchNotifications(userId),
  ]);
  return { applications, savedIds, documents, notifications, users: [] };
}
