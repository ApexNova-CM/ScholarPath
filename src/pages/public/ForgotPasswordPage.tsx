import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await sendPasswordReset(email);
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm space-y-6">
      <div className="text-center space-y-1.5">
        <img
          src="/images/scholarpath-logo.png"
          alt="ScholarPath"
          className="h-16 sm:h-20 w-auto object-contain mx-auto mb-3"
        />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Reset Password
        </h1>
        <p className="text-xs text-slate-600">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      {submitted ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="text-sm font-bold text-emerald-900">Reset Email Sent</h4>
          <p className="text-xs text-emerald-700 leading-relaxed">
            If an account is associated with <strong>{email}</strong>, we have sent instructions to reset your password. Check your inbox (and spam folder).
          </p>
          <button
            onClick={() => onNavigate('/login')}
            className="text-xs font-semibold text-emerald-800 underline underline-offset-2"
          >
            Return to Login
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.edu"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <span>Send Reset Link</span>
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
