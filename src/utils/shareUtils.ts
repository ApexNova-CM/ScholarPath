import { Scholarship, OPPORTUNITY_TYPE_LABELS } from '../types';

/**
 * Returns the canonical relative route path for an opportunity.
 * Scholavon routes all opportunities (scholarships, grants, fellowships, etc.)
 * under /scholarships/:id.
 */
export function getOpportunitySharePath(scholarshipId: string): string {
  return `/scholarships/${encodeURIComponent(scholarshipId)}`;
}

/**
 * Generates the stable, public, shareable URL for an opportunity.
 * Never includes user credentials, tokens, or private profile information.
 */
export function getOpportunityShareUrl(scholarshipId: string, origin?: string): string {
  let baseOrigin = origin;
  if (!baseOrigin) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      baseOrigin = window.location.origin;
    } else {
      baseOrigin = 'https://scholavon.com';
    }
  }
  // Trim trailing slash if present
  if (baseOrigin.endsWith('/')) {
    baseOrigin = baseOrigin.slice(0, -1);
  }
  return `${baseOrigin}${getOpportunitySharePath(scholarshipId)}`;
}

/**
 * Formats a clean, readable text summary for sharing an opportunity.
 */
export function formatOpportunityShareText(
  scholarship: Pick<Scholarship, 'title' | 'providerName' | 'opportunityType'>,
  shareUrl: string
): string {
  const typeLabel = (scholarship.opportunityType && OPPORTUNITY_TYPE_LABELS[scholarship.opportunityType])
    || 'Opportunity';
  
  const provider = scholarship.providerName ? ` by ${scholarship.providerName}` : '';
  return `Check out this ${typeLabel} on Scholavon: "${scholarship.title}"${provider}\n${shareUrl}`;
}

/**
 * Returns the universal WhatsApp sharing URL.
 * Works seamlessly across desktop (web.whatsapp.com) and mobile (WhatsApp App).
 */
export function getWhatsAppShareUrl(
  scholarship: Pick<Scholarship, 'title' | 'providerName' | 'opportunityType'>,
  shareUrl: string
): string {
  const text = formatOpportunityShareText(scholarship, shareUrl);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Checks if the browser supports the Web Share API.
 */
export function isWebShareSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  );
}

/**
 * Copies text to the clipboard with fallback support.
 * Returns true if copied successfully, false if clipboard operations failed.
 * Never falsely reports success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Modern API rejected (e.g. permissions, non-focused document) — proceed to fallback
    }
  }

  // 2. Fallback to document.execCommand('copy')
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Boolean(successful);
    } catch {
      return false;
    }
  }

  return false;
}

export type NativeShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'error'; error: string };

/**
 * Invokes the Web Share API if supported.
 * Handles user cancellations (AbortError) gracefully without reporting failure.
 */
export async function shareViaWebShare(data: {
  title: string;
  text: string;
  url: string;
}): Promise<NativeShareResult> {
  if (!isWebShareSupported()) {
    return { status: 'unsupported' };
  }

  try {
    await navigator.share(data);
    return { status: 'shared' };
  } catch (err: any) {
    if (err && (err.name === 'AbortError' || err.code === 20)) {
      // User cancelled or dismissed the native share sheet
      return { status: 'cancelled' };
    }
    return {
      status: 'error',
      error: err?.message || 'An error occurred while opening the share menu.'
    };
  }
}
