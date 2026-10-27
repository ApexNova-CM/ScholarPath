import React, { useState, useCallback, useMemo } from 'react';
import { UserProfile, EducationLevel, ApplicantStage, APPLICANT_STAGE_LABELS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  User, GraduationCap, Building2, MapPin, Award,
  CheckCircle2, Save, BookOpen, Briefcase, Heart,
  Target, FileText, ChevronDown, ChevronUp, AlertCircle,
  Wrench, Globe, Link, Compass
} from 'lucide-react';

import { calculateProfileCompletion } from '../../utils/formatters';

interface ProfilePageProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

function getCompletionFields(p: Partial<UserProfile>) {
  const common = [
    { label: 'First & Last Name', met: !!(p.firstName?.trim() && p.lastName?.trim()) },
    { label: 'Email Address', met: !!p.email?.trim() },
    { label: 'Phone Number', met: !!p.phone?.trim() },
    { label: 'Date of Birth', met: !!p.dateOfBirth?.trim() },
    { label: 'Country & Region', met: !!(p.country?.trim() && p.country.trim().toLowerCase() !== 'international') },
  ];

  const stage = p.applicantStage;
  if (stage === 'secondary') {
    return [
      ...common,
      { label: 'Secondary School Name', met: !!p.secondarySchoolName?.trim() },
      { label: 'Target Major / Stream', met: !!(p.targetMajor?.trim() || p.fieldOfStudy?.trim()) },
      { label: 'Graduation Year', met: !!p.secondaryGraduationYear },
      { label: 'Career Goals', met: !!p.careerGoals?.trim() },
      { label: 'Personal Statement', met: !!p.personalStatement?.trim() },
    ];
  }

  if (stage === 'vocational') {
    return [
      ...common,
      { label: 'Trade Specialization', met: !!p.tradeSpecialization?.trim() },
      { label: 'Technical Skills', met: !!(p.skills && p.skills.length > 0) },
      { label: 'Trade Certifications / Center', met: !!((p.tradeCertifications && p.tradeCertifications.length > 0) || p.institution?.trim()) },
      { label: 'Career Goals', met: !!p.careerGoals?.trim() },
      { label: 'Personal Statement', met: !!p.personalStatement?.trim() },
    ];
  }

  if (stage === 'early_career') {
    return [
      ...common,
      { label: 'Target Industry', met: !!p.targetIndustry?.trim() },
      { label: 'Professional Skills', met: !!(p.skills && p.skills.length > 0) },
      { label: 'Portfolio / LinkedIn', met: !!(p.portfolioUrl?.trim() || p.linkedinUrl?.trim() || p.githubUrl?.trim()) },
      { label: 'Career Goals', met: !!p.careerGoals?.trim() },
      { label: 'Personal Statement', met: !!p.personalStatement?.trim() },
    ];
  }

  // undergraduate, postgraduate, or legacy profile
  return [
    ...common,
    { label: 'Institution', met: !!(p.institution?.trim() && p.institution.trim() !== 'Scholavon Foundation') },
    { label: 'Education Level', met: !!p.educationLevel?.trim() },
    { label: 'Field of Study', met: !!(p.fieldOfStudy?.trim() && p.fieldOfStudy.trim() !== 'Platform Operations' && p.fieldOfStudy.trim() !== 'Platform Administration') },
    { label: 'GPA or Expected Graduation', met: !!((p.gpa !== undefined && p.gpa !== null && Number(p.gpa) > 0) || p.expectedGraduationDate || p.graduationYear) },
    { label: 'Career Goals', met: !!p.careerGoals?.trim() },
    { label: 'Personal Statement', met: !!p.personalStatement?.trim() },
  ];
}

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-colors';
const TEXTAREA_CLASS =
  'w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-colors resize-none leading-relaxed';
const LABEL_CLASS = 'block font-semibold text-slate-700 mb-1 text-xs';

