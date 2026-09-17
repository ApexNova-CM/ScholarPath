import {
  Scholarship, Provider, Category, UserProfile, StoredDocument,
  Application, NotificationItem, VerificationRecord, SavedScholarship,
  VerificationStatus, ApplicationStatus, AdminUser
} from '../types';
import { syncToSupabase, removeFromSupabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';


const STORAGE_KEYS = {
  USERS: 'scholarpath_users',
  ADMIN_USERS: 'scholarpath_admin_users',
  SCHOLARSHIPS: 'scholarpath_scholarships',
  PROVIDERS: 'scholarpath_providers',
  CATEGORIES: 'scholarpath_categories',
  APPLICATIONS: 'scholarpath_applications',
  SAVED: 'scholarpath_saved',
  DOCUMENTS: 'scholarpath_documents',
  NOTIFICATIONS: 'scholarpath_notifications',
  VERIFICATIONS: 'scholarpath_verifications',
  CURRENT_USER_ID: 'scholarpath_current_user_id',
};

/** Test the Supabase connection on boot (re-exported from supabase.ts) */
export { testSupabaseConnection as testFirestoreConnection } from '../lib/supabase';



// Helper for persistent JSON read/write
function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

function write<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

// Initial bootstrap — ensures empty collections exist in localStorage, no mock data
export function initializeStorage(): void {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(STORAGE_KEYS.USERS))         write(STORAGE_KEYS.USERS, []);
  if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USERS))   write(STORAGE_KEYS.ADMIN_USERS, []);
  if (!localStorage.getItem(STORAGE_KEYS.SCHOLARSHIPS))  write(STORAGE_KEYS.SCHOLARSHIPS, []);
  if (!localStorage.getItem(STORAGE_KEYS.PROVIDERS))     write(STORAGE_KEYS.PROVIDERS, []);
  if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES))    write(STORAGE_KEYS.CATEGORIES, []);
  if (!localStorage.getItem(STORAGE_KEYS.DOCUMENTS))     write(STORAGE_KEYS.DOCUMENTS, []);
  if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS))  write(STORAGE_KEYS.APPLICATIONS, []);
  if (!localStorage.getItem(STORAGE_KEYS.SAVED))         write(STORAGE_KEYS.SAVED, []);
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) write(STORAGE_KEYS.NOTIFICATIONS, []);
  if (!localStorage.getItem(STORAGE_KEYS.VERIFICATIONS)) write(STORAGE_KEYS.VERIFICATIONS, []);
}

// Ensure initialized on import
initializeStorage();


// Profile completion calculator
export function calculateProfileCompletion(profile: Partial<UserProfile>): number {
  let points = 0;
  if (profile.firstName && profile.lastName) points += 10;
  if (profile.email) points += 10;
  if (profile.country) points += 10;
  if (profile.dateOfBirth) points += 5;
  if (profile.educationLevel) points += 15;
  if (profile.institution) points += 10;
  if (profile.fieldOfStudy) points += 15;
  if (profile.gpa && profile.gpa > 0) points += 15;
  if (profile.awards && profile.awards.length > 0) points += 5;
  if (profile.certifications && profile.certifications.length > 0) points += 5;
  return Math.min(100, points);
}

