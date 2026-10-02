import React, { useState, useEffect, useCallback } from 'react';
import { AdminUser, UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, createAdminAuthClient } from '../../lib/supabase';
import {
  fetchAdminUsers,
  promoteUserToAdmin,
  revokeAdminRole,
  searchRegisteredUsers,
} from '../../services/dataService';
import {
  ShieldCheck, Search, UserPlus, Mail, Calendar,
  CheckCircle2, X, AlertCircle, Info, Trash2, KeyRound, Eye, EyeOff,
  Loader2, UserCheck, ArrowRight, ShieldAlert, GraduationCap, Building2
} from 'lucide-react';

interface AdminAdminsPageProps {
  onNavigate?: (path: string) => void;
}

export const AdminAdminsPage: React.FC<AdminAdminsPageProps> = () => {
  const { user: currentAuthUser } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'promote' | 'create'>('promote');

  // Promote User State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [promoteDepartment, setPromoteDepartment] = useState('Scholarship Operations');
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Create New Admin State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('Platform Administration');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Revoke Admin State
  const [revokingAdmin, setRevokingAdmin] = useState<AdminUser | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // ── Load all admin users ──────────────────────────────────────────────────
  const loadAdmins = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await fetchAdminUsers();
      setAdmins(data);
    } catch (err: any) {
      console.error('Failed to load admin users:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // ── Search registered users for promotion ─────────────────────────────────
  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    setSelectedUser(null);
    setPromoteError(null);

    const clean = query.trim();
    if (!clean) {
      setSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const results = await searchRegisteredUsers(clean);
      // Filter out users who are already in the admin list
      const currentAdminIds = new Set(admins.map((a) => a.id));
      const currentAdminEmails = new Set(admins.map((a) => a.email.toLowerCase()));
      const availableStudents = results.filter(
        (u) => !currentAdminIds.has(u.id) && !currentAdminEmails.has(u.email.toLowerCase()) && u.role !== 'admin'
      );
      setSearchResults(availableStudents);
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // ── Promote existing student to Admin ─────────────────────────────────────
  const handlePromoteConfirm = async () => {
    if (!selectedUser) return;
    setIsPromoting(true);
    setPromoteError(null);

    try {
      const res = await promoteUserToAdmin(selectedUser.id, promoteDepartment);
      if (!res.success) {
        setPromoteError(res.error || 'Failed to promote user to Administrator.');
        return;
      }

      await loadAdmins();
      setIsAddModalOpen(false);
      setSelectedUser(null);
      setUserSearchQuery('');
      setSearchResults([]);

      const fullName = `${selectedUser.firstName} ${selectedUser.lastName}`.trim();
      setSuccessMessage(
        `${fullName} (${selectedUser.email}) has been successfully promoted to Administrator. Their student data and applications have been preserved.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err: any) {
      setPromoteError(err.message || 'An unexpected error occurred during promotion.');
    } finally {
      setIsPromoting(false);
    }
  };

  // ── Create brand new Admin account ────────────────────────────────────────
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!firstName.trim()) return setCreateError('First name is required.');
    if (!lastName.trim()) return setCreateError('Last name is required.');
    if (!email.trim()) return setCreateError('Email address is required.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return setCreateError('Please enter a valid email address.');
    if (!password.trim()) return setCreateError('Password is required.');
    if (password.trim().length < 6) return setCreateError('Password must be at least 6 characters.');

    if (!isSupabaseConfigured) {
      setCreateError('Supabase is not configured. Cannot create admin accounts.');
      return;
    }

    setIsCreating(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      const cleanDept = department.trim() || 'General Operations';

      const tempAuthClient = createAdminAuthClient();
      if (!tempAuthClient) {
        setCreateError('Supabase authentication client is not available.');
        return;
      }

      // Step 1: Create Supabase Auth user
      const { data: signUpData, error: signUpError } = await tempAuthClient.auth.signUp({
        email: cleanEmail,
        password: password.trim(),
        options: {
          data: {
            first_name: cleanFirstName,
            last_name: cleanLastName,
            full_name: `${cleanFirstName} ${cleanLastName}`,
            role: 'admin',
            assigned_department: cleanDept,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
          setCreateError('An account with this email address already exists. Try searching for and promoting them instead.');
        } else {
          setCreateError(`Auth creation failed: ${signUpError.message}`);
        }
        return;
      }

      if (!signUpData?.user) {
        setCreateError('Auth user was not returned from Supabase. Please try again.');
        return;
      }

      const authUserId = signUpData.user.id;

      // Step 2: Upsert profile row in public.users with role='admin'
      const { error: profileError } = await supabase.from('users').upsert(
        {
          id: authUserId,
          email: cleanEmail,
          role: 'admin',
          first_name: cleanFirstName,
          last_name: cleanLastName,
          country: 'International',
          education_level: 'Undergraduate',
          institution: 'Scholavon Foundation',
          field_of_study: cleanDept,
          gpa: 4.0,
          gpa_scale: 4.0,
          profile_completion: 100,
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        setCreateError(
          `Administrator Auth account created, but database profile update failed: ${profileError.message}`
        );
        return;
      }

      // Step 3: Refresh admin list
      await loadAdmins();

      setIsAddModalOpen(false);
      setSuccessMessage(
        `Administrator account for ${cleanFirstName} ${cleanLastName} has been created successfully. They can now log in.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create administrator.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Revoke Admin privileges (demote to 'student') ──────────────────────────
  const handleConfirmRevoke = async () => {
    if (!revokingAdmin) return;

    if (admins.length <= 1) {
      setErrorMessage('Cannot revoke privileges: at least one active administrator must remain in the system.');
      setRevokingAdmin(null);
      return;
    }

    setIsRevoking(true);
    setErrorMessage(null);

    try {
      const res = await revokeAdminRole(revokingAdmin.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to revoke administrator privileges.');
        return;
      }

      await loadAdmins();
      const adminName = `${revokingAdmin.firstName} ${revokingAdmin.lastName}`.trim();
      setSuccessMessage(
        `Admin privileges revoked for ${adminName} (${revokingAdmin.email}). Their account has been converted back to a standard student account.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
      setRevokingAdmin(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while revoking admin privileges.');
    } finally {
      setIsRevoking(false);
    }
  };

  // Filter admins for main list
  const filteredAdmins = admins.filter((admin) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(q) ||
      admin.email.toLowerCase().includes(q) ||
      (admin.assignedDepartment ?? '').toLowerCase().includes(q)
    );
  });

  const openAddModal = (tab: 'promote' | 'create' = 'promote') => {
    setModalTab(tab);
    setUserSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setPromoteDepartment('Scholarship Operations');
    setPromoteError(null);

    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setDepartment('Platform Administration');
    setCreateError(null);

    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <ShieldCheck size={14} />
            <span>Admin Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Admin Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Manage multi-admin access, search and promote registered users to administrators, or revoke administrator privileges safely.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            id="btn-promote-admin"
            onClick={() => openAddModal('promote')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <UserCheck size={15} />
            <span>Promote User to Admin</span>
          </button>
          <button
            id="btn-create-admin"
            onClick={() => openAddModal('create')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus size={15} />
            <span>Create New Admin</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-emerald-950">Action Completed Successfully</span>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">{successMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-rose-950">System Notice</span>
              <p className="text-rose-800 mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-950 p-1 shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Multi-Admin Info Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 text-xs text-indigo-800 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-indigo-950 font-semibold">Role-Based Access Control: </strong>
          Admin roles are stored securely in the database. When an existing student is promoted, their profile, application history, and documents are preserved without creating a duplicate account.
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search administrators by name, email, or department..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium shrink-0">
          Total Active Administrators: <span className="font-bold text-slate-900">{admins.length}</span>
        </div>
      </div>

      {/* Current Admin Users Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {isLoadingList ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-xs">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading administrators from database…</span>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 text-xs">
            <ShieldCheck size={28} className="text-slate-300" />
            <span>No administrators found matching your search.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Added Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAdmins.map((admin) => {
                  const isCurrentSessionUser = currentAuthUser?.id === admin.id;
                  const isSoleAdmin = admins.length <= 1;

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {admin.firstName} {admin.lastName}
                          </span>
                          {isCurrentSessionUser && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" />
                          <span>{admin.email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {admin.assignedDepartment || 'Platform Operations'}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          <ShieldCheck size={12} className="text-amber-600" />
                          <span>Administrator</span>
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>
                            {admin.createdAt
                              ? new Date(admin.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setRevokingAdmin(admin)}
                          disabled={isSoleAdmin}
                          title={
                            isSoleAdmin
                              ? 'Cannot revoke privileges: at least one administrator must remain active.'
                              : `Revoke admin privileges from ${admin.firstName}`
                          }
                          className={`p-1.5 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold ${
                            isSoleAdmin
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                          }`}
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">Revoke Privileges</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Promote / Create Admin Modal ─────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  {modalTab === 'promote' ? <UserCheck size={20} /> : <UserPlus size={20} />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {modalTab === 'promote' ? 'Promote User to Administrator' : 'Create New Administrator'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {modalTab === 'promote'
                      ? 'Search registered users and upgrade their role with zero data loss'
                      : 'Create a brand new login account with administrator privileges'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                disabled={isPromoting || isCreating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 px-5 pt-2 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab('promote')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'promote'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck size={14} />
                <span>Promote Existing User</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('create')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'create'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus size={14} />
                <span>Create New Account</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: PROMOTE EXISTING USER */}
              {modalTab === 'promote' && (
                <div className="space-y-4">
                  {promoteError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{promoteError}</span>
                    </div>
                  )}

                  {!selectedUser ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                          Search User by Email or Name
                        </label>
                        <div className="relative">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => handleUserSearch(e.target.value)}
                            placeholder="Type email address (e.g. maria@university.edu) or name..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
                            autoFocus
                          />
                          {isSearchingUsers && (
                            <Loader2 size={15} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Search Results List */}
                      {userSearchQuery.trim().length > 0 && (
                        <div className="space-y-2 mt-3">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Search Results ({searchResults.length})
                          </span>

                          {searchResults.length === 0 && !isSearchingUsers && (
                            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                              No matching unregistered student accounts found for &ldquo;{userSearchQuery}&rdquo;.
                            </div>
                          )}

                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {searchResults.map((user) => (
                              <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-xs group-hover:text-indigo-700">
                                      {user.firstName} {user.lastName}
                                    </span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                      Student
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                    <Mail size={11} className="text-slate-400 shrink-0" />
                                    <span>{user.email}</span>
                                  </div>
                                  {(user.institution || user.fieldOfStudy) && (
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {[user.institution, user.fieldOfStudy].filter(Boolean).join(' • ')}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors"
                                >
                                  <span>Select</span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Step 2: Confirm Selected User Promotion */
                    <div className="space-y-4 animate-fade-in">
                      {/* User Summary Card */}
                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                              User Selected for Promotion
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                              {selectedUser.firstName} {selectedUser.lastName}
                            </h3>
                            <div className="text-xs text-indigo-900 font-medium flex items-center gap-1.5 mt-0.5">
                              <Mail size={12} className="text-indigo-600" />
                              <span>{selectedUser.email}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedUser(null)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                          >
                            Change User
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-indigo-100">
                          <div>
                            <span className="text-slate-400 block">Institution</span>
                            <span className="font-semibold text-slate-800">{selectedUser.institution || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Education Level</span>
                            <span className="font-semibold text-slate-800">{selectedUser.educationLevel || 'Undergraduate'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Assign Department */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Assign Department / Responsibility
                        </label>
                        <input
                          type="text"
                          value={promoteDepartment}
                          onChange={(e) => setPromoteDepartment(e.target.value)}
                          placeholder="e.g. Scholarship Auditing, Platform Operations"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Safety & Preservation Notice */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>Guaranteed Account Data Preservation</span>
                        </div>
                        <p className="text-[11px]">
                          Promoting this user immediately grants them access to the Admin Portal and scholarship verification queue. Their existing student profile, uploaded documents, and scholarship applications are fully preserved without creating a duplicate account.
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(null)}
                          disabled={isPromoting}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Back to Search
                        </button>
                        <button
                          type="button"
                          onClick={handlePromoteConfirm}
                          disabled={isPromoting}
                          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
                        >
                          {isPromoting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Promoting User…</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={15} />
                              <span>Confirm & Promote to Admin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CREATE BRAND NEW ADMIN ACCOUNT */}
              {modalTab === 'create' && (
                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  {createError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isCreating}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Eleanor"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isCreating}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Vance"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      disabled={isCreating}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. eleanor.vance@scholavon.org"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isCreating}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <Eye size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Assigned Department
                    </label>
                    <input
                      type="text"
                      disabled={isCreating}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Scholarship Auditing"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors disabled:opacity-60"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={isCreating}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isCreating || !isSupabaseConfigured}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Creating Account…</span>
                        </>
                      ) : (
                        <span>Create Admin Account</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke Admin Confirmation Dialog ─────────────────────────────────── */}
      {revokingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-fade-in p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Revoke Administrator Privileges
                </h3>
                <p className="text-xs text-slate-500">Confirm role modification</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to revoke administrator privileges from{' '}
              <strong className="text-slate-900">
                {revokingAdmin.firstName} {revokingAdmin.lastName}
              </strong>{' '}
              (<span className="text-indigo-600">{revokingAdmin.email}</span>)?
            </p>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <span className="font-bold block">What happens next:</span>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                <li>Their role will be changed from <strong>admin</strong> to <strong>student</strong>.</li>
                <li>They will immediately lose access to the Admin Portal and verification tools.</li>
                <li>On their next login, they will be routed to the Student Dashboard.</li>
                <li>Their account and historical records will remain intact.</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRevokingAdmin(null)}
                disabled={isRevoking}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              >
                {isRevoking ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Revoking Privileges…</span>
                  </>
                ) : (
                  <span>Yes, Revoke Admin Privileges</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
