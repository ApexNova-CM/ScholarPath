/**
 * PaymentCallbackPage.tsx
 *
 * Handles the redirect back from Paystack after a payment attempt.
 * 
 * SECURITY: This page NEVER trusts the URL or frontend state as proof of payment.
 * It always calls the backend /payments/verify endpoint which re-verifies with
 * Paystack's API server-side before updating the subscription in Supabase.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Crown, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

interface PaymentCallbackPageProps {
  onNavigate: (path: string) => void;
}

type VerifyState = 'verifying' | 'success' | 'failed' | 'no_reference';

export const PaymentCallbackPage: React.FC<PaymentCallbackPageProps> = ({ onNavigate }) => {
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<VerifyState>('verifying');
  const [planName, setPlanName] = useState<string>('Scholavon Plus');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const verifyPayment = async () => {
      // Extract reference from URL query string
      const params = new URLSearchParams(window.location.search);
      const reference = params.get('reference') || params.get('trxref');

      if (!reference) {
        setState('no_reference');
        return;
      }

      try {
        const data = await api.get<{
          status: string;
          planId: string;
          message: string;
        }>(`/payments/verify?reference=${encodeURIComponent(reference)}`);

        if (data.status === 'active') {
          setPlanName(
            data.planId === 'premium_annual'
              ? 'Scholavon Plus Annual'
              : 'Scholavon Plus Monthly'
          );
          // Refresh user profile so subscriptionStatus updates in the UI immediately
          try {
            await refreshProfile();
          } catch {
            // Non-fatal — profile will refresh on next navigation
          }
          setState('success');
        } else {
          setState('failed');
          setErrorMessage('Payment was not confirmed as successful. No charge has been made.');
        }
      } catch (err: any) {
        setState('failed');
        setErrorMessage(
          err?.message || 'Verification failed. Please contact support if your payment went through.'
        );
      }
    };

    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Verifying */}
        {state === 'verifying' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
              <Loader2 size={24} className="text-indigo-600 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Verifying Payment</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Confirming your payment with Paystack. This takes just a moment…
              </p>
            </div>
            <p className="text-[10px] text-slate-400">Please do not close this page.</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-xs text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-3">
                <Crown size={11} />
                Scholavon Plus Active
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Welcome to Plus! 🎉
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Your <strong>{planName}</strong> subscription is now active. All Plus features are
                unlocked on your account.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => onNavigate('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => onNavigate('/ai-assistant')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Try AI Assistant
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Failed */}
        {state === 'failed' && (
          <div className="bg-white border border-rose-200 rounded-2xl p-8 shadow-xs text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto">
              <XCircle size={28} className="text-rose-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Payment Not Confirmed</h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{errorMessage}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => onNavigate('/pricing')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                Try Again
              </button>
              <button
                onClick={() => onNavigate('/dashboard')}
                className="w-full py-2.5 text-xs text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              If your payment went through but this page shows an error, please contact{' '}
              <a href="mailto:support@scholavon.org" className="underline text-indigo-600">
                support@scholavon.org
              </a>
              {' '}with your payment reference.
            </p>
          </div>
        )}

        {/* No reference */}
        {state === 'no_reference' && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <XCircle size={28} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">No Payment Reference</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This page should only be accessed after completing a Paystack payment.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/pricing')}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              View Pricing
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
