import React, { useState, useEffect } from 'react';
import { Navbar } from '../common/Navbar';
import { api } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../types';
import { FloatingAiButton } from '../common/FloatingAiButton';

interface StudentLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  savedCount?: number;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  savedCount = 0,
}) => {
  const { user } = useAuth();
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
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-slate-900">
      <Navbar
        portalType="student"
        currentPath={currentPath}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        savedCount={savedCount}
      />

      <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
        {children}
      </main>

      {/* Floating AI Assistant Trigger */}
      <FloatingAiButton currentPath={currentPath} onNavigate={onNavigate} />
    </div>
  );
};
