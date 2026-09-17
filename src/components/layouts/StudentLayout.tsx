import React, { useState, useEffect } from 'react';
import { Sidebar } from '../common/Sidebar';
import { MobileHeader } from '../common/MobileHeader';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../types';

interface StudentLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  children,
  currentPath,
  onNavigate
}) => {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.get<NotificationItem[]>('/student/notifications')
      .then((notifs) => {
        if (!cancelled && Array.isArray(notifs)) {
          setUnreadCount(notifs.filter(n => !n.read).length);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, currentPath]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Sidebar handles both desktop persistent navigation and the mobile sliding drawer */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        unreadNotificationCount={unreadCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-y-auto">
        {/* Global Mobile Header (visible on screens < md) */}
        <MobileHeader
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
          portalType="student"
          badge={unreadCount > 0 ? unreadCount : undefined}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
