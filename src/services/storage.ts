import {
  Scholarship, Provider, Category, UserProfile, StoredDocument,
  Application, NotificationItem, VerificationRecord, SavedScholarship,
  VerificationStatus, ApplicationStatus, AdminUser, ScholarshipReport,
  ReportStatus, ReminderRecord, ReminderType, ApplicationChecklistItem,
  ApplicationStatusHistoryItem, ApplicationOutcomeDetails, ApplicationStatusSource
} from '../types';
import { syncToSupabase, removeFromSupabase, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';


const STORAGE_KEYS = {
  USERS: 'scholavon_users',
  ADMIN_USERS: 'scholavon_admin_users',
  SCHOLARSHIPS: 'scholavon_scholarships',
  PROVIDERS: 'scholavon_providers',
  CATEGORIES: 'scholavon_categories',
  APPLICATIONS: 'scholavon_applications',
  SAVED: 'scholavon_saved',
  DOCUMENTS: 'scholavon_documents',
  NOTIFICATIONS: 'scholavon_notifications',
  VERIFICATIONS: 'scholavon_verifications',
  REPORTS: 'scholavon_reports',
  REMINDERS: 'scholavon_reminders',
  CURRENT_USER_ID: 'scholavon_current_user_id',
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
  if (!localStorage.getItem(STORAGE_KEYS.REPORTS))       write(STORAGE_KEYS.REPORTS, []);
  if (!localStorage.getItem(STORAGE_KEYS.REMINDERS))     write(STORAGE_KEYS.REMINDERS, []);
}

// Ensure initialized on import
initializeStorage();


import { calculateProfileCompletion } from '../utils/formatters';
export { calculateProfileCompletion };

export const StorageService = {
  // --- USERS ---
  getUsers(): UserProfile[] {
    return read<UserProfile[]>(STORAGE_KEYS.USERS, []);
  },

  getUserById(id: string): UserProfile | null {
    const users = this.getUsers();
    return users.find(u => u.id === id) || null;
  },

  getUserByEmail(email: string): UserProfile | null {
    const trimmed = email.trim().toLowerCase();
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === trimmed) || null;
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
      adminEmail: adminEmail || 'admin@scholavon.org',
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
    this.cancelFutureRemindersForScholarship(id);
    return updated;
  },

  closeScholarship(id: string, adminId?: string, reason?: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const now = new Date().toISOString();
    const updated: Scholarship = {
      ...list[index],
      status: 'closed',
      manuallyClosed: true,
      manuallyClosedAt: now,
      verificationNotes: reason || list[index].verificationNotes,
      updatedAt: now
    };
    list[index] = updated;
    write(STORAGE_KEYS.SCHOLARSHIPS, list);
    syncToSupabase('scholarships', updated);
    this.cancelFutureRemindersForScholarship(id);
    return updated;
  },

  restoreScholarship(id: string): Scholarship {
    const list = this.getScholarships();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Scholarship not found');

    const now = new Date().toISOString();
    const current = list[index];

    // Recalculate status from deadline
    let restoredStatus: Scholarship['status'] = 'verified';
    if (current.deadline) {
      const deadline = new Date(current.deadline);
      if (!isNaN(deadline.getTime()) && deadline.getTime() < Date.now()) {
        restoredStatus = 'expired';
      }
    }
    // Preserve draft/rejected — don't upgrade those
    if (current.status === 'draft' || current.status === 'rejected') {
      restoredStatus = current.status;
    }

    const updated: Scholarship = {
      ...current,
      status: restoredStatus,
      manuallyClosed: false,
      manuallyClosedAt: undefined,
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
      adminEmail: adminEmail || 'admin@scholavon.org',
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

    const initialHistory: ApplicationStatusHistoryItem = {
      id: `hist-${generateUUID().slice(0, 8)}`,
      status,
      timestamp: new Date().toISOString(),
      notes: notes || (status === 'Preparing' ? 'Started application preparation' : `Application marked as ${status}`),
      source: 'student_updated'
    };

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
      statusHistory: [initialHistory],
      statusSource: 'student_updated',
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

    const currentApp = all[index];
    const now = new Date().toISOString();

    // Preserve and append status history if status changed
    let statusHistory = currentApp.statusHistory && currentApp.statusHistory.length > 0
      ? [...currentApp.statusHistory]
      : [
          {
            id: `hist-${generateUUID().slice(0, 8)}`,
            status: currentApp.status,
            timestamp: currentApp.createdAt || now,
            notes: currentApp.notes || 'Initial status',
            source: currentApp.statusSource || 'student_updated'
          }
        ];

    if (updates.status && updates.status !== currentApp.status) {
      statusHistory.push({
        id: `hist-${generateUUID().slice(0, 8)}`,
        status: updates.status,
        timestamp: now,
        notes: updates.notes || undefined,
        source: updates.statusSource || 'student_updated',
        metadata: updates.outcomeDetails ? { ...updates.outcomeDetails } : undefined
      });
    }

    const updated: Application = {
      ...currentApp,
      ...updates,
      statusHistory,
      updatedAt: now
    };

    if (updates.status === 'Applied' && !currentApp.appliedAt) {
      updated.appliedAt = now;
    }

    all[index] = updated;
    write(STORAGE_KEYS.APPLICATIONS, all);
    syncToSupabase('applications', updated);
    return updated;
  },

  updateApplicationStatus(
    id: string, 
    status: ApplicationStatus, 
    notes?: string,
    outcomeDetails?: ApplicationOutcomeDetails,
    source: ApplicationStatusSource = 'student_updated'
  ): Application {
    return this.updateApplication(id, {
      status,
      ...(outcomeDetails ? { outcomeDetails } : {}),
      ...(notes !== undefined ? { notes } : {}),
      statusSource: source
    });
  },

  recordApplicationOutcome(
    id: string,
    status: ApplicationStatus,
    outcomeDetails?: ApplicationOutcomeDetails,
    notes?: string,
    source: ApplicationStatusSource = 'student_updated'
  ): Application {
    return this.updateApplication(id, {
      status,
      outcomeDetails,
      ...(notes !== undefined ? { notes } : {}),
      statusSource: source
    });
  },

  getOrCreateApplication(userId: string, scholarship: Scholarship): Application {
    const all = this.getApplications();
    const existing = all.find(a => a.userId === userId && a.scholarshipId === scholarship.id);
    if (existing) return existing;
    return this.createApplication(userId, scholarship, 'Preparing');
  },

  toggleApplicationChecklistItem(applicationId: string, itemId: string): Application {
    const app = this.getApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    const updatedChecklist = (app.checklist || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    return this.updateApplication(applicationId, {
      checklist: updatedChecklist,
      workspaceLastSavedAt: new Date().toISOString()
    });
  },

  addApplicationChecklistItem(applicationId: string, label: string): Application {
    const app = this.getApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    const newItem: ApplicationChecklistItem = {
      id: `chk-custom-${generateUUID().slice(0, 8)}`,
      label,
      completed: false,
      required: false,
      custom: true
    };
    const updatedChecklist = [...(app.checklist || []), newItem];
    return this.updateApplication(applicationId, {
      checklist: updatedChecklist,
      workspaceLastSavedAt: new Date().toISOString()
    });
  },

  deleteApplicationChecklistItem(applicationId: string, itemId: string): Application {
    const app = this.getApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    const updatedChecklist = (app.checklist || []).filter(item => item.id !== itemId);
    return this.updateApplication(applicationId, {
      checklist: updatedChecklist,
      workspaceLastSavedAt: new Date().toISOString()
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

  // --- REMINDERS ---
  getReminders(userId?: string): ReminderRecord[] {
    const all = read<ReminderRecord[]>(STORAGE_KEYS.REMINDERS, []);
    if (userId) {
      return all.filter(r => r.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveReminder(reminder: ReminderRecord): ReminderRecord {
    const all = read<ReminderRecord[]>(STORAGE_KEYS.REMINDERS, []);
    const idx = all.findIndex(r => r.id === reminder.id);
    if (idx !== -1) {
      all[idx] = reminder;
    } else {
      all.unshift(reminder);
    }
    write(STORAGE_KEYS.REMINDERS, all);
    syncToSupabase('reminders', reminder);
    return reminder;
  },

  hasSentReminder(userId: string, scholarshipId: string, reminderType: ReminderType, deadlineAt: string): boolean {
    const all = read<ReminderRecord[]>(STORAGE_KEYS.REMINDERS, []);
    const normalizedDeadline = deadlineAt ? new Date(deadlineAt).toISOString().split('T')[0] : '';
    return all.some(r => 
      r.userId === userId &&
      r.scholarshipId === scholarshipId &&
      r.reminderType === reminderType &&
      r.status === 'sent' &&
      (r.deadlineAt ? new Date(r.deadlineAt).toISOString().split('T')[0] === normalizedDeadline : true)
    );
  },

  cancelFutureRemindersForScholarship(scholarshipId: string): void {
    const all = read<ReminderRecord[]>(STORAGE_KEYS.REMINDERS, []);
    let modified = false;
    all.forEach(r => {
      if (r.scholarshipId === scholarshipId && r.status === 'scheduled') {
        r.status = 'cancelled';
        modified = true;
        syncToSupabase('reminders', r);
      }
    });
    if (modified) {
      write(STORAGE_KEYS.REMINDERS, all);
    }
  },

  getReminderStats() {
    const all = read<ReminderRecord[]>(STORAGE_KEYS.REMINDERS, []);
    return {
      total: all.length,
      sent: all.filter(r => r.status === 'sent').length,
      scheduled: all.filter(r => r.status === 'scheduled').length,
      failed: all.filter(r => r.status === 'failed').length,
      cancelled: all.filter(r => r.status === 'cancelled').length,
    };
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
    const closedScholarships = scholarships.filter(s => s.status === 'closed' || s.manuallyClosed === true);

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
      closedScholarships: closedScholarships.length,
      totalStudents: users.length,
      totalSaved: allSaved.length,
      totalApplications: applications.length,
      appStatusCounts,
      verificationBreakdown
    };
  },

  // ----------------------------------------------------
  // ADMIN USERS MANAGEMENT (legacy localStorage — used only for display fallback)
  // The source of truth for admin role is public.users in Supabase.
  // These functions are kept for backward compatibility with other pages that
  // still call StorageService.getAdminUsers(), but they no longer inject
  // hardcoded mock admins.
  // ----------------------------------------------------
  getAdminUsers(): AdminUser[] {
    const fromAdminUsers = read<AdminUser[]>(STORAGE_KEYS.ADMIN_USERS, []);
    if (fromAdminUsers.length > 0) return fromAdminUsers;
    const users = this.getUsers();
    return users
      .filter(u => u.role === 'admin')
      .map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: 'Admin' as const,
        status: 'Active' as const,
        assignedDepartment: u.fieldOfStudy || 'Platform Operations',
        createdAt: u.createdAt,
      }));
  },

  addAdminUser(adminData: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
    const list = this.getAdminUsers();
    const newAdmin: AdminUser = {
      ...adminData,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      lastActiveAt: undefined
    };
    write(STORAGE_KEYS.ADMIN_USERS, [newAdmin, ...list]);
    return newAdmin;
  },

  deleteAdminUser(id: string): boolean {
    const list = this.getAdminUsers();
    const filtered = list.filter(a => a.id !== id);
    if (filtered.length === list.length) return false;
    write(STORAGE_KEYS.ADMIN_USERS, filtered);
    return true;
  },

  updateAdminUserStatus(id: string, status: AdminUser['status']): AdminUser | null {
    const list = this.getAdminUsers();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], status };
    write(STORAGE_KEYS.ADMIN_USERS, list);
    return list[idx];
  },

  // --- SCHOLARSHIP REPORTS ---
  getReports(): ScholarshipReport[] {
    return read<ScholarshipReport[]>(STORAGE_KEYS.REPORTS, []);
  },

  getUserReports(userId: string): ScholarshipReport[] {
    const all = this.getReports();
    return all.filter(r => r.reporterUserId === userId);
  },

  getScholarshipReports(scholarshipId: string): ScholarshipReport[] {
    const all = this.getReports();
    return all.filter(r => r.scholarshipId === scholarshipId);
  },

  hasActiveReport(userId: string, scholarshipId: string, reason: string): boolean {
    const all = this.getReports();
    return all.some(
      r => r.reporterUserId === userId &&
           r.scholarshipId === scholarshipId &&
           r.reason === reason &&
           (r.status === 'Pending' || r.status === 'Reviewing')
    );
  },

  createReport(reportData: Omit<ScholarshipReport, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ReportStatus }): ScholarshipReport {
    // Check duplicate
    if (this.hasActiveReport(reportData.reporterUserId, reportData.scholarshipId, reportData.reason)) {
      throw new Error("You've already reported this issue.");
    }

    const all = this.getReports();
    const newReport: ScholarshipReport = {
      ...reportData,
      id: generateUUID(),
      status: reportData.status || 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    all.unshift(newReport);
    write(STORAGE_KEYS.REPORTS, all);
    syncToSupabase('scholarship_reports', newReport);
    return newReport;
  },

  updateReportStatus(
    id: string,
    status: ReportStatus,
    adminNotes?: string,
    admin?: { id: string; name: string }
  ): ScholarshipReport | null {
    const all = this.getReports();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const current = all[idx];
    const isResolving = status === 'Resolved' || status === 'Dismissed';

    const updated: ScholarshipReport = {
      ...current,
      status,
      adminNotes: adminNotes !== undefined ? adminNotes : current.adminNotes,
      resolvedAt: isResolving ? new Date().toISOString() : current.resolvedAt,
      resolvedByAdminId: isResolving ? (admin?.id || current.resolvedByAdminId) : current.resolvedByAdminId,
      resolvedByAdminName: isResolving ? (admin?.name || current.resolvedByAdminName) : current.resolvedByAdminName,
      updatedAt: new Date().toISOString()
    };

    all[idx] = updated;
    write(STORAGE_KEYS.REPORTS, all);
    syncToSupabase('scholarship_reports', updated);
    return updated;
  },

  // --- AI PROMPT USAGE (FREE TIER LIMIT: 3 PROMPTS / MONTH) ---
  getMonthlyAiPromptUsage(userId: string): { used: number; limit: number; remaining: number } {
    const monthKey = new Date().toISOString().slice(0, 7);
    const key = `scholavon_ai_prompts_${userId}_${monthKey}`;
    const used = read<number>(key, 0);
    const limit = 3;
    const remaining = Math.max(0, limit - used);
    return { used, limit, remaining };
  },

  incrementMonthlyAiPromptUsage(userId: string): number {
    const monthKey = new Date().toISOString().slice(0, 7);
    const key = `scholavon_ai_prompts_${userId}_${monthKey}`;
    const current = read<number>(key, 0);
    const next = current + 1;
    write(key, next);
    return next;
  }
};
