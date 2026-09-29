import { Scholarship, UserProfile, ReminderRecord, ReminderType, NotificationItem } from '../types';
import { computeLifecycleStatus, parseScholarshipDate } from './scholarshipFilters';
import { StorageService } from './storage';
import { notificationService } from './notifications';
import { generateUUID } from '../lib/uuid';

export interface ProcessReminderOptions {
  userProfile?: UserProfile | null;
  currentDate?: Date;
  dryRun?: boolean;
}

export interface ReminderProcessResult {
  processedCount: number;
  sentCount: number;
  skippedCount: number;
  reminders: ReminderRecord[];
}

/**
 * Calculates calendar days remaining until deadline relative to currentDate.
 * Returns null if the deadline string is missing, invalid, or malformed.
 */
export function calculateDaysUntilDeadline(
  deadlineStr?: string | null,
  currentDate: Date = new Date()
): number | null {
  const deadline = parseScholarshipDate(deadlineStr);
  if (!deadline) return null;

  // Use midnight UTC comparison for strict day boundaries
  const deadlineUtc = Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const currentUtc = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const diffMs = deadlineUtc - currentUtc;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

/**
 * Maps the number of remaining days to the corresponding ReminderType.
 * Supported intervals: 7 days, 3 days, 1 day, and 0 (deadline day).
 */
export function getReminderTypeForDaysLeft(daysLeft: number): ReminderType | null {
  if (daysLeft === 7) return '7_day';
  if (daysLeft === 3) return '3_day';
  if (daysLeft === 1) return '1_day';
  if (daysLeft === 0) return 'deadline_day';
  return null;
}

/**
 * Maps a ReminderType back to daysLeft number for preference evaluation.
 */
export function getDaysForReminderType(type: ReminderType): number {
  switch (type) {
    case '7_day': return 7;
    case '3_day': return 3;
    case '1_day': return 1;
    case 'deadline_day': return 0;
  }
}

/**
 * Generates natural, helpful reminder title and message content.
 */
export function buildReminderMessage(
  scholarship: Scholarship,
  reminderType: ReminderType
): { title: string; body: string } {
  switch (reminderType) {
    case '7_day':
      return {
        title: '⏰ Deadline in 7 days',
        body: `${scholarship.title} closes in 7 days. You still have time to complete your application.`,
      };
    case '3_day':
      return {
        title: '⏰ Deadline in 3 days',
        body: `${scholarship.title} closes in 3 days. Make sure your required documents are ready.`,
      };
    case '1_day':
      return {
        title: '🚨 Deadline tomorrow',
        body: `${scholarship.title} closes tomorrow. Complete your application before the deadline.`,
      };
    case 'deadline_day':
      return {
        title: '🚨 Deadline today',
        body: `${scholarship.title} closes today. If you plan to apply, submit before the deadline.`,
      };
  }
}

/**
 * Determines whether a scholarship is eligible to generate reminders:
 * 1. Must NOT be 'closed' or 'archived' in lifecycle
 * 2. Must have a valid deadline
 * 3. Must not have already passed relative to currentDate
 */
export function isScholarshipEligibleForReminders(
  scholarship: Scholarship,
  currentDate: Date = new Date()
): boolean {
  if (!scholarship || !scholarship.deadline) return false;

  const parsed = parseScholarshipDate(scholarship.deadline);
  if (!parsed) return false;

  const lifecycle = computeLifecycleStatus(scholarship, currentDate);
  if (lifecycle === 'closed' || lifecycle === 'archived') {
    return false;
  }

  const daysLeft = calculateDaysUntilDeadline(scholarship.deadline, currentDate);
  if (daysLeft === null || daysLeft < 0) {
    return false;
  }

  return true;
}

/**
 * Collects all scholarships relevant to a student through:
 * 1. Saved Scholarships (bookmarks)
 * 2. Application Tracker records
 */
export function getEligibleScholarshipsForStudent(
  userId: string,
  allScholarships: Scholarship[]
): Scholarship[] {
  const savedIds = StorageService.getSavedScholarshipIds(userId);
  const userApplications = StorageService.getApplications(userId);
  const appScholarshipIds = userApplications.map(a => a.scholarshipId);

  const relevantIds = new Set<string>([...savedIds, ...appScholarshipIds]);

  return allScholarships.filter(s => relevantIds.has(s.id));
}

/**
 * Checks if a specific reminder interval is enabled in user preferences.
 * Default intervals: [7, 3, 1, 0] (all enabled).
 */
export function isReminderTypeEnabledForUser(
  userProfile: UserProfile,
  reminderType: ReminderType
): boolean {
  const prefs = userProfile.notificationPreferences;
  if (!prefs) return true; // default all enabled

  if (prefs.deadlineAlerts === false) {
    return false;
  }

  const targetDay = getDaysForReminderType(reminderType);
  const enabledDays = prefs.deadlineDays ?? [7, 3, 1, 0];

  return enabledDays.includes(targetDay);
}

/**
 * Centralized reminder processor.
 * Determines due reminders, enforces idempotency, dispatches notifications, and saves audit logs.
 */
export async function processDueScholarshipReminders(
  options: ProcessReminderOptions = {}
): Promise<ReminderProcessResult> {
  const currentDate = options.currentDate || new Date();
  const dryRun = options.dryRun || false;

  const allScholarships = StorageService.getScholarships();
  const usersToProcess: UserProfile[] = options.userProfile
    ? [options.userProfile]
    : StorageService.getUsers().filter(u => u.role === 'student');

  let processedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  const createdReminders: ReminderRecord[] = [];

  for (const user of usersToProcess) {
    const relevantScholarships = getEligibleScholarshipsForStudent(user.id, allScholarships);

    for (const scholarship of relevantScholarships) {
      processedCount++;

      // 1. Verify scholarship lifecycle eligibility
      if (!isScholarshipEligibleForReminders(scholarship, currentDate)) {
        skippedCount++;
        continue;
      }

      // 2. Calculate remaining days
      const daysLeft = calculateDaysUntilDeadline(scholarship.deadline, currentDate);
      if (daysLeft === null) {
        skippedCount++;
        continue;
      }

      // 3. Match against core reminder intervals (7, 3, 1, 0)
      const reminderType = getReminderTypeForDaysLeft(daysLeft);
      if (!reminderType) {
        skippedCount++;
        continue;
      }

      // 4. Verify user preferences
      if (!isReminderTypeEnabledForUser(user, reminderType)) {
        skippedCount++;
        continue;
      }

      // 5. Idempotency Check: Has this reminder type for this deadline already been sent?
      const alreadySent = StorageService.hasSentReminder(
        user.id,
        scholarship.id,
        reminderType,
        scholarship.deadline
      );

      if (alreadySent) {
        skippedCount++;
        continue;
      }

      // 6. Build content and dispatch
      const { title, body } = buildReminderMessage(scholarship, reminderType);
      const reminderId = `rem-${generateUUID()}`;
      const nowIso = new Date().toISOString();

      const reminderRecord: ReminderRecord = {
        id: reminderId,
        userId: user.id,
        scholarshipId: scholarship.id,
        scholarshipTitle: scholarship.title,
        reminderType,
        deadlineAt: scholarship.deadline,
        scheduledFor: currentDate.toISOString(),
        sentAt: nowIso,
        channel: 'inApp',
        status: 'sent',
        createdAt: nowIso,
      };

      if (!dryRun) {
        // Record in-app notification
        const notificationItem: NotificationItem = {
          id: generateUUID(),
          userId: user.id,
          title,
          message: body,
          body,
          type: 'deadline_alert',
          read: false,
          link: `/scholarships/${scholarship.id}`,
          relatedScholarshipId: scholarship.id,
          createdAt: nowIso,
        };

        // Dispatch via NotificationService
        await notificationService.dispatch(
          {
            userId: user.id,
            title,
            message: body,
            type: 'deadline_alert',
            relatedScholarshipId: scholarship.id,
          },
          user,
          (item) => StorageService.createNotification(item)
        );

        // Save reminder log for idempotency tracking
        StorageService.saveReminder(reminderRecord);
      }

      sentCount++;
      createdReminders.push(reminderRecord);
    }
  }

  return {
    processedCount,
    sentCount,
    skippedCount,
    reminders: createdReminders,
  };
}

/**
 * Returns sorted upcoming deadlines for student dashboard, strictly excluding closed/archived opportunities.
 */
export function getUpcomingDeadlinesForStudent(
  userId: string,
  scholarships: Scholarship[],
  limit = 5,
  currentDate: Date = new Date()
): Scholarship[] {
  const eligible = getEligibleScholarshipsForStudent(userId, scholarships);
  return eligible
    .filter(s => isScholarshipEligibleForReminders(s, currentDate))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, limit);
}
