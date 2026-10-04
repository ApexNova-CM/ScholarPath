/**
 * PricingPage.tsx
 * 
 * Scholavon Plus pricing page with monthly and annual plans.
 * Initiates Paystack payment via authenticated backend call.
 * Never sends amount from frontend — backend derives it from planId.
 */

import React, { useState } from 'react';
import {
  Sparkles, Crown, Check, ArrowRight, Loader2,
  Search, Bookmark, Briefcase, Bell, Brain, FileText,
  Star, Shield, Zap, BookOpen, Target, Lock
} from 'lucide-react';
import { UserProfile } from '../../types';
import { api } from '../../lib/apiClient';

interface PricingPageProps {
  userProfile: UserProfile | null;
  onNavigate: (path: string) => void;
}

const FREE_FEATURES = [
  { icon: Search, text: 'Scholarship discovery & search' },
  { icon: Bookmark, text: 'Save scholarships' },
  { icon: Briefcase, text: 'Application tracker' },
  { icon: Bell, text: 'Basic deadline reminders' },
  { icon: Brain, text: 'Basic AI scholarship matching' },
  { icon: FileText, text: 'Basic profile & document vault' },
];

const PLUS_FEATURES = [
  { icon: Target, text: 'Advanced scholarship matching engine' },
  { icon: Brain, text: 'Advanced scholarship readiness analysis' },
  { icon: BookOpen, text: 'AI personal statement assistance' },
  { icon: Zap, text: 'AI application guidance & strategy' },
  { icon: Star, text: 'Enhanced Application Workspace' },
  { icon: Bell, text: 'Advanced & customizable deadline reminders' },
  { icon: FileText, text: 'Enhanced document & application organisation' },
  { icon: Shield, text: 'Priority access to future premium features' },
];

export const PricingPage: React.FC<PricingPageProps> = ({ userProfile, onNavigate }) => {
  const [loading, setLoading] = useState<'premium_monthly' | 'premium_annual' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPremium = userProfile?.subscriptionStatus === 'premium';
  const isPastDue = userProfile?.subscriptionStatus === 'past_due';
  const isCancelled = userProfile?.subscriptionStatus === 'cancelled';

  const handleUpgrade = async (planId: 'premium_monthly' | 'premium_annual') => {
    if (!userProfile) {
      // Unauthenticated user — send to login first
      onNavigate('/login');
      return;
    }

    setError(null);
    setLoading(planId);

    try {
      const data = await api.post<{
        authorizationUrl: string;
        reference: string;
        plan: { id: string; name: string; amountNaira: number; currency: string };
      }>('/payments/initialize', { planId });

      // Redirect to Paystack hosted checkout
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setError(
        err?.message || 'Could not start checkout. Please try again or contact support.'
      );
      setLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 rounded-full text-[11px] font-bold uppercase tracking-wider text-amber-700">
          <Crown size={12} />
          Scholavon Plus
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Unlock Your Full Scholarship Potential
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Scholavon Plus gives you AI-powered tools and advanced features designed to help you
          discover, prepare for, and win more scholarships.
        </p>
      </div>

      {/* Active Plus Status Banner */}
      {isPremium && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Crown size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">You have Scholavon Plus ✓</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              All Plus features are active on your account. Thank you for supporting Scholavon.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/settings')}
            className="ml-auto shrink-0 text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-900 transition-colors"
          >
            Manage plan
          </button>
        </div>
      )}

      {/* Past Due Warning */}
      {isPastDue && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-rose-800">Subscription Payment Overdue</p>
          <p className="text-xs text-rose-700 mt-1">
            Your subscription payment failed. Please update your payment method with Paystack to restore Plus access.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Free Plan */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Free
            </span>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-3xl font-extrabold text-slate-900">₦0</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Forever free. No credit card required.</p>
          </div>

          <div className="space-y-2.5">
            {FREE_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon size={11} className="text-slate-500" />
                </div>
                <span className="text-xs text-slate-700">{text}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <div className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
              {userProfile ? 'Current Plan' : 'Get started free'}
            </div>
          </div>
        </div>

        {/* Plus Monthly */}
        <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-xs space-y-5 relative">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              Scholavon Plus
            </span>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-3xl font-extrabold text-slate-900">₦1,500</span>
              <span className="text-sm text-slate-500 mb-1">/month</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Billed monthly. Cancel anytime.</p>
          </div>

          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Everything in Free, plus:
            </p>
            {PLUS_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-indigo-600" />
                </div>
                <span className="text-xs text-slate-700">{text}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            {isPremium ? (
              <div className="w-full py-2.5 text-center text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl">
                ✓ Active
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade('premium_monthly')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {loading === 'premium_monthly' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Sparkles size={13} />
                    Get Plus Monthly
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Plus Annual — Best Value */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 shadow-lg space-y-5 relative text-white">
          {/* Best Value Badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm border border-amber-200">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              Best Value
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-100">
              Scholavon Plus Annual
            </span>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-3xl font-extrabold">₦10,000</span>
              <span className="text-sm text-amber-100 mb-1">/year</span>
            </div>
            <p className="text-xs text-amber-100 mt-1">
              ₦833/month — save ₦8,000 vs monthly billing.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100">
              Everything in Plus, billed annually:
            </p>
            {PLUS_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-white" />
                </div>
                <span className="text-xs text-white">{text}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            {isPremium ? (
              <div className="w-full py-2.5 text-center text-xs font-semibold text-amber-700 bg-white rounded-xl">
                ✓ Active
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade('premium_annual')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-amber-50 disabled:opacity-60 text-amber-700 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {loading === 'premium_annual' ? (
                  <Loader2 size={14} className="animate-spin text-amber-600" />
                ) : (
                  <>
                    <Crown size={13} />
                    Get Plus Annual
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature Comparison Note */}
      <div className="text-center text-xs text-slate-500 space-y-1">
        <p>Payments are processed securely by <span className="font-semibold text-slate-700">Paystack</span>. You will be redirected to complete your payment.</p>
        <p>Cancel anytime from your Settings page. No long-term commitments.</p>
      </div>

      {/* Security + Trust */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {[
          { icon: Shield, title: 'Secure Payments', desc: 'Powered by Paystack, Nigeria\'s trusted payment infrastructure.' },
          { icon: Lock, title: 'Cancel Anytime', desc: 'No lock-in. Cancel your subscription whenever you want.' },
          { icon: Crown, title: 'Instant Access', desc: 'Plus features activate immediately after successful payment.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white border border-slate-200/90 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
