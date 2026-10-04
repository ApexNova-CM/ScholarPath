/**
 * PremiumGate.tsx
 *
 * Reusable wrapper component that gates premium features behind a Scholavon Plus subscription.
 *
 * Usage:
 *   <PremiumGate userProfile={user} featureName="AI Personal Statement Assistance" onNavigate={navigate}>
 *     <MyPremiumFeature />
 *   </PremiumGate>
 *
 * - If user is premium: renders children transparently.
 * - If user is free/cancelled/past_due: renders a tasteful upgrade prompt.
 * - Never blocks access based on client state alone — the actual API calls
 *   are protected server-side. This component is a UX layer only.
 */

import React from 'react';
import { Sparkles, Lock, ArrowRight, Crown } from 'lucide-react';
import { UserProfile } from '../../types';

interface PremiumGateProps {
  userProfile: UserProfile | null;
  featureName?: string;
  featureDescription?: string;
  onNavigate: (path: string) => void;
  /** If true, renders a compact inline badge instead of a full block */
  compact?: boolean;
  children: React.ReactNode;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({
  userProfile,
  featureName = 'This Feature',
  featureDescription = 'Upgrade to Scholavon Plus to unlock advanced tools that help you win more scholarships.',
  onNavigate,
  compact = false,
  children,
}) => {
  const isPremium = userProfile?.subscriptionStatus === 'premium';

  // Active Plus user — render children directly
  if (isPremium) {
    return <>{children}</>;
  }

  // Compact inline variant — shows a small lock badge
  if (compact) {
    return (
      <div className="relative inline-flex items-center gap-1.5">
        <span className="opacity-40 pointer-events-none select-none">{children}</span>
        <button
          onClick={() => onNavigate('/pricing')}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold rounded-full hover:bg-amber-200 transition-colors cursor-pointer"
          title={`${featureName} — Scholavon Plus`}
        >
          <Crown size={10} />
          Plus
        </button>
      </div>
    );
  }

  // Full block upgrade prompt
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 flex flex-col items-center text-center gap-4 shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
        <Lock size={22} className="text-amber-600" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
          <Sparkles size={12} />
          <span>Scholavon Plus</span>
        </div>
        <h3 className="text-base font-bold text-slate-900">{featureName}</h3>
        <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
          {featureDescription}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <button
          onClick={() => onNavigate('/pricing')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Crown size={14} />
          Upgrade to Plus
          <ArrowRight size={13} />
        </button>
        <span className="text-[10px] text-slate-500">From ₦1,500/month</span>
      </div>

      {userProfile?.subscriptionStatus === 'past_due' && (
        <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
          Your subscription payment is past due. Please update your payment method to restore Plus access.
        </p>
      )}
    </div>
  );
};

/** Convenience hook-style helper for conditional premium checks */
export function isPremiumUser(userProfile: UserProfile | null | undefined): boolean {
  return userProfile?.subscriptionStatus === 'premium';
}
