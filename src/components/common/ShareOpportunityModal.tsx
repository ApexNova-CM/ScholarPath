import React, { useState, useEffect, useRef } from 'react';
import { Scholarship, OPPORTUNITY_TYPE_LABELS } from '../../types';
import { 
  getOpportunityShareUrl, 
  getWhatsAppShareUrl, 
  formatOpportunityShareText,
  isWebShareSupported, 
  copyToClipboard, 
  shareViaWebShare 
} from '../../utils/shareUtils';
import { formatScholarshipAmount, formatScholarshipDeadline } from '../../utils/formatters';
import { 
  Share2, X, Copy, Check, ExternalLink, AlertCircle, 
  MessageCircle, CheckCircle2, ShieldCheck 
} from 'lucide-react';

export interface ShareOpportunityModalProps {
  scholarship: Scholarship | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareOpportunityModal: React.FC<ShareOpportunityModalProps> = ({
  scholarship,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [nativeShareError, setNativeShareError] = useState<string | null>(null);
  const [isSharingNative, setIsSharingNative] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset transient feedback when opening or closing
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setCopyError(null);
      setNativeShareError(null);
    }
  }, [isOpen, scholarship?.id]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !scholarship) return null;

  const shareUrl = getOpportunityShareUrl(scholarship.id);
  const whatsAppUrl = getWhatsAppShareUrl(scholarship, shareUrl);
  const typeLabel = (scholarship.opportunityType && OPPORTUNITY_TYPE_LABELS[scholarship.opportunityType]) || 'Opportunity';
  const formattedAmount = formatScholarshipAmount(scholarship);
  const formattedDeadline = formatScholarshipDeadline(scholarship.deadline, { short: true });
  const hasNativeShare = isWebShareSupported();

  const handleCopyLink = async () => {
    setCopyError(null);
    setNativeShareError(null);
    
    // Select input text for clear user context
    if (inputRef.current) {
      inputRef.current.select();
    }

    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopyError('Could not copy automatically. Please copy the link above manually.');
    }
  };

  const handleNativeShare = async () => {
    setNativeShareError(null);
    setIsSharingNative(true);

    const shareText = formatOpportunityShareText(scholarship, shareUrl);
    const result = await shareViaWebShare({
      title: scholarship.title,
      text: shareText,
      url: shareUrl,
    });

    setIsSharingNative(false);

    if (result.status === 'shared') {
      // Optional: automatically close on confirmed share
      onClose();
    } else if (result.status === 'error') {
      setNativeShareError(result.error);
    }
    // If cancelled: nothing to show, opportunity link remains intact and copyable
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Share2 size={18} />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-sm font-bold text-slate-900">
                Share {typeLabel}
              </h2>
              <p className="text-[11px] text-slate-500">
                Send to a friend, classmate, or mentor
              </p>
            </div>
          </div>

          <button
            id="btn-close-share-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close share dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Opportunity Snapshot Preview */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100/70 text-indigo-700">
                {typeLabel}
              </span>
              {scholarship.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck size={13} />
                  <span>Verified</span>
                </span>
              )}
            </div>

            <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
              {scholarship.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-0.5">
              <span className="font-medium text-slate-700">{scholarship.providerName}</span>
              <span>•</span>
              <span className="font-semibold text-emerald-700">{formattedAmount}</span>
              <span>•</span>
              <span>Deadline: {formattedDeadline}</span>
            </div>
          </div>

          {/* Share Link Input Box */}
          <div className="space-y-1.5">
            <label htmlFor="input-share-url" className="block text-xs font-bold text-slate-700">
              Opportunity Link
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                id="input-share-url"
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Opportunity shareable link"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-24 py-2.5 text-slate-700 select-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                id="btn-copy-share-link"
                type="button"
                onClick={handleCopyLink}
                className={`absolute right-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
              >
                {copied ? (
                  <>
                    <Check size={13} className="stroke-[3]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Copy Feedback Alerts */}
            {copied && (
              <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1 animate-fade-in">
                <CheckCircle2 size={13} />
                <span>Link copied to clipboard! Anyone can open this link directly.</span>
              </p>
            )}

            {copyError && (
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-fade-in">
                <AlertCircle size={13} />
                <span>{copyError}</span>
              </p>
            )}
          </div>

          {/* Practical Sharing Options */}
          <div className="space-y-2 pt-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Share Via
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* WhatsApp Option */}
              <a
                id="btn-share-whatsapp"
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer min-h-[44px]"
                aria-label="Share opportunity on WhatsApp"
              >
                <MessageCircle size={16} />
                <span>WhatsApp</span>
                <ExternalLink size={12} className="opacity-70" />
              </a>

              {/* Native Web Share Option (if supported) */}
              {hasNativeShare ? (
                <button
                  id="btn-share-native"
                  type="button"
                  onClick={handleNativeShare}
                  disabled={isSharingNative}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer min-h-[44px]"
                  aria-label="Share using native device menu"
                >
                  <Share2 size={15} />
                  <span>{isSharingNative ? 'Opening...' : 'Device / Apps'}</span>
                </button>
              ) : (
                <button
                  id="btn-share-copy-alt"
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer min-h-[44px]"
                >
                  <Copy size={15} />
                  <span>{copied ? 'Link Copied' : 'Copy Direct Link'}</span>
                </button>
              )}
            </div>

            {nativeShareError && (
              <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle size={13} />
                <span>{nativeShareError}</span>
              </p>
            )}

            {!hasNativeShare && (
              <p className="text-[11px] text-slate-500 text-center pt-1">
                Device share sheet is not supported in this browser. Use WhatsApp or Copy Link above.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Private and secure — no personal details shared.</span>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