export const StorageService = {
  // --- USERS ---
  getUsers(): UserProfile[] {
    return read<UserProfile[]>(STORAGE_KEYS.USERS, []);
  },

  getUserById(id: string): UserProfile | null {
    const users = this.getUsers();
    const foundUser = users.find(u => u.id === id);
    if (foundUser) return foundUser;

    // Check admin directory
    const admins = this.getAdminUsers();
    const foundAdmin = admins.find(a => a.id === id);
    if (foundAdmin) {
      const parts = foundAdmin.name.split(' ');
      return {
        id: foundAdmin.id,
        email: foundAdmin.email,
        firstName: parts[0] || 'Admin',
        lastName: parts.slice(1).join(' ') || 'User',
        country: 'United States',
        role: 'admin',
        educationLevel: 'Postgraduate (Masters)',
        institution: 'ScholarPath Foundation',
        fieldOfStudy: foundAdmin.department || 'Administration',
        gpa: 4.0,
        gpaScale: 4.0,
        leadership: ['Governance', 'Scholarship Verification'],
        profileCompletion: 100,
        createdAt: foundAdmin.createdAt,
        updatedAt: foundAdmin.createdAt
      };
    }

    return null;
  },

  getUserByEmail(email: string): UserProfile | null {
    const trimmed = email.trim().toLowerCase();
    const users = this.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === trimmed);
    if (foundUser) return foundUser;

    // Check admin directory
    const admins = this.getAdminUsers();
    const foundAdmin = admins.find(a => a.email.toLowerCase() === trimmed);
    if (foundAdmin && foundAdmin.status === 'active') {
      const parts = foundAdmin.name.split(' ');
      return {
        id: foundAdmin.id,
        email: foundAdmin.email,
        firstName: parts[0] || 'Admin',
        lastName: parts.slice(1).join(' ') || 'User',
        country: 'United States',
        role: 'admin',
        educationLevel: 'Postgraduate (Masters)',
        institution: 'ScholarPath Foundation',
        fieldOfStudy: foundAdmin.department || 'Administration',
        gpa: 4.0,
        gpaScale: 4.0,
        leadership: ['Governance', 'Scholarship Verification'],
        profileCompletion: 100,
        createdAt: foundAdmin.createdAt,
        updatedAt: foundAdmin.createdAt
      };
    }

    return null;
  },

  createUser(user: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'profileCompletion'> & { id?: string }): UserProfile {
    const users = this.getUsers();
    const newUser: UserProfile = {
      ...user,
      id: user.id || generateUUID(),
      profileCompletion: calculateProfileCompletion(user),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    write(STORAGE_KEYS.USERS, users);
    syncToSupabase('users', newUser);
    return newUser;
  },


  updateUserProfile(id: string, updates: Partial<UserProfile>): UserProfile {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    const updatedUser = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    // Recompute profile completion
    updatedUser.profileCompletion = calculateProfileCompletion(updatedUser);

    users[index] = updatedUser;
    write(STORAGE_KEYS.USERS, users);
    syncToSupabase('users', updatedUser);
    return updatedUser;
  },

  saveUserProfile(profile: UserProfile): UserProfile {
    return this.updateUserProfile(profile.id, profile);
  },

  // --- SCHOLARSHIPS ---
  getScholarships(): Scholarship[] {
    return read<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
  },

  getScholarshipById(id: string): Scholarship | null {
    const scholarships = this.getScholarships();
    return scholarships.find(s => s.id === id) || null;
  },

  createScholarship(data: Omit<Scholarship, 'id' | 'viewCount' | 'saveCount' | 'createdAt' | 'updatedAt'>): Scholarship {
    const list = this.getScholarships();
    const newScholarship: Scholarship = {
      ...data,
      id: generateUUID(),
      // Default to pending_verification per prompt rule 12
      status: data.status || 'pending_verification',
      verificationStatus: data.verificationStatus || 'pending_verification',
      viewCount: 0,
      saveCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newScholarship);
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', newScholarship);

    // Update category count
    this.refreshCategoryCounts();
    return newScholarship;
  },

  updateScholarship(id: string, updates: Partial<Scholarship>): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const updated: Scholarship = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', updated);
    this.refreshCategoryCounts();
    return updated;
  },

  saveScholarship(scholarship: Scholarship): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === scholarship.id);
    let target = scholarship;
    if (index !== -1) {
      target = { ...scholarship, updatedAt: new Date().toISOString() };
      list[index] = target;
    } else {
      target = {
        ...scholarship,
        viewCount: scholarship.viewCount || 0,
        saveCount: scholarship.saveCount || 0,
        createdAt: scholarship.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.unshift(target);
    }
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', target);
    this.refreshCategoryCounts();
    return target;
  },

  verifyScholarship(id: string, adminIdOrName?: string, adminEmail?: string, notes?: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const previousStatus = list[index].verificationStatus;
    const now = new Date().toISOString();
    const verifier = adminEmail || adminIdOrName || 'System Admin Operations';

    const updated: Scholarship = {
      ...list[index],
      status: 'verified',
      verificationStatus: 'verified',
      verifiedBy: verifier,
      verifiedAt: now,
      verificationNotes: notes || list[index].verificationNotes,
      updatedAt: now
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);

    // Record audit trail
    this.addVerificationRecord({
      id: generateUUID(),
      scholarshipId: id,
      scholarshipTitle: updated.title,
      adminId: adminIdOrName || 'usr-admin',
      adminEmail: adminEmail || 'admin@scholarpath.org',
      previousStatus,
      newStatus: 'verified',
      notes,
      timestamp: now
    });

    syncToSupabase('scholarships', updated);
    return updated;
  },

  unverifyScholarship(id: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const now = new Date().toISOString();
    const updated: Scholarship = {
      ...list[index],
      verificationStatus: 'unverified',
      verifiedBy: undefined,
      verifiedAt: undefined,
      updatedAt: now
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', updated);
    return updated;
  },

  archiveScholarship(id: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const now = new Date().toISOString();
    const updated: Scholarship = {
      ...list[index],
      status: 'archived',
      updatedAt: now
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', updated);
    return updated;
  },

  deleteScholarship(id: string): boolean {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return false;

    list.splice(index, 1);
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    removeFromSupabase('scholarships', id);
    this.refreshCategoryCounts();
    return true;
  },

  rejectScholarship(id: string, reasonOrAdminId?: string, adminEmail?: string, notes?: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const previousStatus = list[index].verificationStatus;
    const now = new Date().toISOString();
    const finalReason = notes || reasonOrAdminId || 'Unmet criteria';

    const updated: Scholarship = {
      ...list[index],
      status: 'rejected',
      verificationStatus: 'rejected',
      verificationNotes: finalReason,
      updatedAt: now
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);

    this.addVerificationRecord({
      id: generateUUID(),
      scholarshipId: id,
      scholarshipTitle: updated.title,
      adminId: adminEmail ? (reasonOrAdminId || 'usr-admin') : 'usr-admin',
      adminEmail: adminEmail || 'admin@scholarpath.org',
      previousStatus,
      newStatus: 'rejected',
      notes: finalReason,
      timestamp: now
    });

    syncToSupabase('scholarships', updated);
    return updated;
  },


  incrementViewCount(id: string): void {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index !== -1) {
      list[index].viewCount = (list[index].viewCount || 0) + 1;
      write(STORAGE_KEYS.SCHOLARSHIPS, list);
    }
  },

  // --- PROVIDERS ---
  getProviders(): Provider[] {
    return read<Provider[]>(STORAGE_KEYS.PROVIDERS, []);
  },

  createProvider(data: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Provider {
    const providers = this.getProviders();
    const newProv: Provider = {
      ...data,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    providers.push(newProv);
    write(STORAGE_KEYS.PROVIDERS, providers);
    syncToSupabase('providers', newProv);
    return newProv;
  },

  updateProvider(id: string, updates: Partial<Provider>): Provider {
    const providers = this.getProviders();
    const index = providers.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Provider not found');
    providers[index] = { ...providers[index], ...updates, updatedAt: new Date().toISOString() };
    write(STORAGE_KEYS.PROVIDERS, providers);
    syncToSupabase('providers', providers[index]);
    return providers[index];
  },

  saveProviders(providers: Provider[]): void {
    write(STORAGE_KEYS.PROVIDERS, providers);
    providers.forEach(p => syncToSupabase('providers', p));
  },

  // --- CATEGORIES ---
  getCategories(): Category[] {
    return read<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  },

  saveCategories(categories: Category[]): void {
    write(STORAGE_KEYS.CATEGORIES, categories);
    categories.forEach(c => syncToSupabase('categories', c));
  },

  refreshCategoryCounts(): void {
    const categories = this.getCategories();
    const scholarships = this.getScholarships();
    const updated = categories.map(cat => ({
      ...cat,
      scholarshipCount: scholarships.filter(s => s.category.toLowerCase().includes(cat.name.toLowerCase()) || cat.name.toLowerCase().includes(s.category.toLowerCase())).length
    }));
    write(STORAGE_KEYS.CATEGORIES, updated);
  },

  // --- SAVED SCHOLARSHIPS ---
  getSavedScholarships(userId: string): SavedScholarship[] {
    const all = read<SavedScholarship[]>(STORAGE_KEYS.SAVED, []);
    return all.filter(s => s.userId === userId);
  },

  getSavedScholarshipIds(userId: string): string[] {
    return this.getSavedScholarships(userId).map(s => s.scholarshipId);
  },

  toggleSavedScholarship(userId: string, scholarshipId: string): string[] {
    this.toggleSaveScholarship(userId, scholarshipId);
    return this.getSavedScholarshipIds(userId);
  },

  isScholarshipSaved(userId: string, scholarshipId: string): boolean {
    const saved = this.getSavedScholarships(userId);
    return saved.some(s => s.scholarshipId === scholarshipId);
  },

  toggleSaveScholarship(userId: string, scholarshipId: string): boolean {
    const all = read<SavedScholarship[]>(STORAGE_KEYS.SAVED, []);
    const existingIndex = all.findIndex(s => s.userId === userId && s.scholarshipId === scholarshipId);
    let isNowSaved = false;

    if (existingIndex !== -1) {
      const removed = all[existingIndex];
      all.splice(existingIndex, 1);
      isNowSaved = false;
      if (removed.id) removeFromSupabase('saved_scholarships', removed.id);
    } else {
      const newSave: SavedScholarship = {
        id: generateUUID(),
        userId,
        scholarshipId,
        savedAt: new Date().toISOString()
      };
      all.push(newSave);
      isNowSaved = true;
      syncToSupabase('saved_scholarships', newSave);
    }

    write(STORAGE_KEYS.SAVED, all);

    // Update scholarship saveCount
    const scholarships = this.getScholarships();
    const schIndex = scholarships.findIndex(s => s.id === scholarshipId);
    if (schIndex !== -1) {
      scholarships[schIndex].saveCount = Math.max(0, (scholarships[schIndex].saveCount || 0) + (isNowSaved ? 1 : -1));
      write(STORAGE_KEYS.SCHOLARSHIPS, scholarships);
    }

    return isNowSaved;
  },

  // --- APPLICATIONS ---
  getApplications(userId?: string): Application[] {
    const all = read<Application[]>(STORAGE_KEYS.APPLICATIONS, []);
    if (userId) {
      return all.filter(a => a.userId === userId);
    }
    return all;
  },

  getApplicationById(id: string): Application | null {
    const all = this.getApplications();
    return all.find(a => a.id === id) || null;
  },

  createApplication(
    userId: string, 
    scholarship: Scholarship, 
    status: ApplicationStatus = 'Preparing',
    notes: string = ''
  ): Application {
    const all = this.getApplications();
    // Check if user already has an application for this scholarship
    const existing = all.find(a => a.userId === userId && a.scholarshipId === scholarship.id);
    if (existing) return existing;

    // Generate checklist based on scholarship's required documents
    const documents = this.getDocuments(userId);
    const checklist = scholarship.requiredDocuments.map((docName, idx) => {
      // Find if student already has a matching document
      const matchingDoc = documents.find(d => d.type.toLowerCase().includes(docName.toLowerCase()) || docName.toLowerCase().includes(d.type.toLowerCase()));
      return {
        id: `chk-${idx + 1}-${generateUUID().slice(0, 8)}`,
        label: `${docName} ${matchingDoc ? 'available' : 'needed'}`,
        completed: Boolean(matchingDoc),
        documentId: matchingDoc ? matchingDoc.id : undefined,
        required: true
      };
    });

    const newApp: Application = {
      id: generateUUID(),
      userId,
      scholarshipId: scholarship.id,
      scholarshipTitle: scholarship.title,
      providerName: scholarship.providerName,
      deadline: scholarship.deadline,
      amount: scholarship.amount,
      currency: scholarship.currency,
      status,
      appliedAt: status === 'Applied' ? new Date().toISOString() : undefined,
      notes,
      checklist,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    all.unshift(newApp);
    write(STORAGE_KEYS.APPLICATIONS, all);
    syncToSupabase('applications', newApp);
    return newApp;
  },

  updateApplication(id: string, updates: Partial<Application>): Application {
    const all = this.getApplications();
    const index = all.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Application not found');

    const updated: Application = {
      ...all[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.status === 'Applied' && !all[index].appliedAt) {
      updated.appliedAt = new Date().toISOString();
    }

    all[index] = updated;
    write(STORAGE_KEYS.APPLICATIONS, all);
    syncToSupabase('applications', updated);
    return updated;
  },

  updateApplicationStatus(id: string, status: ApplicationStatus, notes?: string): Application {
    return this.updateApplication(id, {
      status,
      ...(notes !== undefined ? { notes } : {})
    });
  },

  deleteApplication(id: string): void {
    let all = this.getApplications();
    all = all.filter(a => a.id !== id);
    write(STORAGE_KEYS.APPLICATIONS, all);
    removeFromSupabase('applications', id);
  },

  // --- DOCUMENTS ---
  getDocuments(userId: string): StoredDocument[] {
    const all = read<StoredDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    return all.filter(d => d.userId === userId);
  },

  saveDocuments(documents: StoredDocument[]): void {
    write(STORAGE_KEYS.DOCUMENTS, documents);
    documents.forEach(d => syncToSupabase('documents', d));
  },

  uploadDocument(
    userId: string, 
    fileData: { name: string; type: StoredDocument['type']; fileFormat: string; fileSize: number; fileUrl?: string }
  ): StoredDocument {
    const all = read<StoredDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    const newDoc: StoredDocument = {
      id: generateUUID(),
      userId,
      name: fileData.name,
      type: fileData.type,
      fileFormat: fileData.fileFormat,
      fileSize: fileData.fileSize,
      fileUrl: fileData.fileUrl || `#preview-${generateUUID().slice(0, 8)}`,
      status: 'available',
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.unshift(newDoc);
    write(STORAGE_KEYS.DOCUMENTS, all);
    syncToSupabase('documents', newDoc);
    return newDoc;
  },

  deleteDocument(id: string, userId: string): void {
    let all = read<StoredDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    all = all.filter(d => !(d.id === id && d.userId === userId));
    write(STORAGE_KEYS.DOCUMENTS, all);
    removeFromSupabase('documents', id);
  },

  // --- NOTIFICATIONS ---
  getNotifications(userId: string): NotificationItem[] {
    const all = read<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    return all.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createNotification(item: NotificationItem): void {
    const all = read<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    all.unshift(item);
    write(STORAGE_KEYS.NOTIFICATIONS, all);
    syncToSupabase('notifications', item);
  },

  markNotificationAsRead(id: string): void {
    const all = read<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const notif = all.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      write(STORAGE_KEYS.NOTIFICATIONS, all);
      syncToSupabase('notifications', notif);
    }
  },

  markAllNotificationsAsRead(userId: string): void {
    const all = read<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    all.forEach(n => {
      if (n.userId === userId) {
        n.read = true;
        syncToSupabase('notifications', n);
      }
    });
    write(STORAGE_KEYS.NOTIFICATIONS, all);
  },

  // --- AUDIT & VERIFICATION RECORDS ---
  getVerificationRecords(): VerificationRecord[] {
    return read<VerificationRecord[]>(STORAGE_KEYS.VERIFICATIONS, []);
  },

  addVerificationRecord(record: VerificationRecord): void {
    const all = this.getVerificationRecords();
    all.unshift(record);
    write(STORAGE_KEYS.VERIFICATIONS, all);
    syncToSupabase('verifications', record);
  },

  // --- PLATFORM STATISTICS FOR ADMIN DASHBOARD ---
  getAdminStats() {
    const scholarships = this.getScholarships();
    const users = this.getUsers().filter(u => u.role === 'student');
    const allSaved = read<SavedScholarship[]>(STORAGE_KEYS.SAVED, []);
    const applications = this.getApplications();

    const now = new Date().getTime();

    const activeScholarships = scholarships.filter(s => {
      const isPast = new Date(s.deadline).getTime() < now;
      return (s.status === 'verified' || s.status === 'pending_verification') && !isPast;
    });

    const pendingVerification = scholarships.filter(s => s.verificationStatus === 'pending_verification');
    const verifiedScholarships = scholarships.filter(s => s.verificationStatus === 'verified');
    const expiredScholarships = scholarships.filter(s => new Date(s.deadline).getTime() < now);

    // Group applications by status
    const appStatusCounts: Record<string, number> = {
      Interested: 0,
      Preparing: 0,
      Applied: 0,
      'Under Review': 0,
      Interview: 0,
      Successful: 0,
      Unsuccessful: 0,
      Withdrawn: 0
    };
    applications.forEach(a => {
      if (appStatusCounts[a.status] !== undefined) {
        appStatusCounts[a.status]++;
      }
    });

    // Verification split
    const verificationBreakdown = {
      verified: verifiedScholarships.length,
      pending: pendingVerification.length,
      rejected: scholarships.filter(s => s.verificationStatus === 'rejected').length
    };

    return {
      totalScholarships: scholarships.length,
      activeScholarships: activeScholarships.length,
      pendingVerification: pendingVerification.length,
      verifiedScholarships: verifiedScholarships.length,
      expiredScholarships: expiredScholarships.length,
      totalStudents: users.length,
      totalSaved: allSaved.length,
      totalApplications: applications.length,
      appStatusCounts,
      verificationBreakdown
    };
  },

  // ----------------------------------------------------
  // ADMIN USERS MANAGEMENT
  // ----------------------------------------------------
  getAdminUsers(): AdminUser[] {
    return read<AdminUser[]>(STORAGE_KEYS.ADMIN_USERS, []);
  },

  addAdminUser(adminData: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
    const list = this.getAdminUsers();
    const newAdmin: AdminUser = {
      ...adminData,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: undefined
    };
    const updated = [newAdmin, ...list];
    write(STORAGE_KEYS.ADMIN_USERS, updated);
    syncToSupabase('admin_users', newAdmin);
    return newAdmin;
  },

  deleteAdminUser(id: string): boolean {
    const list = this.getAdminUsers();
    const filtered = list.filter(a => a.id !== id);
    if (filtered.length === list.length) return false;
    write(STORAGE_KEYS.ADMIN_USERS, filtered);
    removeFromSupabase('admin_users', id);
    return true;
  },

  updateAdminUserStatus(id: string, status: AdminUser['status']): AdminUser | null {
    const list = this.getAdminUsers();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], status };
    write(STORAGE_KEYS.ADMIN_USERS, list);
    syncToSupabase('admin_users', list[idx]);
    return list[idx];
  }
};
