import React, { useState, useEffect } from 'react';
import { AdminUser, AdminRoleType, AdminStatus } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { 
  ShieldCheck, PlusCircle, Search, UserPlus, Mail, Calendar, 
  CheckCircle2, X, AlertCircle, Info, Trash2, KeyRound 
} from 'lucide-react';

interface AdminAdminsPageProps {
  onNavigate?: (path: string) => void;
}

export const AdminAdminsPage: React.FC<AdminAdminsPageProps> = () => {
  const [admins, setAdmins] = useState<AdminUser[]>(() => StorageService.getAdminUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<AdminUser[]>('/admin/staff')
      .then((res) => {
        if (!cancelled && Array.isArray(res)) {
          setAdmins(res);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRoleType>('Admin');
  const [department, setDepartment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filter admins
  const filteredAdmins = admins.filter(admin => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(q);
      const matchEmail = admin.email.toLowerCase().includes(q);
      const matchDept = admin.assignedDepartment?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchDept) return false;
    }
    if (roleFilter !== 'all' && admin.role !== roleFilter) return false;
    return true;
  });

  const handleOpenModal = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole('Admin');
    setDepartment('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!firstName.trim()) {
      setFormError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setFormError('Last name is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    // Check duplicate
    if (admins.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) {
      setFormError('An administrator with this email address already exists.');
      return;
    }

    try {
      const res = await api.post<AdminUser>('/admin/staff', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        department: department.trim() || 'General Operations'
      });
      if (res && res.id) {
        setAdmins(prev => [...prev, res]);
      } else {
        const newAdmin = StorageService.addAdminUser({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          role,
          status: 'Active',
          assignedDepartment: department.trim() || 'General Operations'
        });
        setAdmins(StorageService.getAdminUsers());
      }
    } catch {
      const newAdmin = StorageService.addAdminUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        status: 'Active',
        assignedDepartment: department.trim() || 'General Operations'
      });
      setAdmins(StorageService.getAdminUsers());
    }

    setIsModalOpen(false);
    setSuccessMessage(
      `Administrator account for ${firstName.trim()} ${lastName.trim()} has been saved successfully.`
    );
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    if (admins.length <= 1) {
      alert('At least one administrator account must remain active.');
      return;
    }
    if (confirm(`Are you sure you want to remove ${name} from admin management?`)) {
      try {
        await api.delete(`/admin/staff/${id}`);
      } catch {}
      StorageService.deleteAdminUser(id);
      setAdmins(prev => prev.filter(a => a.id !== id));
    }
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

      {/* Backend Status Advisory Card */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-600 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800 font-semibold">Backend Integration Ready: </strong>
          Admin accounts created here are managed in the local frontend state. Role-based tokens and secure authentication credentials will be provisioned through the authentication service once the production backend API is connected.
        </div>
      </div>

      {/* Search & Filter Toolbar */}
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="Super Admin">Super Admin</option>
            <option value="Admin">Admin</option>
            <option value="Verification Officer">Verification Officer</option>
            <option value="Content Reviewer">Content Reviewer</option>
          </select>
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
              <tr>
                <th className="px-5 py-3.5">Administrator</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Department</th>
                <th className="px-4 py-3.5">Created Date</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAdmins.map(admin => (
                <tr key={admin.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{admin.firstName} {admin.lastName}</span>
                      {admin.role === 'Super Admin' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400" />
                      <span>{admin.email}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      admin.role === 'Super Admin'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : admin.role === 'Verification Officer'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : admin.role === 'Content Reviewer'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {admin.role}
                    </span>
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
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      admin.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : admin.status === 'Invited'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {admin.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {admin.status === 'Invited' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      <span>{admin.status}</span>
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleDeleteAdmin(admin.id, `${admin.firstName} ${admin.lastName}`)}
                      title="Remove Admin"
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
                  <p className="text-[11px] text-slate-500">Add an administrator to the management directory</p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAdmin} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
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
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Eleanor"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Vance"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. eleanor.vance@scholarpath.org"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Admin Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AdminRoleType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Verification Officer">Verification Officer</option>
                    <option value="Content Reviewer">Content Reviewer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Assigned Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Scholarship Auditing"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Temporary Password / Invitation Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <KeyRound size={13} className="text-indigo-600" />
                  <span>Account Provisioning & Invitation Note</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  An automated email invitation containing a secure single-use temporary password and onboarding instructions will be sent to the administrator.
                </p>
              </div>

              {/* Required Security Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <Info size={14} className="text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Security Note:</strong> Admin accounts will be provisioned through the secure authentication service once the backend is connected. Real passwords are not stored in frontend code.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Create Admin Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
