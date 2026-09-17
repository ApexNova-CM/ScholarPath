import React from 'react';
import { LoginPage } from '../public/LoginPage';

interface AdminLoginPageProps {
  onNavigate: (path: string) => void;
}

/**
 * Unified Login:
 * ScholarPath uses a single unified login interface for all accounts (Students and Admins).
 * Logging in with admin credentials automatically routes to the Admin Console (/admin/dashboard),
 * and logging in with student credentials routes to the Student Dashboard (/dashboard).
 */
export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onNavigate }) => {
  return <LoginPage onNavigate={onNavigate} />;
};
