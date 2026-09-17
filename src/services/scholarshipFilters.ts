import { Scholarship } from '../types';

export type ScholarshipFilterStatus = 'all' | 'active' | 'upcoming' | 'expired';

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
 */
export function isScholarshipExpired(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (scholarship.status === 'expired') return true;
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
 * Determines whether a scholarship is currently active (open for application, not expired, and not upcoming).
 */
export function isScholarshipActive(scholarship: Scholarship, currentDate: Date = new Date()): boolean {
  if (isScholarshipExpired(scholarship, currentDate)) return false;
  if (isScholarshipUpcoming(scholarship, currentDate)) return false;
  if (scholarship.status === 'archived' || scholarship.status === 'rejected') return false;
  return true;
}

/**
 * Resolves the primary deadline status of a scholarship.
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
 * Filters a list of scholarships by deadline status ('all' | 'active' | 'upcoming' | 'expired').
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
    return scholarships.filter(s => isScholarshipActive(s, currentDate));
  }
  return scholarships;
}
