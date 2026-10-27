import React, { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  // Extract token and email from query params (Scholavon server reset link)
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  // Detect Supabase recovery tokens in URL hash (e.g. #access_token=...&type=recovery)
  const [hasSupabaseRecovery, setHasSupabaseRecovery] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.get('type') === 'recovery' || hashParams.get('access_token')) {
        setHasSupabaseRecovery(true);
      }
    }
  }, []);

  const hasValidAuthPath = Boolean(token || (isSupabaseConfigured && hasSupabaseRecovery));

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      if (token) {
        // Scholavon Express server-managed token reset
        const res = await api.post<{ message: string }>('/auth/reset-password', {
          token,
          newPassword,
        });

        if (res?.message) {
          setSubmitted(true);
        } else {
          setSubmitted(true);
        }
      } else if (isSupabaseConfigured && hasSupabaseRecovery) {
        // Supabase Auth-managed recovery reset
        const { error: sbError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (sbError) {
          setError(sbError.message);
          return;
        }
        setSubmitted(true);
      } else {
        setError('Missing or invalid reset token. Please request a new password reset link.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to reset password. The link may have expired or is invalid.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm space-y-6">
      <div className="text-center space-y-1.5">
        <img
          src="/images/scholavon-logo.png"
          alt="Scholavon"
          className="h-16 sm:h-20 w-auto object-contain mx-auto mb-3"
        />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Set New Password
        </h1>
        <p className="text-xs text-slate-600">
          {email ? (
            <>
              Resetting password for <strong className="text-slate-800">{email}</strong>
            </>
          ) : (
            'Choose a strong new password for your account.'
          )}
        </p>
      </div>

      {submitted ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="text-sm font-bold text-emerald-900">Password Updated</h4>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Your password has been successfully reset. You can now log in with your new credentials.
          </p>
          <button
            onClick={() => onNavigate('/login')}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Sign In to Scholavon
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {!hasValidAuthPath && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                No active password reset session or token found in URL. Please use the exact link sent to your email or request a new one.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                minLength={8}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !hasValidAuthPath}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Reset Password</span>
            )}
          </button>
        </form>
      )}

      <div className="pt-2 text-center text-xs text-slate-500">
        <button
          onClick={() => onNavigate('/login')}
          className="font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={13} />
          <span>Back to Sign In</span>
        </button>
      </div>
    </div>
  );
};
