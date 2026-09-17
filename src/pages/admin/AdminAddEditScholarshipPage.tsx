import React, { useState, useEffect } from 'react';
import { Scholarship, Provider, Category, EducationLevel, FundingType, AmountPeriod, DocumentType } from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { generateUUID } from '../../lib/uuid';
import { fetchDocumentTypes, fetchScholarshipRequiredDocs, saveScholarshipRequiredDocs } from '../../services/documentService';
import { 
  PlusCircle, ArrowLeft, Save, ShieldCheck, CheckCircle2, 
  Trash2, AlertCircle, Sparkles, Coins, RefreshCw 
} from 'lucide-react';

interface AdminAddEditScholarshipPageProps {
  scholarshipId?: string;
  scholarships: Scholarship[];
  providers: Provider[];
  categories: Category[];
  onNavigate: (path: string) => void;
  onScholarshipSaved: (scholarship: Scholarship) => void;
  onDeleteScholarship?: (id: string) => void;
}

const currencyOptions = [
  { code: 'NGN', symbol: '₦', label: 'NGN (₦) - Nigerian Naira' },
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$) - Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$) - Australian Dollar' },
];

const amountPeriodOptions: { value: AmountPeriod; label: string; suffix: string }[] = [
  { value: 'Annual', label: 'Annual (annually)', suffix: 'annually' },
  { value: 'Monthly', label: 'Monthly (monthly)', suffix: 'monthly' },
  { value: 'One-time', label: 'One-time', suffix: 'one-time' },
  { value: 'Renewable', label: 'Renewable', suffix: 'renewable' },
  { value: 'Per Semester', label: 'Per Semester', suffix: 'per semester' },
  { value: 'Unspecified', label: 'Unspecified', suffix: '' },
];

function formatSuggestedAmountDisplay(
  amount?: number | string,
  currency: string = 'NGN',
  period?: AmountPeriod | string
): string {
  if (amount === undefined || amount === '' || amount === null) {
    return '';
  }
  const num = Number(amount);
  if (isNaN(num) || num === 0) return '';
  const symbolMap: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
    CAD: 'CA$',
    AUD: 'A$',
  };
  const sym = symbolMap[currency] || `${currency} `;
  const formattedNumber = num.toLocaleString();
  const periodObj = amountPeriodOptions.find(p => p.value === period);
  const suffix = periodObj?.suffix ? ` ${periodObj.suffix}` : period && period !== 'Unspecified' ? ` ${period.toLowerCase()}` : '';
  return `${sym}${formattedNumber}${suffix}`;
}

