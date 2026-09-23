import fs from 'fs';
import path from 'path';
import {
  UserRecord,
  StudentProfileRecord,
  ProviderRecord,
  CategoryRecord,
  ScholarshipRecord,
  ApplicationRecord,
  SavedScholarshipRecord,
  StoredDocumentRecord,
  NotificationRecord,
  VerificationLogRecord,
  AdminUserRecord,
} from '../types';
import {
  SEED_CATEGORIES,
  SEED_PROVIDERS,
  SEED_SCHOLARSHIPS,
  createInitialSeedUsers,
} from './seed';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export interface DatabaseState {
  users: Record<string, UserRecord>;
  profiles: Record<string, StudentProfileRecord>;
  providers: Record<string, ProviderRecord>;
  categories: Record<string, CategoryRecord>;
  scholarships: Record<string, ScholarshipRecord>;
  applications: Record<string, ApplicationRecord>;
  saved: Record<string, SavedScholarshipRecord>;
  documents: Record<string, StoredDocumentRecord>;
  notifications: Record<string, NotificationRecord>;
  verifications: Record<string, VerificationLogRecord>;
  adminUsers: Record<string, AdminUserRecord>;
}

class Store {
  private state: DatabaseState = {
    users: {},
    profiles: {},
    providers: {},
    categories: {},
    scholarships: {},
    applications: {},
    saved: {},
    documents: {},
    notifications: {},
    verifications: {},
    adminUsers: {},
  };

  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw);
        if (!this.state.scholarships || Object.keys(this.state.scholarships).length === 0) {
          await this.seed();
          this.save();
        }
        this.initialized = true;
        return;
      } catch (err) {
        console.warn('Failed to parse existing db.json, reseeding database:', err);
      }
    }

    // Seed database
    await this.seed();
    this.save();
    this.initialized = true;
  }

  private async seed(): Promise<void> {
    SEED_CATEGORIES.forEach((c) => {
      this.state.categories[c.id] = c;
    });

    SEED_PROVIDERS.forEach((p) => {
      this.state.providers[p.id] = p;
    });

    SEED_SCHOLARSHIPS.forEach((s) => {
      this.state.scholarships[s.id] = s;
    });

    const { adminUser, adminUser2, demoStudent, demoProfile, adminDirectoryUser, adminDirectoryUser2 } = await createInitialSeedUsers();
    this.state.users[adminUser.id] = adminUser;
    this.state.users[adminUser2.id] = adminUser2;
    this.state.users[demoStudent.id] = demoStudent;
    this.state.profiles[demoProfile.userId] = demoProfile;
    this.state.adminUsers[adminDirectoryUser.id] = adminDirectoryUser;
    this.state.adminUsers[adminDirectoryUser2.id] = adminDirectoryUser2;
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  // --- USERS ---
  public findUserById(id: string): UserRecord | undefined {
    return this.state.users[id];
  }

  public findUserByEmail(email: string): UserRecord | undefined {
    const norm = email.toLowerCase().trim();
    return Object.values(this.state.users).find((u) => u.email.toLowerCase() === norm);
  }

  public createUser(user: UserRecord): UserRecord {
    this.state.users[user.id] = user;
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const existing = this.state.users[id];
    if (!existing) return undefined;
    this.state.users[id] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.users[id];
  }

  // --- PROFILES ---
  public getProfile(userId: string): StudentProfileRecord | undefined {
    return this.state.profiles[userId];
  }

  public upsertProfile(profile: StudentProfileRecord): StudentProfileRecord {
    profile.profileCompletion = this.calculateProfileCompletion(profile);
    profile.updatedAt = new Date().toISOString();
    this.state.profiles[profile.userId] = profile;
    this.save();
    return profile;
  }

  public calculateProfileCompletion(profile: Partial<StudentProfileRecord>): number {
    let score = 0;
    if (profile.firstName && profile.lastName) score += 10;
    if (profile.country) score += 10;
    if (profile.dateOfBirth) score += 5;
    if (profile.educationLevel) score += 15;
    if (profile.institution) score += 10;
    if (profile.fieldOfStudy) score += 15;
    if (profile.gpa && profile.gpa > 0) score += 15;
    if (profile.awards && profile.awards.length > 0) score += 5;
    if (profile.certifications && profile.certifications.length > 0) score += 5;
    if (profile.extracurriculars && profile.extracurriculars.length > 0) score += 5;
    if (profile.workExperience && profile.workExperience.length > 0) score += 5;
    return Math.min(100, score);
  }

  // --- CATEGORIES ---
  public getCategories(): CategoryRecord[] {
    const list = Object.values(this.state.categories);
    const countMap: Record<string, number> = {};
    Object.values(this.state.scholarships).forEach((s) => {
      countMap[s.category] = (countMap[s.category] || 0) + 1;
    });

    return list.map((c) => ({
      ...c,
      scholarshipCount: countMap[c.name] || 0,
    }));
  }

  public findCategoryById(id: string): CategoryRecord | undefined {
    return this.state.categories[id];
  }

  // --- PROVIDERS ---
  public getProviders(): ProviderRecord[] {
    return Object.values(this.state.providers);
  }

  public findProviderById(id: string): ProviderRecord | undefined {
    return this.state.providers[id];
  }

  public createProvider(provider: ProviderRecord): ProviderRecord {
    this.state.providers[provider.id] = provider;
    this.save();
    return provider;
  }

  public updateProvider(id: string, updates: Partial<ProviderRecord>): ProviderRecord | undefined {
    const existing = this.state.providers[id];
    if (!existing) return undefined;
    this.state.providers[id] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.providers[id];
  }

  // --- SCHOLARSHIPS ---
  public getScholarships(): ScholarshipRecord[] {
    return Object.values(this.state.scholarships);
  }

  public findScholarshipById(id: string): ScholarshipRecord | undefined {
    return this.state.scholarships[id];
  }

  public createScholarship(scholarship: ScholarshipRecord): ScholarshipRecord {
    this.state.scholarships[scholarship.id] = scholarship;
    this.save();
    return scholarship;
  }

  public updateScholarship(id: string, updates: Partial<ScholarshipRecord>): ScholarshipRecord | undefined {
    const existing = this.state.scholarships[id];
    if (!existing) return undefined;
    this.state.scholarships[id] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.scholarships[id];
  }

  public deleteScholarship(id: string): boolean {
    if (!this.state.scholarships[id]) return false;
    delete this.state.scholarships[id];
    this.save();
    return true;
  }

  // --- APPLICATIONS ---
  public getApplicationsByUser(userId: string): ApplicationRecord[] {
    return Object.values(this.state.applications).filter((a) => a.userId === userId);
  }

  public getAllApplications(): ApplicationRecord[] {
    return Object.values(this.state.applications);
  }

  public findApplicationById(id: string): ApplicationRecord | undefined {
    return this.state.applications[id];
  }

  public createApplication(app: ApplicationRecord): ApplicationRecord {
    this.state.applications[app.id] = app;
    this.save();
    return app;
  }

  public updateApplication(id: string, updates: Partial<ApplicationRecord>): ApplicationRecord | undefined {
    const existing = this.state.applications[id];
    if (!existing) return undefined;
    this.state.applications[id] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.state.applications[id];
  }

  public deleteApplication(id: string): boolean {
    if (!this.state.applications[id]) return false;
    delete this.state.applications[id];
    this.save();
    return true;
  }

  // --- SAVED / BOOKMARKS ---
  public getSavedIdsByUser(userId: string): string[] {
    return Object.values(this.state.saved)
      .filter((s) => s.userId === userId)
      .map((s) => s.scholarshipId);
  }

  public toggleSaved(userId: string, scholarshipId: string): { saved: boolean; ids: string[] } {
    const key = `${userId}-${scholarshipId}`;
    let isSaved = false;
    if (this.state.saved[key]) {
      delete this.state.saved[key];
      isSaved = false;
      // Decrement scholarship saveCount
      if (this.state.scholarships[scholarshipId]) {
        this.state.scholarships[scholarshipId].saveCount = Math.max(0, (this.state.scholarships[scholarshipId].saveCount || 1) - 1);
      }
    } else {
      this.state.saved[key] = {
        id: key,
        userId,
        scholarshipId,
        savedAt: new Date().toISOString(),
      };
      isSaved = true;
      // Increment scholarship saveCount
      if (this.state.scholarships[scholarshipId]) {
        this.state.scholarships[scholarshipId].saveCount = (this.state.scholarships[scholarshipId].saveCount || 0) + 1;
      }
    }
    this.save();
    return { saved: isSaved, ids: this.getSavedIdsByUser(userId) };
  }

  // --- DOCUMENTS ---
  public getDocumentsByUser(userId: string): StoredDocumentRecord[] {
    return Object.values(this.state.documents).filter((d) => d.userId === userId);
  }

  public findDocumentById(id: string): StoredDocumentRecord | undefined {
    return this.state.documents[id];
  }

  public createDocument(doc: StoredDocumentRecord): StoredDocumentRecord {
    this.state.documents[doc.id] = doc;
    this.save();
    return doc;
  }

  public deleteDocument(id: string): boolean {
    if (!this.state.documents[id]) return false;
    delete this.state.documents[id];
    this.save();
    return true;
  }

  // --- NOTIFICATIONS ---
  public getNotificationsByUser(userId: string): NotificationRecord[] {
    return Object.values(this.state.notifications)
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createNotification(n: NotificationRecord): NotificationRecord {
    this.state.notifications[n.id] = n;
    this.save();
    return n;
  }

  public markNotificationRead(id: string): boolean {
    if (!this.state.notifications[id]) return false;
    this.state.notifications[id].read = true;
    this.save();
    return true;
  }

  // --- VERIFICATION AUDIT LOGS ---
  public getVerificationLogs(): VerificationLogRecord[] {
    return Object.values(this.state.verifications).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public createVerificationLog(log: VerificationLogRecord): VerificationLogRecord {
    this.state.verifications[log.id] = log;
    this.save();
    return log;
  }

  // --- ADMIN USERS DIRECTORY ---
  public getAdminUsers(): AdminUserRecord[] {
    return Object.values(this.state.adminUsers);
  }

  public createAdminUser(admin: AdminUserRecord): AdminUserRecord {
    this.state.adminUsers[admin.id] = admin;
    this.save();
    return admin;
  }

  public deleteAdminUser(id: string): boolean {
    if (!this.state.adminUsers[id]) return false;
    delete this.state.adminUsers[id];
    this.save();
    return true;
  }

  public getAllStudentProfiles(): StudentProfileRecord[] {
    return Object.values(this.state.profiles);
  }
}

export const db = new Store();
