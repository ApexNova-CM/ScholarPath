import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/store';
import { config } from '../config';
import { emailService } from './emailService';
import { isStagingPlusOverrideActive } from '../utils/stagingGuard';
import { ReminderRecord, NotificationRecord, SubscriptionStatus } from '../types';

export interface ProcessUserRemindersResult {
  userId: string;
  processedCount: number;
  sentCount: number;
  inAppCount: number;
  emailCount: number;
  reminders: ReminderRecord[];
  skippedReason?: string;
  errors: string[];
}

export interface SchedulerRunResult {
  runAt: string;
  simulatedDate: string;
  totalStudents: number;
  processedStudents: number;
  sentInAppCount: number;
  sentEmailCount: number;
  skippedCount: number;
  errors: string[];
  durationMs: number;
}

// Concurrency mutex flag
let isSchedulerRunning = false;

// Active timer handle
let activeSchedulerTimer: NodeJS.Timeout | null = null;
let isSchedulerEnabled = false;

/**
 * Authoritative subscription status check from Supabase (or flat file fallback).
 */
export async function getUserSubscriptionStatus(userId: string, userEmail?: string): Promise<SubscriptionStatus> {
  // Check staging-only test override with strict fail-closed safety guards
  if (isStagingPlusOverrideActive(userId, userEmail)) {
    return 'premium';
  }

  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await supabase
        .from('users')
        .select('email, subscription_status')
        .eq('id', userId)
        .maybeSingle();

      // Second check with database-verified email if email wasn't passed initially
      if (data?.email && isStagingPlusOverrideActive(userId, data.email)) {
        return 'premium';
      }

      if (data?.subscription_status === 'premium') {
        return 'premium';
      }
      if (data?.subscription_status === 'past_due' || data?.subscription_status === 'cancelled') {
        return data.subscription_status as SubscriptionStatus;
      }
    } catch (err) {
      console.warn('[reminderScheduler] subscription status check warning:', err);
    }
  }

  const user = db.findUserById(userId);
  return (user as any)?.subscriptionStatus || 'free';
}

/**
 * Calculates milliseconds until next occurrence of target UTC hour (default 08:00 UTC).
 * If target hour has already passed today, schedules for tomorrow at target hour.
 */
export function getMsUntilNextTargetUtcHour(targetHourUtc: number = 8, fromDate: Date = new Date()): number {
  const nextTarget = new Date(fromDate.getTime());
  nextTarget.setUTCHours(targetHourUtc, 0, 0, 0);

  if (nextTarget.getTime() <= fromDate.getTime()) {
    nextTarget.setUTCDate(nextTarget.getUTCDate() + 1);
  }

  return nextTarget.getTime() - fromDate.getTime();
}

/**
 * Processes due deadline reminders for a single student.
 * Reusable by both the manual/dashboard endpoint and the automated scheduler.
 */
