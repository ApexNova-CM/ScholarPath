import React, { useState, useEffect } from 'react';
import { Navbar } from '../common/Navbar';
import { api } from '../../lib/apiClient';
import { StorageService } from '../../services/storage';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  currentPath,
  onNavigate,
}) => {
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

    try {
      const reports = StorageService.getReports();
      // kept for potential future badge use
      const _pending = reports.filter(r => r.status === 'Pending').length;
      void _pending;
    } catch {
      // ignore
    }

    return () => { cancelled = true; };
  }, [currentPath]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-slate-900">
      <Navbar
        portalType="admin"
        currentPath={currentPath}
        onNavigate={onNavigate}
        pendingCount={pendingCount}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};
