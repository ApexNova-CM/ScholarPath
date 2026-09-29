import { Scholarship, LifecycleStatus } from '../types';

export type ScholarshipFilterStatus = 'all' | 'active' | 'upcoming' | 'expired' | 'closing_soon' | 'closed' | 'archived';

/** Number of days before the deadline that a scholarship is considered "Closing Soon" */
export const CLOSING_SOON_DAYS = 7;

/**
 * Safely parses any date string (ISO, UTC, or short format).
 * Returns null if the date is invalid or undefined.
 */
export function parseScholarshipDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Determines whether a scholarship deadline has passed relative to the current date/time.
 * Also returns true when a scholarship has been manually closed by an admin.
 */
export function isScholarshipExpired(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (scholarship.status === 'expired') return true;
  if (scholarship.status === 'closed' || scholarship.manuallyClosed === true) return true;
  const deadline = parseScholarshipDate(scholarship.deadline);
  if (!deadline) return false;
  return deadline.getTime() < currentDate.getTime();
}

/**
 * Determines whether a scholarship is upcoming (applications not yet open or scheduled for an upcoming cycle).
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
 * Determines whether a scholarship is currently active (open for application, not expired, not upcoming, not closed/archived).
 */
export function isScholarshipActive(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (isScholarshipExpired(scholarship, currentDate)) return false;
  if (isScholarshipUpcoming(scholarship, currentDate)) return false;
  if (scholarship.status === 'archived' || scholarship.status === 'rejected') return false;
  if (scholarship.status === 'closed' || scholarship.manuallyClosed === true) return false;
  return true;
}

/**
 * Computes the display lifecycle status of a scholarship.
 * Precedence (highest first):
 *   1. archived  → 'archived'
 *   2. manuallyClosed or status=closed → 'closed'
 *   3. Deadline passed → 'closed'
 *   4. Deadline within CLOSING_SOON_DAYS → 'closing_soon'
 *   5. Otherwise → 'active'
 */
export function computeLifecycleStatus(
  scholarship: Scholarship,
  currentDate: Date = new Date()
): LifecycleStatus {
  if (scholarship.status === 'archived') return 'archived';
  if (scholarship.status === 'closed' || scholarship.manuallyClosed === true) return 'closed';

  const deadline = parseScholarshipDate(scholarship.deadline);
  if (!deadline) return 'active';

  const msLeft = deadline.getTime() - currentDate.getTime();
  if (msLeft < 0) return 'closed';

  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  if (daysLeft <= CLOSING_SOON_DAYS) return 'closing_soon';

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
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Active' };
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
