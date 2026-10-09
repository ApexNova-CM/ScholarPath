/**
 * formatters.ts — Reusable currency, deadline, and text formatting utilities for Scholavon.
 */

import { Scholarship } from '../types';

/**
 * Maps standard currency ISO codes to their standard symbols.
 * Returns empty string if currency is undefined or unknown (does not falsely default to USD).
 */
export function getCurrencySymbol(currencyCode?: string | null): string {
  if (!currencyCode || typeof currencyCode !== 'string') return '';
  const code = currencyCode.trim().toUpperCase();
  switch (code) {
    case 'NGN':
      return '₦';
    case 'GBP':
      return '£';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'AU$';
    case 'JPY':
    case 'CNY':
      return '¥';
    case 'INR':
      return '₹';
    case 'ZAR':
      return 'R';
    case 'GHS':
      return 'GH₵';
    case 'KES':
      return 'KSh ';
    case 'UGX':
      return 'USh ';
    case 'TZS':
      return 'TSh ';
    case 'RWF':
      return 'FRw ';
    case 'CHF':
      return 'CHF ';
    case 'SEK':
    case 'NOK':
    case 'DKK':
      return 'kr ';
    default:
      return '';
  }
}

/**
 * Formats a scholarship's award value with high fidelity:
 * 1. Checks `awardValueText`, `awardDescription`, or `amountDisplay` first (supports non-numeric awards like "Full tuition", "Variable").
 * 2. If a numeric amount exists, formats with the actual currency code (honoring NGN, GBP, USD, EUR, etc.).
 * 3. Never falsely forces USD if currency is missing.
 * 4. Falls back to `fundingType` or "Not specified".
 */
export function formatScholarshipAmount(scholarship?: (Partial<Scholarship> & { award_currency?: string }) | null): string {
  if (!scholarship) return 'Not specified';

  // 1. Explicit descriptive award text
  if (scholarship.awardValueText && scholarship.awardValueText.trim()) {
    return scholarship.awardValueText.trim();
  }

  if (scholarship.awardDescription && scholarship.awardDescription.trim()) {
    return scholarship.awardDescription.trim();
  }

  if (scholarship.amountDisplay && scholarship.amountDisplay.trim()) {
    return scholarship.amountDisplay.trim();
  }

  // 2. Numeric amount formatting
  const amount = scholarship.amount;
  if (amount !== undefined && amount !== null && !isNaN(Number(amount)) && Number(amount) > 0) {
    const currencyCode = scholarship.awardCurrency || scholarship.award_currency || scholarship.currency;
    const formattedNumber = Number(amount).toLocaleString('en-US', {
      maximumFractionDigits: 0
    });

    if (currencyCode && currencyCode.trim()) {
      const symbol = getCurrencySymbol(currencyCode) || `${currencyCode.trim()} `;
      return `${symbol}${formattedNumber}`;
    }
    return formattedNumber;
  }

  // 3. Fallback to funding type
  if (scholarship.fundingType && scholarship.fundingType.trim()) {
    return scholarship.fundingType.trim();
  }

  return 'Not specified';
}

/**
 * Safely parses any date string (ISO, UTC, or YYYY-MM-DD).
 * Returns null if invalid.
 */
export function parseScholarshipDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const dateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (dateMatch) {
    const y = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10) - 1;
    const d = parseInt(dateMatch[3], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Checks whether a scholarship deadline has passed.
 * Accurately treats a date-only deadline (e.g. 2026-11-25) as active through 23:59:59.999 local of that day
 * to prevent premature closure due to timezone boundaries.
 */
export function isDeadlinePassed(deadlineStr?: string | null, currentDate: Date = new Date()): boolean {
  if (!deadlineStr || typeof deadlineStr !== 'string') return false;
  const trimmed = deadlineStr.trim();

  // If date-only (YYYY-MM-DD)
  const dateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (dateMatch) {
    const y = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10) - 1;
    const d = parseInt(dateMatch[3], 10);
    const endOfDay = new Date(y, m, d, 23, 59, 59, 999);
    return endOfDay.getTime() < currentDate.getTime();
  }

  const d = parseScholarshipDate(deadlineStr);
  if (!d) return false;
  return d.getTime() < currentDate.getTime();
}

/**
 * Formats a deadline into a clear, human-readable string.
 * Example: "25 November 2026" or "Nov 25, 2026"
 */
export function formatScholarshipDeadline(
  deadlineStr?: string | null,
  options?: { short?: boolean }
): string {
  const parsed = parseScholarshipDate(deadlineStr);
  if (!parsed) return 'Deadline not specified';

  if (options?.short) {
    return parsed.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Calculates days remaining until the deadline.
 * Returns negative numbers if already passed, 0 if closing today, or null if no deadline.
 */
export function getDaysUntilDeadline(deadlineStr?: string | null, currentDate: Date = new Date()): number | null {
  const parsed = parseScholarshipDate(deadlineStr);
  if (!parsed) return null;

  let targetTime = parsed.getTime();
  if (deadlineStr && deadlineStr.trim().length <= 10) {
    targetTime = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999).getTime();
  }

  const diffMs = targetTime - currentDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Official human support email address for Scholavon.
 */
export const SUPPORT_EMAIL = 'support@scholavon.com';

export interface SupportEmailOptions {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

/**
 * Builds a safely encoded RFC 6068 compliant mailto URL for human support.
 * - Accurately sets recipient to support@scholavon.com.
 * - Safely encodes spaces, ampersands (&), question marks (?), line breaks (\r\n), and special characters.
 * - Converts newlines to CRLF (\r\n -> %0D%0A) so multiline messages render correctly across all email clients.
 */
export function buildSupportMailtoUrl(options: SupportEmailOptions = {}): string {
  const recipient = SUPPORT_EMAIL;
  const params: string[] = [];

  const rawSubject = options.subject?.trim() || 'Scholavon Support Request';
  params.push(`subject=${encodeURIComponent(rawSubject)}`);

  const namePart = options.name?.trim() ? `Name: ${options.name.trim()}` : '';
  const emailPart = options.email?.trim() ? `Email: ${options.email.trim()}` : '';
  const messagePart = options.message?.trim() || '';

  const bodySections: string[] = [];
  bodySections.push('Hello Scholavon Support Team,');

  const senderDetails = [namePart, emailPart].filter(Boolean).join('\n');
  if (senderDetails) {
    bodySections.push(senderDetails);
  }

  if (messagePart) {
    bodySections.push(`Message:\n${messagePart}`);
  }

  bodySections.push('Sent from Scholavon Platform');

  const fullBody = bodySections.join('\n\n');
  // Normalize all line endings to CRLF before encoding
  const normalizedBody = fullBody.replace(/\r?\n/g, '\r\n');
  params.push(`body=${encodeURIComponent(normalizedBody)}`);

  return `mailto:${recipient}?${params.join('&')}`;
}
