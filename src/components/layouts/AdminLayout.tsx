import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../common/AdminSidebar';
import { MobileHeader } from '../common/MobileHeader';
import { api } from '../../lib/apiClient';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  currentPath,
  onNavigate
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get<{ pendingCount: number }>('/admin/metrics')
      .then((metrics) => {
        if (!cancelled && metrics && typeof metrics.pendingCount === 'number') {
          setPendingCount(metrics.pendingCount);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentPath]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Sidebar handles both desktop persistent navigation and mobile drawer */}
      <AdminSidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        pendingVerificationCount={pendingCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-y-auto">
        {/* Global Mobile Header (visible on screens < md) */}
        <MobileHeader
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={onNavigate}
          portalType="admin"
          badge={pendingCount > 0 ? pendingCount : undefined}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
