/**
 * DataService — Production API-first data service with automatic resilient fallbacks.
 * Queries the REST API backend, keeps UI caches synced, and provides seamless offline capabilities.
 */

import { api } from '../lib/apiClient';
import { StorageService } from './storage';
import type {
  Scholarship, Provider, Category, UserProfile,
  Application, StoredDocument, NotificationItem,
  AdminUser,
} from '../types';

// ─── Public entities ──────────────────────────────────────────────────────────

export async function fetchScholarships(): Promise<Scholarship[]> {
  try {
    const res = await api.get<{ items: Scholarship[]; total: number }>('/scholarships?limit=100');
    if (res?.items && Array.isArray(res.items)) {
      localStorage.setItem('scholarpath_scholarships', JSON.stringify(res.items));
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
      localStorage.setItem('scholarpath_providers', JSON.stringify(res));
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
      localStorage.setItem('scholarpath_categories', JSON.stringify(res));
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