export async function processDueRemindersForUser(
  userId: string,
  currentDateInput?: Date
): Promise<ProcessUserRemindersResult> {
  const errors: string[] = [];
  const generatedReminders: ReminderRecord[] = [];

  const profile = db.getProfile(userId);
  const studentUser = db.findUserById(userId);
  const userEmail = studentUser?.email || profile?.email;
  const subStatus = await getUserSubscriptionStatus(userId, userEmail);

  const savedIds = db.getSavedIdsByUser(userId);
  const applications = db.getApplicationsByUser(userId);
  const appSchIds = applications.map((a) => a.scholarshipId);
  const relevantIds = new Set([...savedIds, ...appSchIds]);

  const allScholarships = db.getScholarships();
  const currentDate = currentDateInput ? new Date(currentDateInput) : new Date();

  // Deadline alerts global preference check
  const deadlineAlertsEnabled = profile?.notificationPreferences?.deadlineAlerts !== false;
  if (!deadlineAlertsEnabled) {
    return {
      userId,
      processedCount: relevantIds.size,
      sentCount: 0,
      inAppCount: 0,
      emailCount: 0,
      reminders: [],
      skippedReason: 'deadline_alerts_disabled',
      errors: [],
    };
  }

  // Free users receive standard 7-day and 1-day reminders.
  // Plus users receive full intervals (30d, 14d, 7d, 3d, 1d, 0d) or customized deadlineDays.
  const allowedIntervals: number[] =
    subStatus === 'premium'
      ? (profile?.notificationPreferences?.deadlineDays ?? [30, 14, 7, 3, 1, 0])
      : [7, 1];

  let inAppCount = 0;
  let emailCount = 0;

  for (const sch of allScholarships) {
    if (!relevantIds.has(sch.id)) continue;
    if (sch.status === 'archived' || sch.status === 'closed' || sch.manuallyClosed) continue;
    if (!sch.deadline) continue;

    // Suppress reminders for completed / concluded applications
    const existingApp = applications.find((a) => a.scholarshipId === sch.id);
    if (
      existingApp &&
      ['Applied', 'Successful', 'Awarded', 'Unsuccessful', 'Withdrawn', 'Not Selected'].includes(
        existingApp.status
      )
    ) {
      continue;
    }

    const deadline = new Date(sch.deadline);
    if (isNaN(deadline.getTime())) continue;

    // Normalize to UTC calendar date midnight to prevent timezone hour drift
    const deadlineUtc = Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const currentUtc = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const daysLeft = Math.round((deadlineUtc - currentUtc) / (1000 * 60 * 60 * 24));

    // Suppress expired opportunities
    if (daysLeft < 0) continue;

    let reminderType: '30_day' | '14_day' | '7_day' | '3_day' | '1_day' | 'deadline_day' | null = null;
    if (daysLeft === 30 && allowedIntervals.includes(30)) reminderType = '30_day';
    else if (daysLeft === 14 && allowedIntervals.includes(14)) reminderType = '14_day';
    else if (daysLeft === 7 && allowedIntervals.includes(7)) reminderType = '7_day';
    else if (daysLeft === 3 && allowedIntervals.includes(3)) reminderType = '3_day';
    else if (daysLeft === 1 && allowedIntervals.includes(1)) reminderType = '1_day';
    else if (daysLeft === 0 && allowedIntervals.includes(0)) reminderType = 'deadline_day';

    if (!reminderType) continue;

    // Deduplication check
    const alreadySent = db.hasSentReminder(userId, sch.id, reminderType, sch.deadline);
    if (alreadySent) continue;

    const titleMap: Record<string, string> = {
      '30_day': '⏰ Deadline in 30 days',
      '14_day': '⏰ Deadline in 14 days',
      '7_day': '⏰ Deadline in 7 days',
      '3_day': '⏰ Deadline in 3 days',
      '1_day': '🚨 Deadline tomorrow',
      'deadline_day': '🚨 Deadline today',
    };
    const bodyMap: Record<string, string> = {
      '30_day': `${sch.title} closes in 30 days. Begin preparing your required application materials.`,
      '14_day': `${sch.title} closes in 14 days. Review your essays and request recommendations.`,
      '7_day': `${sch.title} closes in 7 days. You still have time to complete your application.`,
      '3_day': `${sch.title} closes in 3 days. Make sure your required documents are ready.`,
      '1_day': `${sch.title} closes tomorrow. Complete your application before the deadline.`,
      'deadline_day': `${sch.title} closes today. If you plan to apply, submit before the deadline.`,
    };

    const remId = `rem-${crypto.randomUUID()}`;
    const notifId = `notif-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const reminderRecord: ReminderRecord = {
      id: remId,
      userId,
      scholarshipId: sch.id,
      scholarshipTitle: sch.title,
      reminderType,
      deadlineAt: sch.deadline,
      scheduledFor: currentDate.toISOString(),
      sentAt: nowIso,
      channel: 'inApp',
      status: 'sent',
      createdAt: nowIso,
    };

    db.createReminder(reminderRecord);
    inAppCount++;

    const notifRecord: NotificationRecord = {
      id: notifId,
      userId,
      title: titleMap[reminderType] || '⏰ Scholarship Reminder',
      message: bodyMap[reminderType] || `${sch.title} deadline is approaching.`,
      body: bodyMap[reminderType] || `${sch.title} deadline is approaching.`,
      type: 'deadline_alert',
      read: false,
      link: `/scholarships/${sch.id}`,
      relatedScholarshipId: sch.id,
      createdAt: nowIso,
    };
    db.createNotification(notifRecord);

    // Email reminder dispatch (if student opted in)
    const emailNotificationsEnabled = profile?.notificationPreferences?.email !== false;
    if (emailNotificationsEnabled && userEmail) {
      try {
        await emailService.sendDeadlineReminder(
          userEmail,
          profile?.firstName || 'Student',
          sch.title,
          daysLeft,
          sch.deadline,
          sch.id,
          existingApp?.id,
          reminderType
        );
        emailCount++;
      } catch (err: any) {
        // Safe error logging: do not expose email, token or secret
        const safeError = `Failed to send deadline email for scholarship ${sch.id.slice(0, 8)}...: ${err?.message || 'unknown error'}`;
        errors.push(safeError);
      }
    }

    generatedReminders.push(reminderRecord);
  }

  return {
    userId,
    processedCount: relevantIds.size,
    sentCount: generatedReminders.length,
    inAppCount,
    emailCount,
    reminders: generatedReminders,
    errors,
  };
}

/**
 * Iterates through all eligible students and executes reminder processing.
 * Protected by concurrency mutex lock to prevent overlapping runs.
 */
export async function processAllStudentReminders(currentDateInput?: Date): Promise<SchedulerRunResult> {
  const startTime = Date.now();
  const simulatedDate = currentDateInput ? new Date(currentDateInput) : new Date();
  const runAt = new Date().toISOString();

  if (isSchedulerRunning) {
    const errorMsg = 'Scheduler run already in progress (concurrency lock held). Overlapping execution prevented.';
    console.warn(`[reminderScheduler] ${errorMsg}`);
    return {
      runAt,
      simulatedDate: simulatedDate.toISOString(),
      totalStudents: 0,
      processedStudents: 0,
      sentInAppCount: 0,
      sentEmailCount: 0,
      skippedCount: 0,
      errors: [errorMsg],
      durationMs: Date.now() - startTime,
    };
  }

  isSchedulerRunning = true;

  try {
    // Gather all distinct student IDs from users and profiles
    const studentUserIds = new Set<string>();
    const allUsers = db.getAllUsers();
    allUsers.forEach((u) => {
      if (u.role === 'student') {
        studentUserIds.add(u.id);
      }
    });

    const allProfiles = db.getAllStudentProfiles();
    allProfiles.forEach((p) => {
      studentUserIds.add(p.userId);
    });

    const studentList = Array.from(studentUserIds);
    let processedStudents = 0;
    let sentInAppCount = 0;
    let sentEmailCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const studentId of studentList) {
      try {
        const result = await processDueRemindersForUser(studentId, simulatedDate);
        processedStudents++;
        sentInAppCount += result.inAppCount;
        sentEmailCount += result.emailCount;
        if (result.skippedReason) {
          skippedCount++;
        }
        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }
      } catch (err: any) {
        // Individual student error must not crash the batch or stop subsequent students
        const safeError = `Error processing reminders for student id ${studentId.slice(0, 8)}...: ${err?.message || 'unknown error'}`;
        console.error(`[reminderScheduler] ${safeError}`);
        errors.push(safeError);
      }
    }

    const durationMs = Date.now() - startTime;

    // Operational summary log (safe, zero secrets)
    console.log(
      `[reminderScheduler] Daily run completed at ${runAt}: ` +
        `${studentList.length} total students, ${processedStudents} processed, ` +
        `${sentInAppCount} in-app alerts, ${sentEmailCount} emails dispatched, ` +
        `${skippedCount} skipped, ${errors.length} errors, duration ${durationMs}ms.`
    );

    return {
      runAt,
      simulatedDate: simulatedDate.toISOString(),
      totalStudents: studentList.length,
      processedStudents,
      sentInAppCount,
      sentEmailCount,
      skippedCount,
      errors,
      durationMs,
    };
  } finally {
    isSchedulerRunning = false;
  }
}

/**
 * Arm the automated daily deadline scheduler.
 * Runs once daily at target UTC hour (default 08:00 UTC).
 */
export function startReminderScheduler(options?: { targetHourUtc?: number; runImmediately?: boolean }): void {
  if (isSchedulerEnabled) {
    console.log('[reminderScheduler] Scheduler already running.');
    return;
  }

  isSchedulerEnabled = true;
  const targetHour = options?.targetHourUtc ?? 8;

  const scheduleNext = () => {
    if (!isSchedulerEnabled) return;

    const msUntilRun = getMsUntilNextTargetUtcHour(targetHour);
    const nextRunDate = new Date(Date.now() + msUntilRun);

    console.log(
      `[reminderScheduler] Next daily reminder run scheduled for ${nextRunDate.toISOString()} ` +
        `(${Math.round(msUntilRun / (1000 * 60))} minutes from now).`
    );

    activeSchedulerTimer = setTimeout(async () => {
      try {
        await processAllStudentReminders();
      } catch (err) {
        console.error('[reminderScheduler] Unexpected error during scheduled run:', err);
      } finally {
        scheduleNext();
      }
    }, msUntilRun);

    // Unref timer so it doesn't hold open process if server is terminating
    if (typeof activeSchedulerTimer?.unref === 'function') {
      activeSchedulerTimer.unref();
    }
  };

  if (options?.runImmediately) {
    processAllStudentReminders().catch((err) => {
      console.error('[reminderScheduler] Error during immediate scheduler run:', err);
    });
  }

  scheduleNext();
}

/**
 * Disarm and stop the reminder scheduler for graceful shutdown.
 */
export function stopReminderScheduler(): void {
  isSchedulerEnabled = false;
  if (activeSchedulerTimer) {
    clearTimeout(activeSchedulerTimer);
    activeSchedulerTimer = null;
  }
  console.log('[reminderScheduler] Scheduler stopped cleanly.');
}

/**
 * Check if the scheduler is currently enabled.
 */
export function isReminderSchedulerActive(): boolean {
  return isSchedulerEnabled;
}
