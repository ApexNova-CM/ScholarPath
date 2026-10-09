import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, X, CheckCircle, AlertCircle, HelpCircle, 
  MessageSquare, Copy, Check, ExternalLink, ArrowRight 
} from 'lucide-react';
import { UserProfile } from '../../types';
import { SUPPORT_EMAIL, buildSupportMailtoUrl } from '../../utils/formatters';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
  defaultEmail?: string;
  defaultSubject?: string;
  defaultMessage?: string;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  defaultEmail,
  defaultSubject,
  defaultMessage,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      const initialName = userProfile 
        ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() 
        : '';
      const initialEmail = userProfile?.email || defaultEmail || '';
      
      setName(initialName);
      setEmail(initialEmail);
      setSubject(defaultSubject || '');
      setMessage(defaultMessage || '');
      setIsSuccess(false);
      setError('');
      setCopiedEmail(false);
      setCopiedBody(false);
    }
  }, [isOpen, userProfile, defaultEmail, defaultSubject, defaultMessage]);

  if (!isOpen) return null;

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = SUPPORT_EMAIL;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleCopyBody = async () => {
    const namePart = name.trim() ? `Name: ${name.trim()}\n` : '';
    const emailPart = email.trim() ? `Email: ${email.trim()}\n` : '';
    const fullText = `Subject: ${subject.trim() || 'Scholavon Support Request'}\nTo: ${SUPPORT_EMAIL}\n\nHello Scholavon Support Team,\n\n${namePart}${emailPart}Message:\n${message.trim()}\n\nSent from Scholavon Platform`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !message.trim()) {
      setError('Please provide your email address and message details.');
      return;
    }

    const mailtoUrl = buildSupportMailtoUrl({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });

    // Safely trigger mailto application opening across desktop and mobile browsers
    try {
      const link = document.createElement('a');
      link.href = mailtoUrl;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      try {
        window.location.href = mailtoUrl;
      } catch (e) {
        console.warn('Could not launch mailto protocol directly:', e);
      }
    }

    setIsSuccess(true);
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setError('');
    setCopiedEmail(false);
    setCopiedBody(false);
    onClose();
  };

  const activeMailtoUrl = buildSupportMailtoUrl({
    name: name.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleResetAndClose}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Contact Human Support</h3>
              <p className="text-[11px] text-slate-500">Reach the Scholavon Team at {SUPPORT_EMAIL}</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {isSuccess ? (
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle size={28} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-900">Email Draft Prepared</h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your default email application has been launched with your support request addressed to{' '}
                  <strong className="text-indigo-600 font-semibold">{SUPPORT_EMAIL}</strong>.
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Please review the draft in your email client and click <strong>Send</strong> to deliver your message to our team.
                </p>
              </div>

              {/* Helpful Fallback Card if email client didn't open */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-4 text-left space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Mail size={14} className="text-indigo-600" />
                  <span>Didn't open or using webmail (Gmail / Outlook)?</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  If your system email client did not open automatically, you can copy our email address or click the button below:
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      copiedEmail
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {copiedEmail ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedEmail ? 'Email Copied!' : `Copy ${SUPPORT_EMAIL}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBody}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      copiedBody
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {copiedBody ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedBody ? 'Message Copied!' : 'Copy Draft Text'}</span>
                  </button>

                  <a
                    href={activeMailtoUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <ExternalLink size={13} />
                    <span>Open Email Client Again</span>
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Question about scholarship eligibility or account"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can our support team help you?"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 resize-none"
                />
              </div>

              {/* Transparency note and Copy Email Address option */}
              <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100/90 space-y-2 text-[11px] text-indigo-950">
                <div className="flex items-start gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Submitting this form prepares an email draft in your device's email application addressed to{' '}
                    <strong className="text-indigo-700 font-semibold">{SUPPORT_EMAIL}</strong>.
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-indigo-100/60">
                  <span className="text-indigo-700 font-medium">Prefer to email us directly?</span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                      copiedEmail
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    {copiedEmail ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedEmail ? 'Copied!' : 'Copy Email Address'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send size={13} />
                  <span>Open in Email App</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

