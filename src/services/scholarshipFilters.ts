import { Scholarship, LifecycleStatus } from '../types';
import { isDeadlinePassed, parseScholarshipDate } from '../utils/formatters';

export type ScholarshipFilterStatus = 'all' | 'active' | 'upcoming' | 'expired' | 'closing_soon' | 'closed' | 'archived' | 'open';

export { parseScholarshipDate };

/** Number of days before the deadline that a scholarship is considered "Closing Soon" */
export const CLOSING_SOON_DAYS = 7;

/**
 * Determines whether a scholarship is closed or expired.
 * True when:
 * 1. Administrator marked status as 'closed', 'expired', 'archived', or manuallyClosed === true.
 * 2. Application deadline has passed (respecting end of day boundary for date-only formats).
 */
export function isScholarshipExpired(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (!scholarship) return false;
  if (scholarship.status === 'expired' || scholarship.status === 'closed' || scholarship.status === 'archived') return true;
  if (scholarship.manuallyClosed === true) return true;
  return isDeadlinePassed(scholarship.deadline, currentDate);
}

export const isScholarshipClosed = isScholarshipExpired;

/**
 * Determines whether a scholarship is upcoming (applications not yet open).
 */
export function isScholarshipUpcoming(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (isScholarshipExpired(scholarship, currentDate)) return false;
  const opening = parseScholarshipDate(scholarship.openingDate);
  if (opening && opening.getTime() > currentDate.getTime()) {
    return true;
  }
  return false;
}

/**
 * Determines whether a scholarship is currently active / open for applications.
 */
export function isScholarshipActive(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (!scholarship) return false;
  if (isScholarshipExpired(scholarship, currentDate)) return false;
  if (isScholarshipUpcoming(scholarship, currentDate)) return false;
  if (
    scholarship.status === 'archived' ||
    scholarship.status === 'rejected' ||
    scholarship.status === 'draft' ||
    scholarship.status === 'pending_verification' ||
    (scholarship.status as string) === 'pending' ||
    scholarship.verificationStatus === 'pending_verification' ||
    scholarship.verificationStatus === 'rejected' ||
    (scholarship.verificationStatus as string) === 'pending'
  ) {
    return false;
  }
  return true;
}

export const isScholarshipOpen = isScholarshipActive;

/**
 * Determines whether an open scholarship is closing within CLOSING_SOON_DAYS (7 days).
 */
export function isScholarshipClosingSoon(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (!isScholarshipActive(scholarship, currentDate)) return false;
  const deadline = parseScholarshipDate(scholarship.deadline);
  if (!deadline) return false;

  let targetTime = deadline.getTime();
  if (scholarship.deadline && scholarship.deadline.trim().length <= 10) {
    targetTime = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999).getTime();
  }

  const msLeft = targetTime - currentDate.getTime();
  if (msLeft < 0) return false;
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  return daysLeft <= CLOSING_SOON_DAYS;
}

/**
 * Computes the display lifecycle status of a scholarship.
 * Precedence (highest first):
 *   1. archived  → 'archived'
 *   2. manuallyClosed or status in ('closed', 'expired') or deadline passed → 'closed'
 *   3. Deadline within CLOSING_SOON_DAYS → 'closing_soon'
 *   4. Otherwise → 'active' (Open)
 */
export function computeLifecycleStatus(
  scholarship: Scholarship,
  currentDate: Date = new Date()
): LifecycleStatus {
  if (!scholarship) return 'active';
  if (scholarship.status === 'archived') return 'archived';
  if (isScholarshipExpired(scholarship, currentDate)) return 'closed';
  if (isScholarshipClosingSoon(scholarship, currentDate)) return 'closing_soon';
  return 'active';
}

/**
 * Returns Tailwind CSS classes for a lifecycle status badge.
 */
export function getLifecycleBadgeStyle(status: LifecycleStatus): {
  bg: string; text: string; border: string; label: string; animate?: string;
} {
  switch (status) {
    case 'active':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Open' };
    case 'closing_soon':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', label: 'Closing Soon', animate: 'animate-pulse' };
    case 'closed':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Closed' };
    case 'archived':
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: 'Archived' };
  }
}

/**
 * Resolves the primary deadline status of a scholarship (legacy — kept for backwards compat).
 */
export function getScholarshipLifecycleStatus(
  scholarship: Scholarship, 
  currentDate: Date = new Date()
): 'active' | 'upcoming' | 'expired' {
  if (isScholarshipExpired(scholarship, currentDate)) return 'expired';
  if (isScholarshipUpcoming(scholarship, currentDate)) return 'upcoming';
  return 'active';
}

/**
 * Filters a list of scholarships by deadline status.
 */
export function filterScholarshipsByStatus(
  scholarships: Scholarship[],
  status: ScholarshipFilterStatus,
  currentDate: Date = new Date()
): Scholarship[] {
  if (status === 'all') {
    return scholarships;
  }
  if (status === 'expired') {
    return scholarships.filter(s => isScholarshipExpired(s, currentDate));
  }
  if (status === 'upcoming') {
    return scholarships.filter(s => isScholarshipUpcoming(s, currentDate));
  }
  if (status === 'active') {
    return scholarships.filter(s => computeLifecycleStatus(s, currentDate) === 'active');
  }
  if (status === 'closing_soon') {
    return scholarships.filter(s => computeLifecycleStatus(s, currentDate) === 'closing_soon');
  }
  if (status === 'closed') {
    return scholarships.filter(s => computeLifecycleStatus(s, currentDate) === 'closed');
  }
  if (status === 'archived') {
    return scholarships.filter(s => s.status === 'archived');
  }
  return scholarships;
}
