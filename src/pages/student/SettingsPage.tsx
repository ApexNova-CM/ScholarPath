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
    matchingAlerts: userProfile.notificationPreferences?.matchingAlerts ?? true,
    deadlineDays: userProfile.notificationPreferences?.deadlineDays ?? [7, 3, 1, 0],
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleDeadlineDay = (day: number) => {
    const currentDays = preferences.deadlineDays || [7, 3, 1, 0];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => b - a);

    setPreferences({
      ...preferences,
      deadlineDays: newDays,
    });
  };

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
          Configure multi-channel notification alerts, deadline reminder schedules, and platform preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Deadline Reminders Milestone Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                <span>Deadline Reminder Schedule</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose when you want to receive countdown alerts for saved scholarships and tracked applications:
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-700">Enable Deadline Alerts</span>
              <input
                type="checkbox"
                checked={preferences.deadlineAlerts}
                onChange={(e) => setPreferences({ ...preferences, deadlineAlerts: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* 7 Days */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
              preferences.deadlineDays.includes(7) ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={preferences.deadlineDays.includes(7)}
                onChange={() => toggleDeadlineDay(7)}
                disabled={!preferences.deadlineAlerts}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">7 Days Before Deadline</span>
                <span className="text-[11px] text-slate-500">Preparation check and initial document checklist review</span>
              </div>
            </label>

            {/* 3 Days */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
              preferences.deadlineDays.includes(3) ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={preferences.deadlineDays.includes(3)}
                onChange={() => toggleDeadlineDay(3)}
                disabled={!preferences.deadlineAlerts}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">3 Days Before Deadline</span>
                <span className="text-[11px] text-slate-500">Urgent reminder to finalize required essays and references</span>
              </div>
            </label>

            {/* 1 Day */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
              preferences.deadlineDays.includes(1) ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={preferences.deadlineDays.includes(1)}
                onChange={() => toggleDeadlineDay(1)}
                disabled={!preferences.deadlineAlerts}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">1 Day Before Deadline (Tomorrow)</span>
                <span className="text-[11px] text-slate-500">Final call reminder for submission</span>
              </div>
            </label>

            {/* Deadline Day */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
              preferences.deadlineDays.includes(0) ? 'bg-rose-50/60 border-rose-300' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={preferences.deadlineDays.includes(0)}
                onChange={() => toggleDeadlineDay(0)}
                disabled={!preferences.deadlineAlerts}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Deadline Day (Today)</span>
                <span className="text-[11px] text-slate-500">Day-of closing reminder to ensure application was submitted</span>
              </div>
            </label>
          </div>
        </div>

        {/* Multi-Channel Delivery Options */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Notification Channels
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">In-App Notifications</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Receive alerts in your student dashboard notification center</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.inApp}
                onChange={(e) => setPreferences({ ...preferences, inApp: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </label>

            {/* Email */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Email Notifications</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Direct Email
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Send digests to {userProfile.email}</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.email}
                onChange={(e) => setPreferences({ ...preferences, email: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </label>

            {/* Push */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Smartphone size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Browser Push Notifications</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      Web Standard
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Receive high-priority desktop alerts for impending deadlines</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.push}
                onChange={(e) => setPreferences({ ...preferences, push: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </label>

            {/* WhatsApp */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">WhatsApp Alerts</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Optional
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Direct urgent 24-hour deadline reminders to your mobile device</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.whatsapp}
                onChange={(e) => setPreferences({ ...preferences, whatsapp: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Save size={14} />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
