import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Users, Search, GraduationCap, MapPin, CheckCircle2, Shield } from 'lucide-react';

interface AdminUsersPageProps {
  users: UserProfile[];
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ users }) => {
  const [query, setQuery] = useState('');

  const filtered = users.filter(u => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.institution.toLowerCase().includes(q) ||
      u.fieldOfStudy.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <Users size={14} />
            <span>Student Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Registered Student Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Overview of student profiles, education levels, and matching completion statistics.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 shadow-2xs transition-colors"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-4 py-3.5">Institution & Major</th>
                <th className="px-4 py-3.5">Level</th>
                <th className="px-4 py-3.5">GPA</th>
                <th className="px-4 py-3.5">Profile Ready</th>
                <th className="px-4 py-3.5">Country</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-900">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-800">{u.institution}</div>
                    <div className="text-[11px] text-indigo-600">{u.fieldOfStudy}</div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium">
                      {u.educationLevel}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-bold text-slate-900">
                    {u.gpa.toFixed(2)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full" 
                          style={{ width: `${u.profileCompletion}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600">{u.profileCompletion}%</span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {u.country}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
