import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { 
  Settings, Bell, Mail, Smartphone, MessageSquare, 
  CheckCircle2, Save, Shield, Clock, Lock 
} from 'lucide-react';

interface SettingsPageProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ userProfile, onUpdateProfile }) => {
  const [preferences, setPreferences] = useState({
    inApp: userProfile.notificationPreferences?.inApp ?? true,
    email: userProfile.notificationPreferences?.email ?? true,
    push: userProfile.notificationPreferences?.push ?? false,
    whatsapp: userProfile.notificationPreferences?.whatsapp ?? false,
    deadlineAlerts: userProfile.notificationPreferences?.deadlineAlerts ?? true,
    matchingAlerts: userProfile.notificationPreferences?.matchingAlerts ?? true
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...userProfile,
      notificationPreferences: preferences,
      updatedAt: new Date().toISOString()
    };
    onUpdateProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
          <Settings size={14} />
          <span>Account Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
          Configure multi-channel notification alerts and platform security preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Multi-Channel Delivery Options */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Multi-Channel Delivery Options
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select which channels you wish to receive deadline alerts and new match notifications through.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {/* In-App */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bell size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">In-App Notifications</span>
                  <span className="text-[11px] text-slate-500">Receive alerts in your student dashboard notification center</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.inApp}
                onChange={(e) => setPreferences({ ...preferences, inApp: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>

            {/* Email */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Email Notifications</span>
                  <span className="text-[11px] text-slate-500">Send digests to {userProfile.email}</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.email}
                onChange={(e) => setPreferences({ ...preferences, email: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>

            {/* Push */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Smartphone size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Browser Push Notifications</span>
                  <span className="text-[11px] text-slate-500">Receive high-priority desktop alerts for impending deadlines</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.push}
                onChange={(e) => setPreferences({ ...preferences, push: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>

            {/* WhatsApp */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">WhatsApp Alerts</span>
                  <span className="text-[11px] text-slate-500">Direct urgent 24-hour deadline reminders to your mobile device</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.whatsapp}
                onChange={(e) => setPreferences({ ...preferences, whatsapp: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>
          </div>
        </div>

        {/* Milestone Trigger Schedule */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Automatic Deadline Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Notifications fire automatically at standard pre-deadline intervals:
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 block">30 Days</span>
              <span className="text-[10px] text-slate-500">Preparation notice</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 block">14 Days</span>
              <span className="text-[10px] text-slate-500">Document review</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 block">7 Days</span>
              <span className="text-[10px] text-indigo-600">Checklist check</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 block">3 Days</span>
              <span className="text-[10px] text-amber-600">Urgent reminder</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
              <span className="font-bold text-slate-900 block">1 Day</span>
              <span className="text-[10px] text-rose-600">Final call</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-2"
          >
            <Save size={14} />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
