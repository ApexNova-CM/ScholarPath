import React from 'react';
import { InAppNotification, UserProfile } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { 
  Bell, CheckCircle2, Clock, Sparkles, Shield, 
  FileText, CheckCheck, Trash2, ArrowUpRight 
} from 'lucide-react';

interface NotificationsPageProps {
  userProfile: UserProfile;
  notifications: InAppNotification[];
  onNotificationsChange: (notifs: InAppNotification[]) => void;
  onNavigate: (path: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  userProfile,
  notifications,
  onNotificationsChange,
  onNavigate
}) => {
  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/student/notifications/${id}/read`);
    } catch {}
    StorageService.markNotificationAsRead(id);
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    onNotificationsChange(updated);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(notifications.map(n => api.patch(`/student/notifications/${n.id}/read`)));
    } catch {}
    notifications.forEach(n => StorageService.markNotificationAsRead(n.id));
    const updated = notifications.map(n => ({ ...n, read: true }));
    onNotificationsChange(updated);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'deadline_alert':
        return <Clock size={16} className="text-amber-600" />;
      case 'match_notification':
        return <Sparkles size={16} className="text-indigo-600" />;
      case 'verification_update':
        return <Shield size={16} className="text-emerald-600" />;
      case 'document_reminder':
        return <FileText size={16} className="text-purple-600" />;
      default:
        return <Bell size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Bell size={14} />
            <span>Alerts & Updates</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notifications Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Stay informed on deadline countdowns, newly audited scholarships, and document reminders.
          </p>
        </div>

        {notifications.some(n => !n.read) && (
          <button
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <CheckCheck size={14} />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {notifications.map(n => (
            <div 
              key={n.id}
              onClick={() => {
                if (!n.read) handleMarkAsRead(n.id);
                if (n.link) onNavigate(n.link);
              }}
              className={`p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer ${
                !n.read ? 'bg-indigo-50/20' : ''
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-bold ${!n.read ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {n.title}
                    </h4>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>

              {n.link && (
                <span className="text-xs text-indigo-600 font-semibold shrink-0 flex items-center gap-1">
                  <span>View</span>
                  <ArrowUpRight size={13} />
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            <Bell size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Notifications</h3>
          <p className="text-xs text-slate-500">You are completely up to date.</p>
        </div>
      )}
    </div>
  );
};
