import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EducationLevel } from '../../types';
import { Mail, Lock, User, GraduationCap, Building2, MapPin, Award, ArrowRight, AlertCircle } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { registerStudent } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: 'United States',
    educationLevel: 'Undergraduate' as EducationLevel,
    institution: '',
    fieldOfStudy: '',
    gpa: '3.50'
  });

  const [gpaScaleOption, setGpaScaleOption] = useState<string>('5.0');
  const [customGpaScale, setCustomGpaScale] = useState<string>('5.0');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let effectiveScale = 5.0;
    if (gpaScaleOption === 'Other') {
      const parsedCustom = parseFloat(customGpaScale);
      if (isNaN(parsedCustom) || parsedCustom <= 0) {
        setError('Please enter a valid custom CGPA scale greater than 0.');
        return;
      }
      effectiveScale = parsedCustom;
    } else {
      effectiveScale = parseFloat(gpaScaleOption);
    }

    const parsedGpa = parseFloat(formData.gpa);
    if (isNaN(parsedGpa) || parsedGpa < 0) {
      setError('Please enter a valid non-negative CGPA.');
      return;
    }

    if (parsedGpa > effectiveScale) {
      setError(`Current CGPA (${parsedGpa.toFixed(2)}) cannot be greater than your selected scale of ${effectiveScale.toFixed(2)}.`);
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerStudent({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        country: formData.country,
        educationLevel: formData.educationLevel,
        institution: formData.institution,
        fieldOfStudy: formData.fieldOfStudy,
        gpa: parsedGpa,
        gpaScale: effectiveScale
      }, formData.password);

      if (res.success) {
        onNavigate('/dashboard');
      } else {
        setError(res.error || 'Failed to create student account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm space-y-6 max-w-xl mx-auto">
      <div className="text-center space-y-1.5">
        <img
          src="/images/scholarpath-logo.png"
          alt="ScholarPath"
          className="h-16 sm:h-20 w-auto object-contain mx-auto mb-3"
        />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Create Student Account
        </h1>
        <p className="text-xs text-slate-600">
          Set up your academic profile to enable instant, deterministic scholarship matching.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="e.g. Maria"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="e.g. Santos"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="maria@university.edu"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Academic Details */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Education Level</label>
            <select
              value={formData.educationLevel}
              onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value as EducationLevel })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            >
              <option value="High School">High School</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Postgraduate (Masters)">Postgraduate (Masters)</option>
              <option value="Doctorate (PhD)">Doctorate (PhD)</option>
              <option value="Vocational / Technical">Vocational / Technical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Field of Study / Major</label>
            <input
              type="text"
              required
              value={formData.fieldOfStudy}
              onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
              placeholder="e.g. Computer Science, Nursing"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Current Institution</label>
            <input
              type="text"
              required
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              placeholder="e.g. University of Michigan"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CGPA Scale <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={gpaScaleOption}
              onChange={(e) => setGpaScaleOption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            >
              <option value="5.0">5.0 — Nigerian University Standard</option>
              <option value="4.0">4.0 — 4-Point Scale</option>
              <option value="7.0">7.0 — 7-Point Scale</option>
              <option value="10.0">10.0 — 10-Point Scale</option>
              <option value="Other">Other — My institution uses another scale</option>
            </select>
          </div>

          {gpaScaleOption === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom CGPA Scale <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={customGpaScale}
                onChange={(e) => setCustomGpaScale(e.target.value)}
                placeholder="e.g. 6.0 or 20"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Current CGPA <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.0"
              required
              value={formData.gpa}
              onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
              placeholder="e.g. 4.25"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Country of Citizenship / Residence</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            >
              <option value="United States">United States</option>
              <option value="Canada">Canada</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="India">India</option>
              <option value="Nigeria">Nigeria</option>
              <option value="Ghana">Ghana</option>
              <option value="Philippines">Philippines</option>
              <option value="International">Other / International</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span>Creating Profile...</span>
          ) : (
            <>
              <span>Complete Registration & Enter Portal</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-slate-500">
        Already have an account?{' '}
        <button
          onClick={() => onNavigate('/login')}
          className="font-bold text-indigo-600 hover:text-indigo-800"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
