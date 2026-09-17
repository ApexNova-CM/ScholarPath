import React, { useState } from 'react';
import { Provider } from '../../types';
import { api } from '../../lib/apiClient';
import { generateUUID } from '../../lib/uuid';
import { 
  Building2, Plus, CheckCircle2, Globe, Mail, 
  MapPin, ExternalLink, X, Shield 
} from 'lucide-react';

interface AdminProvidersPageProps {
  providers: Provider[];
  onProvidersChange: (providers: Provider[]) => void;
}

export const AdminProvidersPage: React.FC<AdminProvidersPageProps> = ({
  providers,
  onProvidersChange
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Foundation');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [country, setCountry] = useState('United States');

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await api.post<Provider>('/admin/providers', {
        name: name.trim(),
        type,
        website: website || 'https://example.org',
        contactEmail: contactEmail || 'contact@example.org',
        country,
      });
      if (res && res.id) {
        onProvidersChange([...providers, res]);
        setShowModal(false);
        setName('');
        return;
      }
    } catch {}

    const newProvider: Provider = {
      id: generateUUID(),
      name: name.trim(),
      type,
      website: website || 'https://example.org',
      contactEmail: contactEmail || 'contact@example.org',
      country,
      verified: true,
      description: `${type} funding legitimate higher education endowments.`
    };

    onProvidersChange([...providers, newProvider]);
    setShowModal(false);
    setName('');
  };

  const toggleVerify = (id: string) => {
    const updated = providers.map(p => p.id === id ? { ...p, verified: !p.verified } : p);
    onProvidersChange(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <Building2 size={14} />
            <span>Organization Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scholarship Providers Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Maintain verified accreditation records for organizations funding listed awards.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Provider</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {providers.map(p => (
          <div key={p.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                <span className="text-[11px] text-slate-500">{p.type}</span>
              </div>
              <button
                onClick={() => toggleVerify(p.id)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                  p.verified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {p.verified ? 'Audited ✓' : 'Pending'}
              </button>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {p.description || 'Verified organization offering academic funding.'}
            </p>

            <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-slate-400" />
                <span>{p.country}</span>
              </div>
              {p.website && (
                <div className="flex items-center gap-2 text-indigo-600">
                  <Globe size={13} />
                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                    {p.website.replace('https://', '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-xs space-y-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Provider Organization</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddProvider} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bill & Melinda Gates Foundation"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Provider Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Foundation">Foundation</option>
                  <option value="University">University</option>
                  <option value="Government">Government / Federal Agency</option>
                  <option value="Corporation">Corporation</option>
                  <option value="Non-profit">Non-Profit Trust</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Website</label>
                <input
                  type="url"
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://foundation.org"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                >
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
