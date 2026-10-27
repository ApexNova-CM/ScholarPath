import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EducationLevel, ApplicantStage, APPLICANT_STAGE_LABELS } from '../../types';
import { Mail, Lock, User, GraduationCap, Building2, MapPin, Award, ArrowRight, AlertCircle, CheckCircle, Wrench, Briefcase, BookOpen } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { registerStudent, loginWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: 'United States',
    applicantStage: 'undergraduate' as ApplicantStage,
    educationLevel: 'Undergraduate' as EducationLevel,
    institution: '',
    fieldOfStudy: '',
    secondarySchoolName: '',
    secondaryGraduationYear: '',
    targetMajor: '',
    tradeSpecialization: '',
    tradeSkills: '',
    targetIndustry: '',
    yearsOfExperience: '0',
    earlyCareerSkills: '',
    portfolioUrl: '',
    linkedinUrl: '',
    includeGpa: false,
    gpa: '3.50',
  });

  const [gpaScaleOption, setGpaScaleOption] = useState<string>('5.0');
  const [customGpaScale, setCustomGpaScale] = useState<string>('5.0');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const getRedirectTarget = (): string | null => {
    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search);
      const target = params.get('redirect') || params.get('returnTo');
      if (target && target.startsWith('/') && !target.startsWith('//')) {
        return target;
      }
    } catch {}
    return null;
  };

  const handleGoogleRegister = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await loginWithGoogle('student');
      if (res.success) {
        const target = getRedirectTarget();
        onNavigate(target || '/dashboard');
      } else {
        setError(res.error || 'Google registration failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = (stage: ApplicantStage) => {
    let nextEduLevel: EducationLevel = 'Undergraduate';
    if (stage === 'secondary') nextEduLevel = 'High School';
    else if (stage === 'vocational') nextEduLevel = 'Vocational / Technical';
    else if (stage === 'postgraduate') nextEduLevel = 'Postgraduate (Masters)';
    else if (stage === 'early_career') nextEduLevel = 'Undergraduate';

    setFormData(prev => ({
      ...prev,
      applicantStage: stage,
      educationLevel: nextEduLevel,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let parsedGpa: number | undefined = undefined;
    let effectiveScale: number | undefined = undefined;

    if (formData.includeGpa && formData.gpa.trim() !== '') {
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

      const g = parseFloat(formData.gpa);
      if (isNaN(g) || g < 0) {
        setError('Please enter a valid non-negative CGPA.');
        return;
      }

      if (g > effectiveScale) {
        setError(`Current CGPA (${g.toFixed(2)}) cannot be greater than selected scale of ${effectiveScale.toFixed(2)}.`);
        return;
      }

      parsedGpa = g;
    }

    setIsLoading(true);

    try {
      const profilePayload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        country: formData.country,
        applicantStage: formData.applicantStage,
        gpa: parsedGpa,
        gpaScale: effectiveScale,
      };

      if (formData.applicantStage === 'secondary') {
        profilePayload.educationLevel = 'High School';
        profilePayload.secondarySchoolName = formData.secondarySchoolName.trim();
        if (formData.secondaryGraduationYear) {
          profilePayload.secondaryGraduationYear = parseInt(formData.secondaryGraduationYear, 10);
        }
        profilePayload.targetMajor = formData.targetMajor.trim() || undefined;
        profilePayload.institution = formData.secondarySchoolName.trim();
        profilePayload.fieldOfStudy = formData.targetMajor.trim() || undefined;
      } else if (formData.applicantStage === 'vocational') {
        profilePayload.educationLevel = 'Vocational / Technical';
        profilePayload.tradeSpecialization = formData.tradeSpecialization.trim();
        profilePayload.skills = formData.tradeSkills.split(',').map(s => s.trim()).filter(Boolean);
        profilePayload.institution = formData.institution.trim() || undefined;
        profilePayload.fieldOfStudy = formData.tradeSpecialization.trim();
      } else if (formData.applicantStage === 'early_career') {
        profilePayload.targetIndustry = formData.targetIndustry.trim();
        profilePayload.yearsOfExperience = parseInt(formData.yearsOfExperience, 10) || 0;
        profilePayload.skills = formData.earlyCareerSkills.split(',').map(s => s.trim()).filter(Boolean);
        profilePayload.portfolioUrl = formData.portfolioUrl.trim() || undefined;
        profilePayload.linkedinUrl = formData.linkedinUrl.trim() || undefined;
        profilePayload.institution = formData.institution.trim() || undefined;
        profilePayload.fieldOfStudy = formData.targetIndustry.trim();
      } else {
        // undergraduate or postgraduate
        profilePayload.educationLevel = formData.educationLevel;
        profilePayload.institution = formData.institution.trim();
        profilePayload.fieldOfStudy = formData.fieldOfStudy.trim();
      }

      const res = await registerStudent(profilePayload, formData.password);

      if (res.success) {
        if (res.requiresConfirmation) {
          // Email confirmation required — show confirmation screen
          setRegisteredEmail(formData.email);
          setConfirmationRequired(true);
        } else {
          const target = getRedirectTarget();
          onNavigate(target || '/dashboard');
        }
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Email confirmation screen
  if (confirmationRequired) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm space-y-6 max-w-xl mx-auto text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Check Your Email</h1>
            <p className="text-sm text-slate-600 mt-2">
              A confirmation link has been sent to:
            </p>
            <p className="text-sm font-bold text-indigo-700 mt-1 break-all">{registeredEmail}</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-left space-y-3">
          <p className="text-xs font-bold text-slate-800">Next steps:</p>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
            <li>Open the email from Scholavon in your inbox.</li>
            <li>Click the <span className="font-semibold">Confirm your email</span> link.</li>
            <li>You will be automatically redirected to your student dashboard.</li>
          </ol>
        </div>
        <p className="text-xs text-slate-500">
          Didn't receive an email? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => { setConfirmationRequired(false); setError(''); }}
            className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            go back
          </button>{' '}
          to try again.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
        >
          <span>Go to Sign In</span>
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }



  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm space-y-6 max-w-xl mx-auto">
      <div className="text-center space-y-1.5">
        <img
          src="/images/scholavon-logo.png"
          alt="Scholavon"
          className="h-16 sm:h-20 w-auto object-contain mx-auto mb-3"
        />
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Create Your Account
        </h1>
        <p className="text-xs text-slate-600">
          Set up your profile to discover scholarships, grants, fellowships, and career opportunities tailored to you.
        </p>
      </div>

      {/* Google Registration Option */}
      <button
        id="btn-register-google"
        type="button"
        onClick={handleGoogleRegister}
        disabled={isLoading}
        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-200 w-full" />
        <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 absolute">
          or register with email
        </span>
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
              placeholder="maria@example.com"
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

        {/* Pathway / Stage Selection */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Applicant Pathway / Category <span className="text-rose-500">*</span>
          </label>
          <select
            value={formData.applicantStage}
            onChange={(e) => handleStageChange(e.target.value as ApplicantStage)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-hidden focus:border-indigo-500 shadow-2xs"
          >
            <option value="undergraduate">Undergraduate Student (Universities & Polytechnics)</option>
            <option value="secondary">Secondary / High School Learner</option>
            <option value="postgraduate">Postgraduate Student or Researcher (Masters, PhD)</option>
            <option value="vocational">Vocational & Technical Trade Learner</option>
            <option value="early_career">Early-Career & Graduate Applicant</option>
          </select>
        </div>

        {/* Conditional Audience Details */}
        {formData.applicantStage === 'secondary' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Secondary School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.secondarySchoolName}
                onChange={(e) => setFormData({ ...formData, secondarySchoolName: e.target.value })}
                placeholder="e.g. King's College or West High School"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Graduation Year</label>
              <input
                type="number"
                min="1900"
                max="2100"
                value={formData.secondaryGraduationYear}
                onChange={(e) => setFormData({ ...formData, secondaryGraduationYear: e.target.value })}
                placeholder="e.g. 2026"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Intended Major / Stream</label>
              <input
                type="text"
                value={formData.targetMajor}
                onChange={(e) => setFormData({ ...formData, targetMajor: e.target.value })}
                placeholder="e.g. Engineering, Sciences, Arts"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {formData.applicantStage === 'vocational' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Trade Specialization / Craft <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.tradeSpecialization}
                onChange={(e) => setFormData({ ...formData, tradeSpecialization: e.target.value })}
                placeholder="e.g. Solar PV Systems, Welding, Automotive"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Training Center / College</label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="e.g. Technical Institute"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Key Practical Skills</label>
              <input
                type="text"
                value={formData.tradeSkills}
                onChange={(e) => setFormData({ ...formData, tradeSkills: e.target.value })}
                placeholder="e.g. Wiring, Inverter Sizing, Soldering"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {formData.applicantStage === 'early_career' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Industry <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.targetIndustry}
                onChange={(e) => setFormData({ ...formData, targetIndustry: e.target.value })}
                placeholder="e.g. Software Engineering, CleanTech"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Years of Experience</label>
              <input
                type="number"
                min="0"
                value={formData.yearsOfExperience}
                onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Core Professional Skills</label>
              <input
                type="text"
                value={formData.earlyCareerSkills}
                onChange={(e) => setFormData({ ...formData, earlyCareerSkills: e.target.value })}
                placeholder="e.g. TypeScript, React, Project Management (comma-separated)"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Portfolio Website (Optional)</label>
              <input
                type="url"
                value={formData.portfolioUrl}
                onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                placeholder="https://myportfolio.dev"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn Profile (Optional)</label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {(formData.applicantStage === 'undergraduate' || formData.applicantStage === 'postgraduate') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Education Level</label>
              <select
                value={formData.educationLevel}
                onChange={(e) => setFormData({ ...formData, educationLevel: e.target.value as EducationLevel })}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              >
                <option value="Undergraduate">Undergraduate (BSc, BA, HND, OND)</option>
                <option value="Postgraduate (Masters)">Postgraduate (Masters / MSc)</option>
                <option value="Doctorate (PhD)">Doctorate (PhD)</option>
                <option value="Postdoctoral">Postdoctoral Researcher</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Field of Study / Major <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fieldOfStudy}
                onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                placeholder="e.g. Computer Science, Nursing"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Institution <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="e.g. University of Lagos, University of Michigan"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* Optional Academic Grade / CGPA Section */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
            <input
              type="checkbox"
              checked={formData.includeGpa}
              onChange={(e) => setFormData({ ...formData, includeGpa: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span className="text-xs font-semibold text-slate-700">
              Include GPA / Academic Standing (Optional)
            </span>
          </label>

          {formData.includeGpa && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CGPA Scale</label>
                <select
                  value={gpaScaleOption}
                  onChange={(e) => setGpaScaleOption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                >
                  <option value="5.0">5.0 — Nigerian University Standard</option>
                  <option value="4.0">4.0 — 4-Point Scale</option>
                  <option value="7.0">7.0 — 7-Point Scale</option>
                  <option value="10.0">10.0 — 10-Point Scale</option>
                  <option value="Other">Other Scale</option>
                </select>
              </div>

              {gpaScaleOption === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custom Scale</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={customGpaScale}
                    onChange={(e) => setCustomGpaScale(e.target.value)}
                    placeholder="e.g. 6.0"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current CGPA</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.0"
                  value={formData.gpa}
                  onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
                  placeholder="e.g. 3.85"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        <div>
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3 rounded-xl bg-[#155EEF] hover:bg-[#124bbf] text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
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
          className="font-bold text-[#155EEF] hover:text-[#124bbf] cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
