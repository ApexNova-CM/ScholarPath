import React, { useState, useEffect, useCallback } from 'react';
import { AdminUser, UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured, createAdminAuthClient } from '../../lib/supabase';
import {
  fetchAdminUsers,
  fetchNonAdminUsers,
  promoteUserToAdmin,
  revokeAdminRole,
} from '../../services/dataService';
import {
  ShieldCheck, Search, UserPlus, Mail, Calendar,
  CheckCircle2, X, AlertCircle, Info, Trash2, KeyRound, Eye, EyeOff,
  Loader2, UserCheck, ArrowRight, ShieldAlert, GraduationCap, Building2,
  Users, UserCog
} from 'lucide-react';

interface AdminAdminsPageProps {
  onNavigate?: (path: string) => void;
}

export const AdminAdminsPage: React.FC<AdminAdminsPageProps> = () => {
  const { user: currentAuthUser } = useAuth();
  
  // Administrators state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Non-Admin Registered Students state
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Promotion Modal & Action state
  const [userToPromote, setUserToPromote] = useState<UserProfile | null>(null);
  const [promoteDepartment, setPromoteDepartment] = useState('Scholarship Operations');
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Create New Admin Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('Platform Administration');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Revoke Admin Modal state
  const [revokingAdmin, setRevokingAdmin] = useState<AdminUser | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoadingAdmins(true);
    setIsLoadingStudents(true);
    try {
      const [adminList, studentList] = await Promise.all([
        fetchAdminUsers(),
        fetchNonAdminUsers(),
      ]);
      setAdmins(adminList);
      setStudents(studentList);
    } catch (err: any) {
      console.error('Failed to load user management data:', err);
    } finally {
      setIsLoadingAdmins(false);
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filtered Admins List ──────────────────────────────────────────────────
  const filteredAdmins = admins.filter((admin) => {
    if (!adminSearchQuery.trim()) return true;
    const q = adminSearchQuery.toLowerCase();
    return (
      `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(q) ||
      admin.email.toLowerCase().includes(q) ||
      (admin.assignedDepartment ?? '').toLowerCase().includes(q) ||
      admin.id.toLowerCase().includes(q)
    );
  });

  // ── Filtered Students List (excludes any who are admins) ───────────────────
  const adminIds = new Set(admins.map((a) => a.id));
  const adminEmails = new Set(admins.map((a) => a.email.toLowerCase()));

  const eligibleStudents = students.filter(
    (s) => !adminIds.has(s.id) && !adminEmails.has(s.email.toLowerCase()) && s.role !== 'admin'
  );

  const filteredStudents = eligibleStudents.filter((student) => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.toLowerCase();
    return (
      student.email.toLowerCase().includes(q) ||
      student.firstName.toLowerCase().includes(q) ||
      student.lastName.toLowerCase().includes(q) ||
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(q) ||
      (student.institution && student.institution.toLowerCase().includes(q)) ||
      (student.fieldOfStudy && student.fieldOfStudy.toLowerCase().includes(q)) ||
      student.id.toLowerCase().includes(q)
    );
  });

  // ── Handle Promote User ───────────────────────────────────────────────────
  const handleOpenPromote = (user: UserProfile) => {
    setUserToPromote(user);
    setPromoteDepartment(user.fieldOfStudy || 'Scholarship Operations');
    setPromoteError(null);
  };

  const handlePromoteConfirm = async () => {
    if (!userToPromote) return;
    setIsPromoting(true);
    setPromoteError(null);

    try {
      const res = await promoteUserToAdmin(userToPromote.id, promoteDepartment);
      if (!res.success) {
        setPromoteError(res.error || 'Failed to promote user to Administrator.');
        return;
      }

      await loadData();
      const fullName = `${userToPromote.firstName} ${userToPromote.lastName}`.trim();
      setSuccessMessage(
        `${fullName} (${userToPromote.email}) has been successfully promoted to Administrator. Their student profile, applications, and documents have been fully preserved.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
      setUserToPromote(null);
    } catch (err: any) {
      setPromoteError(err.message || 'An unexpected error occurred during promotion.');
    } finally {
      setIsPromoting(false);
    }
  };

  // ── Handle Create Brand New Admin ─────────────────────────────────────────
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
          setCreateError('An account with this email address already exists. You can promote them directly from the list below.');
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

      await loadData();
      setIsCreateModalOpen(false);
      setSuccessMessage(
        `Administrator account for ${cleanFirstName} ${cleanLastName} (${cleanEmail}) has been created successfully.`
      );
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create administrator.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Handle Revoke Admin ───────────────────────────────────────────────────
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

      await loadData();
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

  return (
    <div className="space-y-8">
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
            Manage administrative personnel, review permission levels, promote registered student accounts to administrators, or revoke privileges.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <a
            href="#section-promote-users"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <UserCheck size={15} />
            <span>Promote User to Admin</span>
          </a>
          <button
            id="btn-create-admin"
            onClick={() => {
              setFirstName('');
              setLastName('');
              setEmail('');
              setPassword('');
              setShowPassword(false);
              setDepartment('Platform Administration');
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
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

      {/* ===================================================================== */}
      {/* SECTION 1: CURRENT ADMINISTRATORS                                      */}
      {/* ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Current Administrators</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Users with active administrator permissions and access to the Admin Console.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Active Admins: <span className="font-bold text-slate-900">{admins.length}</span>
          </div>
        </div>

        {/* Search & Admin Table */}
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              placeholder="Filter administrators by name, email, or department..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {isLoadingAdmins ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-xs">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading administrators from database…</span>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-xs">
              <ShieldCheck size={28} className="text-slate-300" />
              <span>No administrators found matching your search.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
                  <tr>
                    <th className="px-5 py-3">Administrator</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Added Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAdmins.map((admin) => {
                    const isCurrentSessionUser = currentAuthUser?.id === admin.id;
                    const isSoleAdmin = admins.length <= 1;

                    return (
                      <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
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

                        <td className="px-4 py-3.5 text-slate-600">
                          {admin.assignedDepartment || 'Platform Operations'}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldCheck size={12} className="text-amber-600" />
                            <span>Administrator</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-slate-500">
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

                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
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
      </section>

      {/* ===================================================================== */}
      {/* SECTION 2: PROMOTE REGISTERED USERS TO ADMINISTRATOR                   */}
      {/* ===================================================================== */}
      <section id="section-promote-users" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Promote User to Admin</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any registered student account from the database to upgrade them to an Administrator. Existing profiles, documents, and applications are preserved.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Eligible Registered Users: <span className="font-bold text-slate-900">{eligibleStudents.length}</span>
          </div>
        </div>

        {/* Search Toolbar for Students */}
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs p-4 space-y-3">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder="Search registered users by name, email, student ID, department, or institution..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors shadow-2xs"
            />
          </div>

          {/* Students Table */}
          {isLoadingStudents ? (
            <div className="flex items-center justify-center gap-2 py-14 text-slate-500 text-xs">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading registered student accounts from database…</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                <Users size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No eligible users found.</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {studentSearchQuery.trim()
                  ? `No registered non-admin users match "${studentSearchQuery}".`
                  : 'Only registered users who are not already administrators can be promoted.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
                  <tr>
                    <th className="px-5 py-3">Student / User</th>
                    <th className="px-4 py-3">Institution & Major / Department</th>
                    <th className="px-4 py-3">Current Role</th>
                    <th className="px-4 py-3">Level / GPA</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail size={12} className="text-slate-400" />
                          <span>{student.email}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {student.id.slice(0, 8)}…
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          <span>{student.institution || '—'}</span>
                        </div>
                        {student.fieldOfStudy && (
                          <div className="text-[11px] text-indigo-600 mt-0.5 flex items-center gap-1">
                            <GraduationCap size={12} className="text-indigo-400" />
                            <span>{student.fieldOfStudy}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          <span>Student</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        <div>{student.educationLevel || 'Undergraduate'}</div>
                        {student.gpa > 0 && (
                          <div className="text-[10px] font-semibold text-slate-800 mt-0.5">
                            CGPA: {student.gpa.toFixed(2)} / {student.gpaScale || 4.0}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenPromote(student)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <UserCheck size={14} />
                          <span>Promote to Admin</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Promotion Confirmation Dialog ────────────────────────────────────── */}
      {userToPromote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <UserCheck size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Promote {userToPromote.firstName} {userToPromote.lastName} to Administrator?
                </h3>
                <p className="text-xs text-slate-500">Confirm role modification</p>
              </div>
            </div>

            {promoteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{promoteError}</span>
              </div>
            )}

            {/* User Details Preview */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Email Address</span>
                <span className="font-bold text-slate-900">{userToPromote.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">User ID</span>
                <span className="font-mono text-slate-700 text-[11px]">{userToPromote.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Role</span>
                <span className="font-bold text-slate-700">student → <span className="text-indigo-600">admin</span></span>
              </div>
              {userToPromote.institution && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Institution</span>
                  <span className="font-semibold text-slate-800">{userToPromote.institution}</span>
                </div>
              )}
            </div>

            {/* Department Assignment */}
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

            {/* Data Preservation Assurance */}
            <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200/90 text-[11px] text-indigo-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Existing Account Data Preserved</span>
              </span>
              <p className="text-indigo-800 leading-relaxed">
                The user&apos;s account, student profile, submitted applications, uploaded documents, and saved scholarships will remain intact. On their next sign-in, they will be automatically routed to the Admin Dashboard.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToPromote(null)}
                disabled={isPromoting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
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
                    <span>Promoting to Admin…</span>
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
        </div>
      )}

      {/* ── Create New Admin Modal ───────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Administrator</h3>
                  <p className="text-[11px] text-slate-500">Create a brand new login account with admin privileges</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

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

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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
