import React from 'react';
import { Application } from '../../types';
import { FileSpreadsheet, ExternalLink, Calendar } from 'lucide-react';

interface AdminApplicationsPageProps {
  applications: Application[];
}

export const AdminApplicationsPage: React.FC<AdminApplicationsPageProps> = ({ applications }) => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
          <FileSpreadsheet size={14} />
          <span>Application Records</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Platform Application Activity Ledger
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Monitor aggregated scholarship applications created and tracked across all student users.
        </p>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/90">
              <tr>
                <th className="px-5 py-3.5">Scholarship</th>
                <th className="px-4 py-3.5">Provider</th>
                <th className="px-4 py-3.5">User ID</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Deadline</th>
                <th className="px-5 py-3.5">Tracked Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-900">
                    {app.scholarshipTitle}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {app.providerName}
                  </td>

                  <td className="px-4 py-4 font-mono text-[11px] text-slate-500">
                    {app.userId}
                  </td>

                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                      app.status === 'Awarded' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      app.status === 'Interview' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                      app.status === 'Under Review' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      app.status === 'Applied' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                      'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {app.status}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {app.deadline.split('T')[0]}
                  </td>

                  <td className="px-5 py-4 text-slate-500 max-w-xs truncate italic">
                    {app.notes || '—'}
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
