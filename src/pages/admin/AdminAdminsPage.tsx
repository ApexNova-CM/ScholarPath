import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRoleType } from '../../types';
import { supabase, isSupabaseConfigured, createAdminAuthClient } from '../../lib/supabase';
import {
  ShieldCheck, PlusCircle, Search, UserPlus, Mail, Calendar,
  CheckCircle2, X, AlertCircle, Info, Trash2, KeyRound, Eye, EyeOff, Loader2
} from 'lucide-react';

interface AdminAdminsPageProps {
  onNavigate?: (path: string) => void;
}

// Shape returned from public.users when role='admin'
interface AdminRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
  field_of_study?: string;
}

function rowToAdminUser(row: AdminRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: 'Admin' as AdminRoleType,
    status: 'Active',
    assignedDepartment: row.field_of_study || 'General Operations',
    createdAt: row.created_at,
  };
}

export const AdminAdminsPage: React.FC<AdminAdminsPageProps> = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Load all admin users from public.users in Supabase ──────────────────
  const loadAdmins = async () => {
    if (!isSupabaseConfigured) {
      setIsLoadingList(false);
      return;
    }
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, field_of_study, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load admin users:', error.message);
      } else if (data) {
        setAdmins(data.map(rowToAdminUser));
      }
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  // Filter admins
  const filteredAdmins = admins.filter((admin) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(q) ||
      admin.email.toLowerCase().includes(q) ||
      (admin.assignedDepartment ?? '').toLowerCase().includes(q)
    );
  });

  const handleOpenModal = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setDepartment('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isCreating) return; // prevent closing while creation is in progress
    setIsModalOpen(false);
    setFormError(null);
  };

  // ── Create admin: Supabase Auth user + public.users row with role='admin' ─
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!firstName.trim()) return setFormError('First name is required.');
    if (!lastName.trim()) return setFormError('Last name is required.');
    if (!email.trim()) return setFormError('Email address is required.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return setFormError('Please enter a valid email address.');
    if (!password.trim()) return setFormError('Password is required.');
    if (password.trim().length < 6) return setFormError('Password must be at least 6 characters.');

    if (!isSupabaseConfigured) {
      setFormError('Supabase is not configured. Cannot create admin accounts.');
      return;
    }

    setIsCreating(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFirstName = firstName.trim();
      const cleanLastName = lastName.trim();
      const cleanDept = department.trim() || 'General Operations';

      // Use isolated non-persisted client so creating an account doesn't overwrite active admin session!
      const tempAuthClient = createAdminAuthClient();
      if (!tempAuthClient) {
        setFormError('Supabase authentication client is not available.');
        return;
      }

      // ── Step 1: Create the Supabase Auth user ──────────────────────────
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
          setFormError('An account with this email address already exists in Supabase.');
        } else {
          setFormError(`Supabase Auth creation failed: ${signUpError.message}`);
        }
        return;
      }

      if (!signUpData?.user) {
        setFormError('Auth user was not returned from Supabase. Please try again.');
        return;
      }

      const authUserId = signUpData.user.id;

      // ── Step 2: Upsert a profile row in public.users with role='admin' ─
      // Run upsert using the active logged-in admin's main client instance
      const { error: profileError } = await supabase.from('users').upsert(
        {
          id: authUserId,
          email: cleanEmail,
          role: 'admin',
          first_name: cleanFirstName,
          last_name: cleanLastName,
          country: 'International',
          education_level: 'Undergraduate',
          institution: 'ScholarPath Foundation',
          field_of_study: cleanDept,
          gpa: 4.0,
          gpa_scale: 4.0,
          profile_completion: 100,
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        setFormError(
          `Administrator Auth account was created, but database profile creation failed: ${profileError.message}. ` +
          `Please ensure RLS policies permit admin profile creation.`
        );
        return;
      }

      // ── Step 3: Refresh the admin list from the database ───────────────
      await loadAdmins();

      setIsModalOpen(false);
      setSuccessMessage(
        `Administrator account for ${cleanFirstName} ${cleanLastName} has been created successfully. They can now log in with their email and password.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
    } finally {
      setIsCreating(false);
    }
  };


  // ── Remove admin: set role back to 'student' (or delete via service role) ─
  const handleDeleteAdmin = async (id: string, name: string) => {
    if (admins.length <= 1) {
      alert('At least one administrator account must remain active.');
      return;
    }
    if (!isSupabaseConfigured) return;
    if (!confirm(`Are you sure you want to remove admin access for ${name}? They will retain their account but lose admin privileges.`)) return;

    const { error } = await supabase
      .from('users')
      .update({ role: 'student' })
      .eq('id', id);

    if (error) {
      alert(`Failed to remove admin access: ${error.message}`);
      return;
    }

    setAdmins((prev) => prev.filter((a) => a.id !== id));
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
            Manage administrative personnel, review permission levels, and invite team members to review scholarships.
          </p>
        </div>

        <button
          id="btn-create-admin"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <UserPlus size={15} />
          <span>Create New Admin</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-emerald-950">Administrator Added</span>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">{successMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Supabase-powered info banner */}
      <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200/90 text-xs text-indigo-700 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-indigo-900 font-semibold">Supabase Auth: </strong>
          Admin accounts are stored permanently in Supabase Auth and the{' '}
          <code className="bg-indigo-100 px-1 py-0.5 rounded text-[10px]">public.users</code> table.
          Accounts persist across browser sessions, refreshes, and device restarts.
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or department..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {isLoadingList ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-xs">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading admin accounts from Supabase…</span>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 text-xs">
            <ShieldCheck size={28} className="text-slate-300" />
            <span>No admin accounts found.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Created Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{admin.firstName} {admin.lastName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Mail size={12} className="text-slate-400" />
                        <span>{admin.email}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {admin.assignedDepartment || 'Operations'}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{new Date(admin.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
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
                        onClick={() => handleDeleteAdmin(admin.id, `${admin.firstName} ${admin.lastName}`)}
                        title="Remove Admin Access"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create New Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Create New Administrator</h2>
                  <p className="text-[11px] text-slate-500">Creates a permanent Supabase Auth account with admin role</p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                disabled={isCreating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAdmin} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
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
                  placeholder="e.g. eleanor.vance@scholarpath.org"
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

              {/* Provisioning Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <KeyRound size={13} className="text-indigo-600" />
                  <span>What happens when you click Create</span>
                </div>
                <ol className="text-[11px] text-slate-600 leading-relaxed list-decimal list-inside space-y-0.5">
                  <li>A real Supabase Auth user is created with the email &amp; password.</li>
                  <li>A <code className="bg-slate-100 px-1 rounded">public.users</code> row is saved with <code className="bg-slate-100 px-1 rounded">role = 'admin'</code>.</li>
                  <li>The admin can log in immediately and their session will persist permanently.</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating || !isSupabaseConfigured}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create Admin Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