export const AdminAddEditScholarshipPage: React.FC<AdminAddEditScholarshipPageProps> = ({
  scholarshipId,
  scholarships,
  providers,
  categories,
  onNavigate,
  onScholarshipSaved,
  onDeleteScholarship
}) => {
  const existing = scholarshipId ? scholarships.find(s => s.id === scholarshipId) : null;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Scholarship>>({
    title: existing?.title || '',
    providerName: existing?.providerName || '',
    providerId: existing?.providerId || generateUUID(),
    category: existing?.category || (categories[0]?.name || 'STEM & Tech'),
    fundingType: existing?.fundingType || 'Full',
    amount: existing?.amount !== undefined ? existing.amount : undefined,
    currency: existing?.currency || 'NGN',
    amountPeriod: existing?.amountPeriod || 'Annual',
    amountDisplay: existing?.amountDisplay || (existing?.amount ? formatSuggestedAmountDisplay(existing.amount, existing.currency || 'USD', existing.amountPeriod) : ''),
    deadline: existing?.deadline || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    educationLevels: existing?.educationLevels || ['Undergraduate', 'Postgraduate (Masters)'],
    fieldsOfStudy: existing?.fieldsOfStudy || ['Computer Science', 'Engineering', 'Data Science'],
    minimumGPA: existing?.minimumGPA ?? 3.5,
    gpaScale: existing?.gpaScale || 4.0,
    eligibleCountries: existing?.eligibleCountries || ['Nigeria', 'International'],
    description: existing?.description || '',
    shortDescription: existing?.shortDescription || '',
    applicationInstructions: existing?.applicationInstructions || 'Submit online via the official portal.',
    applicationUrl: existing?.applicationUrl || 'https://example.org/apply',
    requiredDocuments: existing?.requiredDocuments || ['Official Transcript', 'CV / Resume', 'Recommendation Letter 1'],
    tags: existing?.tags || ['STEM', 'Merit-based', 'Tuition Support'],
    verificationStatus: existing?.verificationStatus || 'pending_verification',
    status: existing?.status || 'active'
  });

  const [fieldsInput, setFieldsInput] = useState(formData.fieldsOfStudy?.join(', ') || '');
  const [countriesInput, setCountriesInput] = useState(formData.eligibleCountries?.join(', ') || '');
  const [docsInput, setDocsInput] = useState(formData.requiredDocuments?.join(', ') || '');
  const [tagsInput, setTagsInput] = useState(formData.tags?.join(', ') || '');
  const [isVerified, setIsVerified] = useState(formData.verificationStatus === 'verified');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasManuallyEditedDisplay, setHasManuallyEditedDisplay] = useState(Boolean(existing?.amountDisplay));

  const [dbDocTypes, setDbDocTypes] = useState<DocumentType[]>([]);
  const [selectedDocTypeIds, setSelectedDocTypeIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadDocTypes() {
      const types = await fetchDocumentTypes();
      setDbDocTypes(types);
      if (existing?.id) {
        const reqs = await fetchScholarshipRequiredDocs(existing.id);
        if (reqs.length > 0) {
          setSelectedDocTypeIds(reqs.map(r => r.documentTypeId));
        } else if (existing.requiredDocuments?.length) {
          // Pre-select matching types by name
          const matchedIds = types
            .filter(t => existing.requiredDocuments.some(rd => rd.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(rd.toLowerCase())))
            .map(t => t.id);
          setSelectedDocTypeIds(matchedIds);
        }
      }
    }
    loadDocTypes();
  }, [existing?.id]);

  const educationLevelOptions: EducationLevel[] = [
    'High School',
    'Undergraduate',
    'Postgraduate (Masters)',
    'Doctorate (PhD)',
    'Vocational / Technical',
    'Postdoctoral'
  ];

  const fundingTypeOptions: FundingType[] = [
    'Full',
    'Partial',
    'Stipend',
    'Grant',
    'Unspecified'
  ];

  // Auto-generate amountDisplay when amount, currency, or period changes if user hasn't typed custom display
  const updateAmountField = (amountVal: number | undefined, currVal: string, periodVal: string) => {
    const autoGen = formatSuggestedAmountDisplay(amountVal, currVal, periodVal);
    if (!hasManuallyEditedDisplay) {
      setFormData(prev => ({
        ...prev,
        amount: amountVal,
        currency: currVal,
        amountPeriod: periodVal as AmountPeriod,
        amountDisplay: autoGen
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        amount: amountVal,
        currency: currVal,
        amountPeriod: periodVal as AmountPeriod
      }));
    }
  };

  const toggleLevel = (lvl: EducationLevel) => {
    const current = formData.educationLevels || [];
    if (current.includes(lvl)) {
      setFormData({ ...formData, educationLevels: current.filter(l => l !== lvl) });
    } else {
      setFormData({ ...formData, educationLevels: [...current, lvl] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const preparedFields = fieldsInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedCountries = countriesInput.split(',').map(s => s.trim()).filter(Boolean);
    const selectedDocNames = selectedDocTypeIds
      .map(id => dbDocTypes.find(t => t.id === id)?.name)
      .filter(Boolean) as string[];
    const textDocs = docsInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedDocs = Array.from(new Set([...selectedDocNames, ...textDocs]));
    const preparedTags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);

    const scholarshipIdToSave = existing ? existing.id : generateUUID();

    const scholarshipToSave: Scholarship = {
      id: scholarshipIdToSave,
      title: formData.title || 'Untitled Scholarship',
      providerId: formData.providerId || generateUUID(),
      providerName: formData.providerName?.trim() || 'Provider Organization',
      category: formData.category || (categories[0]?.name || 'STEM & Tech'),
      fundingType: (formData.fundingType as FundingType) || 'Full',
      amount: formData.amount !== undefined && formData.amount !== null && !isNaN(Number(formData.amount)) ? Number(formData.amount) : undefined,
      currency: formData.currency || 'NGN',
      amountPeriod: formData.amountPeriod || 'Annual',
      amountDisplay: formData.amountDisplay?.trim() || (formData.amount ? formatSuggestedAmountDisplay(formData.amount, formData.currency, formData.amountPeriod) : ''),
      deadline: formData.deadline || new Date().toISOString(),
      educationLevels: formData.educationLevels && formData.educationLevels.length > 0 ? formData.educationLevels : ['Undergraduate'],
      fieldsOfStudy: preparedFields.length > 0 ? preparedFields : ['All'],
      minimumGPA: formData.minimumGPA !== undefined ? Number(formData.minimumGPA) : undefined,
      gpaScale: Number(formData.gpaScale) || 4.0,
      eligibleCountries: preparedCountries.length > 0 ? preparedCountries : ['All'],
      description: formData.description || '',
      shortDescription: formData.shortDescription || formData.description?.slice(0, 140) || '',
      applicationInstructions: formData.applicationInstructions || '',
      applicationUrl: formData.applicationUrl || '',
      requiredDocuments: preparedDocs,
      tags: preparedTags,
      verificationStatus: isVerified ? 'verified' : 'pending_verification',
      verifiedAt: isVerified ? (existing?.verifiedAt || new Date().toISOString()) : undefined,
      verifiedBy: isVerified ? (existing?.verifiedBy || 'Administrator') : undefined,
      status: formData.status || 'verified',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (existing) {
        await api.put(`/admin/scholarships/${existing.id}`, scholarshipToSave);
      } else {
        await api.post('/admin/scholarships', scholarshipToSave);
      }
    } catch (e) {
      console.error('Failed to save scholarship to API:', e);
    }

    if (selectedDocTypeIds.length > 0) {
      await saveScholarshipRequiredDocs(scholarshipIdToSave, selectedDocTypeIds, dbDocTypes);
    }

    StorageService.saveScholarship(scholarshipToSave);
    onScholarshipSaved(scholarshipToSave);
    setSaveSuccess(true);
    setTimeout(() => {
      onNavigate('/admin/scholarships');
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('/admin/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Scholarships List</span>
        </button>

        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
          {existing ? 'Edit Opportunity' : 'New Scholarship Opportunity'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {existing ? `Edit: ${existing.title}` : 'Add Scholarship'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Configure eligibility constraints, funding parameters, and verified audit badges.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Scholarship saved and synced across discovery and matching engines!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Basic Identifiers */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            1. Basic Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scholarship Title</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Mastercard Foundation Scholars Program"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Provider Organization</label>
                <input
                  type="text"
                  required
                  value={formData.providerName}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      providerName: e.target.value,
                    });
                  }}
                  placeholder="e.g. Shell Nigeria, Mastercard Foundation, Chevening Secretariat"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Free-text input for organization, foundation, university, or donor name.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Short Description (1-2 sentences for cards)</label>
              <input
                type="text"
                required
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                placeholder="Brief summary for discovery cards..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Detailed Description</label>
              <textarea
                rows={4}
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed eligibility terms, foundation history, and award conditions..."
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Funding & Deadline */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Coins size={15} />
              <span>2. Funding & Deadlines</span>
            </h2>
            <span className="text-[11px] text-slate-500">Specify award scope and deadline</span>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Funding Type */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Funding Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.fundingType}
                  onChange={(e) => setFormData({ ...formData, fundingType: e.target.value as FundingType })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {fundingTypeOptions.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Award Amount (Optional) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Award Amount <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.amount !== undefined ? formData.amount : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    updateAmountField(val, formData.currency || 'NGN', formData.amountPeriod || 'Annual');
                  }}
                  placeholder="e.g. 450000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                <select
                  value={formData.currency || 'NGN'}
                  onChange={(e) => {
                    const newCurr = e.target.value;
                    updateAmountField(formData.amount, newCurr, formData.amountPeriod || 'Annual');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {currencyOptions.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Amount Period */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount Period</label>
                <select
                  value={formData.amountPeriod || 'Annual'}
                  onChange={(e) => {
                    const newPeriod = e.target.value as AmountPeriod;
                    updateAmountField(formData.amount, formData.currency || 'NGN', newPeriod);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {amountPeriodOptions.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Amount Display with Auto Suggestion */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Amount Display (Public Label)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = formatSuggestedAmountDisplay(formData.amount, formData.currency || 'NGN', formData.amountPeriod || 'Annual');
                      setFormData(prev => ({ ...prev, amountDisplay: auto }));
                      setHasManuallyEditedDisplay(false);
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    <span>Auto-Format</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.amountDisplay || ''}
                  onChange={(e) => {
                    setHasManuallyEditedDisplay(true);
                    setFormData({ ...formData, amountDisplay: e.target.value });
                  }}
                  placeholder="e.g. ₦450,000 annually, Full Tuition + Stipend, or $15,000 / year"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  How this appears to students on cards and detail views (e.g. “₦450,000 annually”).
                </span>
              </div>

              {/* Application Deadline */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Application Deadline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Final date for student application submissions.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Eligibility Engine Constraints */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            3. Eligibility Constraints (For Deterministic Matching)
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Eligible Education Levels</label>
              <div className="flex flex-wrap gap-2">
                {educationLevelOptions.map(lvl => {
                  const checked = formData.educationLevels?.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => toggleLevel(lvl)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        checked
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Eligible Fields of Study (comma-separated)</label>
                <input
                  type="text"
                  value={fieldsInput}
                  onChange={(e) => setFieldsInput(e.target.value)}
                  placeholder="Computer Science, Software Engineering, AI"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Minimum GPA Required (0 for none)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="4.0"
                  value={formData.minimumGPA || ''}
                  onChange={(e) => setFormData({ ...formData, minimumGPA: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g. 3.50"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Eligible Countries (comma-separated or 'All')</label>
              <input
                type="text"
                value={countriesInput}
                onChange={(e) => setCountriesInput(e.target.value)}
                placeholder="United States, Canada, United Kingdom (or All)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Application Portal & Document Checklist */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            4. Official Portal & Requirements
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Application URL</label>
              <input
                type="url"
                required
                value={formData.applicationUrl}
                onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                placeholder="https://provider.org/scholarship/apply"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Required Documents Checklist</label>
              {dbDocTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {dbDocTypes.map(t => {
                    const isSelected = selectedDocTypeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDocTypeIds(selectedDocTypeIds.filter(id => id !== t.id));
                          } else {
                            setSelectedDocTypeIds([...selectedDocTypeIds, t.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Additional Custom Documents (comma-separated, optional)</label>
              <input
                type="text"
                value={docsInput}
                onChange={(e) => setDocsInput(e.target.value)}
                placeholder="Portfolio / Project Sample, Writing Sample"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Search Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="STEM, Merit, Underrepresented, Technology"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Audit & Verification Badge Control */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
            <ShieldCheck size={16} />
            <span>5. Administrative Verification Audit</span>
          </h2>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <div>
              <span className="font-semibold text-slate-900 block">Mark as Verified ✓</span>
              <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                Check this box only if the provider has been verified as legitimate, official URLs have been checked, and deadline validity has been confirmed.
              </span>
            </div>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div>
            {existing && onDeleteScholarship && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete Scholarship</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('/admin/scholarships')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save size={15} />
              <span>Save & Publish</span>
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && existing && onDeleteScholarship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Scholarship</h3>
                <p className="text-xs text-slate-500 mt-0.5">Permanent administrative removal</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold mb-1 truncate">"{existing.title}"</p>
              <p className="text-[11px] text-rose-700">
                Are you sure you want to permanently delete this scholarship? This action will remove the opportunity from the database, search results, and student matching. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteScholarship(existing.id);
                  setShowDeleteModal(false);
                  onNavigate('/admin/scholarships');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