function SectionCard({
  icon, title, children, defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-600">{icon}</span>
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 space-y-4">{children}</div>}
    </div>
  );
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, onUpdateProfile }) => {
  const { updateUserProfile } = useAuth();
  const [formData, setFormData] = useState<UserProfile>({ ...userProfile });
  const [scaleOption, setScaleOption] = useState<string>(() =>
    userProfile.gpaScale && [5.0, 4.0, 7.0, 10.0].includes(userProfile.gpaScale)
      ? userProfile.gpaScale.toString()
      : (userProfile.gpaScale ? 'Other' : '5.0')
  );
  const [customScale, setCustomScale] = useState<string>(() =>
    userProfile.gpaScale && [5.0, 4.0, 7.0, 10.0].includes(userProfile.gpaScale) ? '' : (userProfile.gpaScale?.toString() || '')
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    setFormData({ ...userProfile });
    const option = userProfile.gpaScale && [5.0, 4.0, 7.0, 10.0].includes(userProfile.gpaScale)
      ? userProfile.gpaScale.toString()
      : (userProfile.gpaScale ? 'Other' : '5.0');
    setScaleOption(option);
    setCustomScale(userProfile.gpaScale && [5.0, 4.0, 7.0, 10.0].includes(userProfile.gpaScale) ? '' : (userProfile.gpaScale?.toString() || ''));
  }, [userProfile]);

  const completion = calculateProfileCompletion(formData);
  const missingFields = useMemo(() => {
    return getCompletionFields(formData).filter((f) => !f.met);
  }, [formData]);

  const set = useCallback(<K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setArr = useCallback((key: keyof UserProfile, raw: string) => {
    const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, [key]: arr }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    let parsedGpa: number | undefined = undefined;
    let effectiveScale: number | undefined = undefined;

    // Only validate GPA if a value is supplied
    if (formData.gpa !== undefined && formData.gpa !== null && String(formData.gpa).trim() !== '') {
      if (scaleOption === 'Other') {
        const parsedCustom = parseFloat(customScale);
        if (isNaN(parsedCustom) || parsedCustom <= 0) {
          setSaveError('Please enter a valid custom CGPA scale greater than 0.');
          return;
        }
        effectiveScale = parsedCustom;
      } else {
        effectiveScale = parseFloat(scaleOption);
      }

      const g = Number(formData.gpa);
      if (isNaN(g) || g < 0) {
        setSaveError('Please enter a valid non-negative CGPA.');
        return;
      }

      if (g > effectiveScale) {
        setSaveError(`Current CGPA (${g.toFixed(2)}) cannot be greater than your selected scale of ${effectiveScale.toFixed(2)}.`);
        return;
      }
      parsedGpa = g;
    }

    setIsSaving(true);
    try {
      const mergedForm: UserProfile = {
        ...formData,
        gpa: parsedGpa,
        gpaScale: effectiveScale,
      };
      const newCompletion = calculateProfileCompletion(mergedForm);
      const updated: UserProfile = {
        ...mergedForm,
        profileCompletion: newCompletion,
        updatedAt: new Date().toISOString(),
      };

      // Save to Supabase directly
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('users').upsert({
          id: updated.id,
          email: updated.email,
          first_name: updated.firstName,
          last_name: updated.lastName,
          phone: updated.phone || null,
          date_of_birth: updated.dateOfBirth || null,
          gender: updated.gender || null,
          country: updated.country,
          state: updated.state || null,
          city: updated.city || null,
          applicant_stage: updated.applicantStage || null,
          secondary_school_name: updated.secondarySchoolName || null,
          secondary_graduation_year: updated.secondaryGraduationYear || null,
          target_major: updated.targetMajor || null,
          trade_specialization: updated.tradeSpecialization || null,
          trade_certifications: updated.tradeCertifications || [],
          years_of_experience: updated.yearsOfExperience || 0,
          target_industry: updated.targetIndustry || null,
          skills: updated.skills || [],
          portfolio_url: updated.portfolioUrl || null,
          linkedin_url: updated.linkedinUrl || null,
          github_url: updated.githubUrl || null,
          education_level: updated.educationLevel || null,
          institution: updated.institution || '',
          course: updated.course || null,
          field_of_study: updated.fieldOfStudy || '',
          year_level: updated.yearLevel || null,
          graduation_year: updated.graduationYear || null,
          expected_graduation_date: updated.expectedGraduationDate || null,
          previous_institution: updated.previousInstitution || null,
          gpa: updated.gpa !== undefined ? updated.gpa : null,
          gpa_scale: updated.gpaScale !== undefined ? updated.gpaScale : null,
          financial_need: updated.financialNeed || false,
          awards: updated.awards || [],
          achievements: updated.achievements || [],
          extracurriculars: updated.extracurriculars || [],
          certifications: updated.certifications || [],
          leadership: updated.leadership || [],
          volunteering: updated.volunteering || [],
          work_experience: updated.workExperience || [],
          career_goals: updated.careerGoals || null,
          personal_statement: updated.personalStatement || null,
          profile_completion: newCompletion,
          updated_at: updated.updatedAt,
        }, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }

      await updateUserProfile(updated);
      onUpdateProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const completionColor =
    completion >= 80 ? 'from-emerald-500 to-emerald-400' :
    completion >= 50 ? 'from-indigo-500 to-indigo-400' :
    'from-amber-500 to-amber-400';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <User size={14} />
            <span>Profile Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Applicant Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
            Manage your personal background, educational pathway, and professional achievements for personalized opportunity matching.
          </p>
        </div>

        {/* Completion Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 w-full sm:w-72 shadow-xs shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
            <span>Profile Completion</span>
            <span className={completion >= 80 ? 'text-emerald-600' : completion >= 50 ? 'text-indigo-600' : 'text-amber-600'}>
              {completion}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full bg-gradient-to-r ${completionColor} rounded-full transition-all duration-500`}
              style={{ width: `${completion}%` }}
            />
          </div>
          {missingFields.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Missing:</p>
              {missingFields.slice(0, 4).map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{f.label}</span>
                </div>
              ))}
              {missingFields.length > 4 && (
                <p className="text-[10px] text-slate-400">+{missingFields.length - 4} more fields</p>
              )}
            </div>
          )}
          {missingFields.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 size={14} />
              <span>Profile is fully complete!</span>
            </div>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span>Profile saved successfully. Your information will be pre-filled on future applications.</span>
        </div>
      )}
      {saveError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">

        {/* ── Applicant Pathway / Stage ── */}
        <SectionCard icon={<Compass size={16} />} title="Applicant Pathway & Category">
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Current Pathway / Education Stage</label>
              <select
                value={formData.applicantStage || 'undergraduate'}
                onChange={(e) => set('applicantStage', e.target.value as ApplicantStage)}
                className={INPUT_CLASS}
              >
                <option value="undergraduate">Undergraduate Student (Universities, Colleges, Polytechnics)</option>
                <option value="secondary">Secondary / High School Learner</option>
                <option value="postgraduate">Postgraduate Student or Researcher (Masters, PhD, Postdoc)</option>
                <option value="vocational">Vocational & Technical Trade Learner</option>
                <option value="early_career">Early-Career & Graduate Applicant</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Changing your pathway customizes the profile fields and matches you with relevant opportunities.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Personal Information ── */}
        <SectionCard icon={<User size={16} />} title="Personal Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>First Name <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.firstName}
                onChange={(e) => set('firstName', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Last Name <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.lastName}
                onChange={(e) => set('lastName', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Email Address <span className="text-rose-500">*</span></label>
              <input type="email" required value={formData.email}
                onChange={(e) => set('email', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Phone Number</label>
              <input type="tel" value={formData.phone || ''}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+234 800 000 0000" className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Date of Birth</label>
              <input type="date" value={formData.dateOfBirth ? formData.dateOfBirth.slice(0, 10) : ''}
                onChange={(e) => set('dateOfBirth', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Gender</label>
              <select value={formData.gender || ''} onChange={(e) => set('gender', e.target.value as UserProfile['gender'])} className={INPUT_CLASS}>
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-Binary">Non-Binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Country <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="e.g. Nigeria" className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>State / Province</label>
              <input type="text" value={formData.state || ''}
                onChange={(e) => set('state', e.target.value)}
                placeholder="e.g. Lagos" className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>City</label>
              <input type="text" value={formData.city || ''}
                onChange={(e) => set('city', e.target.value)}
                placeholder="e.g. Ikeja" className={INPUT_CLASS} />
            </div>
          </div>
        </SectionCard>

        {/* ── Secondary School Section ── */}
        {formData.applicantStage === 'secondary' && (
          <SectionCard icon={<BookOpen size={16} />} title="Secondary Education Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Secondary School / High School Name <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.secondarySchoolName || ''}
                  onChange={(e) => {
                    set('secondarySchoolName', e.target.value);
                    if (!formData.institution) set('institution', e.target.value);
                  }}
                  placeholder="e.g. King's College Lagos" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Graduation Year</label>
                <input type="number" min="1900" max="2100"
                  value={formData.secondaryGraduationYear || ''}
                  onChange={(e) => set('secondaryGraduationYear', parseInt(e.target.value, 10) || undefined)}
                  placeholder="e.g. 2026" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Intended Major / Stream</label>
                <input type="text" value={formData.targetMajor || ''}
                  onChange={(e) => {
                    set('targetMajor', e.target.value);
                    if (!formData.fieldOfStudy) set('fieldOfStudy', e.target.value);
                  }}
                  placeholder="e.g. Mechatronics, Computer Science, Law" className={INPUT_CLASS} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Vocational & Trade Section ── */}
        {formData.applicantStage === 'vocational' && (
          <SectionCard icon={<Wrench size={16} />} title="Vocational & Trade Training">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Trade Specialization / Craft <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.tradeSpecialization || ''}
                  onChange={(e) => {
                    set('tradeSpecialization', e.target.value);
                    if (!formData.fieldOfStudy) set('fieldOfStudy', e.target.value);
                  }}
                  placeholder="e.g. Solar PV Installation, Industrial Welding" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Technical Training Institute / Center</label>
                <input type="text" value={formData.institution || ''}
                  onChange={(e) => set('institution', e.target.value)}
                  placeholder="e.g. Government Technical College" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Trade Certifications (comma-separated)</label>
                <input type="text" value={formData.tradeCertifications?.join(', ') || ''}
                  onChange={(e) => setArr('tradeCertifications', e.target.value)}
                  placeholder="e.g. NABTEB Modular, City & Guilds" className={INPUT_CLASS} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Early-Career Section ── */}
        {formData.applicantStage === 'early_career' && (
          <SectionCard icon={<Briefcase size={16} />} title="Early-Career & Professional Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Target Industry / Sector <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.targetIndustry || ''}
                  onChange={(e) => {
                    set('targetIndustry', e.target.value);
                    if (!formData.fieldOfStudy) set('fieldOfStudy', e.target.value);
                  }}
                  placeholder="e.g. Software Engineering, Renewable Energy" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Years of Experience</label>
                <input type="number" min="0" value={formData.yearsOfExperience ?? 0}
                  onChange={(e) => set('yearsOfExperience', parseInt(e.target.value, 10) || 0)}
                  placeholder="0" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Past Institution / Alma Mater (Optional)</label>
                <input type="text" value={formData.institution || ''}
                  onChange={(e) => set('institution', e.target.value)}
                  placeholder="e.g. Obafemi Awolowo University" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Graduation Year (Optional)</label>
                <input type="number" min="1900" max="2100" value={formData.graduationYear || ''}
                  onChange={(e) => set('graduationYear', parseInt(e.target.value, 10) || undefined)}
                  placeholder="e.g. 2024" className={INPUT_CLASS} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Academic Details (Undergraduate, Postgraduate, or unspecified legacy) ── */}
        {(formData.applicantStage === 'undergraduate' || formData.applicantStage === 'postgraduate' || !formData.applicantStage) && (
          <SectionCard icon={<GraduationCap size={16} />} title="Academic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Current Institution <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.institution || ''}
                  onChange={(e) => set('institution', e.target.value)}
                  placeholder="e.g. University of Lagos" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Course / Programme</label>
                <input type="text" value={formData.course || ''}
                  onChange={(e) => set('course', e.target.value)}
                  placeholder="e.g. BSc Computer Science" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Field of Study / Major <span className="text-rose-500">*</span></label>
                <input type="text" required value={formData.fieldOfStudy || ''}
                  onChange={(e) => set('fieldOfStudy', e.target.value)}
                  placeholder="e.g. Computer Science" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Education Level</label>
                <select value={formData.educationLevel || 'Undergraduate'}
                  onChange={(e) => set('educationLevel', e.target.value as EducationLevel)}
                  className={INPUT_CLASS}>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Postgraduate (Masters)">Postgraduate (Masters)</option>
                  <option value="Doctorate (PhD)">Doctorate (PhD)</option>
                  <option value="Postdoctoral">Postdoctoral</option>
                  <option value="Vocational / Technical">Vocational / Technical</option>
                  <option value="High School">High School</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Current Year / Level</label>
                <input type="text" value={formData.yearLevel || ''}
                  onChange={(e) => set('yearLevel', e.target.value)}
                  placeholder="e.g. Year 2, 300 Level" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Expected Graduation Date</label>
                <input type="date" value={formData.expectedGraduationDate ? formData.expectedGraduationDate.slice(0, 10) : ''}
                  onChange={(e) => set('expectedGraduationDate', e.target.value)} className={INPUT_CLASS} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>Previous Institution (if applicable)</label>
                <input type="text" value={formData.previousInstitution || ''}
                  onChange={(e) => set('previousInstitution', e.target.value)}
                  placeholder="e.g. Federal Government College, Abuja" className={INPUT_CLASS} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Academic Grading / GPA (Optional) ── */}
        <SectionCard icon={<Award size={16} />} title="Academic Standing & Grades (Optional)" defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">Provide your CGPA if applicable to your institution or target opportunities.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>CGPA Scale</label>
              <select value={scaleOption}
                onChange={(e) => setScaleOption(e.target.value)}
                className={INPUT_CLASS}>
                <option value="5.0">5.0 — Nigerian University Standard</option>
                <option value="4.0">4.0 — 4-Point Scale</option>
                <option value="7.0">7.0 — 7-Point Scale</option>
                <option value="10.0">10.0 — 10-Point Scale</option>
                <option value="Other">Other — My institution uses another scale</option>
              </select>
            </div>
            {scaleOption === 'Other' && (
              <div>
                <label className={LABEL_CLASS}>Custom CGPA Scale</label>
                <input type="number" step="0.1" min="0.1"
                  value={customScale}
                  onChange={(e) => setCustomScale(e.target.value)}
                  placeholder="e.g. 6.0" className={INPUT_CLASS} />
              </div>
            )}
            <div>
              <label className={LABEL_CLASS}>Current CGPA / Grade</label>
              <input type="number" step="0.01" min="0"
                value={formData.gpa ?? ''}
                onChange={(e) => set('gpa', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g. 4.25" className={INPUT_CLASS} />
            </div>
          </div>
        </SectionCard>

        {/* ── Skills & Online Profiles ── */}
        <SectionCard icon={<Globe size={16} />} title="Skills & Web Presence" defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Skills & Capabilities (comma-separated)</label>
              <input type="text" value={formData.skills?.join(', ') || ''}
                onChange={(e) => setArr('skills', e.target.value)}
                placeholder="e.g. Python, Public Speaking, CAD Design, Project Management"
                className={INPUT_CLASS} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLASS}>Portfolio Website</label>
                <input type="url" value={formData.portfolioUrl || ''}
                  onChange={(e) => set('portfolioUrl', e.target.value)}
                  placeholder="https://portfolio.dev" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>LinkedIn Profile</label>
                <input type="url" value={formData.linkedinUrl || ''}
                  onChange={(e) => set('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/username" className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>GitHub Profile</label>
                <input type="url" value={formData.githubUrl || ''}
                  onChange={(e) => set('githubUrl', e.target.value)}
                  placeholder="https://github.com/username" className={INPUT_CLASS} />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Scholarship Profile ── */}
        <SectionCard icon={<Award size={16} />} title="Achievements, Honours & Certifications" defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">Enter each item separated by a comma.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Achievements & Honours</label>
              <input type="text" value={formData.achievements?.join(', ') || ''}
                onChange={(e) => setArr('achievements', e.target.value)}
                placeholder="Dean's List, Science Fair 2nd Place"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Awards</label>
              <input type="text" value={formData.awards?.join(', ') || ''}
                onChange={(e) => setArr('awards', e.target.value)}
                placeholder="Best Graduate Award, STEM Excellence Prize"
                className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Certifications</label>
              <input type="text" value={formData.certifications?.join(', ') || ''}
                onChange={(e) => setArr('certifications', e.target.value)}
                placeholder="AWS Cloud Practitioner, Google Data Analytics"
                className={INPUT_CLASS} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Briefcase size={16} />} title="Experience & Leadership" defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">Enter each item separated by a comma.</p>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Leadership Experience</label>
              <input type="text" value={formData.leadership?.join(', ') || ''}
                onChange={(e) => setArr('leadership', e.target.value)}
                placeholder="Student Union President, Debate Team Captain"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Work / Apprenticeship Experience</label>
              <input type="text" value={formData.workExperience?.join(', ') || ''}
                onChange={(e) => setArr('workExperience', e.target.value)}
                placeholder="Software Intern at TechCorp, Research Assistant"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Volunteer Experience</label>
              <input type="text" value={formData.volunteering?.join(', ') || ''}
                onChange={(e) => setArr('volunteering', e.target.value)}
                placeholder="Community Tutor, Youth Volunteer"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Extracurricular Activities</label>
              <input type="text" value={formData.extracurriculars?.join(', ') || ''}
                onChange={(e) => setArr('extracurriculars', e.target.value)}
                placeholder="Robotics Club, Chess Team, Drama Society"
                className={INPUT_CLASS} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Target size={16} />} title="Career Goals & Personal Statement" defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Career Goals</label>
              <textarea rows={3} value={formData.careerGoals || ''}
                onChange={(e) => set('careerGoals', e.target.value)}
                placeholder="Describe your career aspirations and how educational opportunities will support your path..."
                className={TEXTAREA_CLASS} />
              <p className="text-[11px] text-slate-400 mt-1">{formData.careerGoals?.length || 0} characters</p>
            </div>
            <div>
              <label className={LABEL_CLASS}>Personal Statement / About Me</label>
              <textarea rows={5} value={formData.personalStatement || ''}
                onChange={(e) => set('personalStatement', e.target.value)}
                placeholder="Write a brief personal statement about your journey, challenges you've overcome, and your vision..."
                className={TEXTAREA_CLASS} />
              <p className="text-[11px] text-slate-400 mt-1">{formData.personalStatement?.length || 0} characters</p>
            </div>
          </div>
        </SectionCard>

        {/* ── Financial Information ── */}
        <SectionCard icon={<Heart size={16} />} title="Financial Need Consideration" defaultOpen={false}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="financialNeed"
              checked={formData.financialNeed || false}
              onChange={(e) => set('financialNeed', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="financialNeed" className="text-xs text-slate-700 font-medium cursor-pointer">
              I have demonstrated financial need and am seeking funding, bursaries, or financial assistance
            </label>
          </div>
        </SectionCard>

        {/* ── Submit ── */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Profile completion: <span className="font-bold text-slate-800">{completion}%</span>
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
