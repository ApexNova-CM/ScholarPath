import React, { useState, useCallback } from 'react';
import { UserProfile, EducationLevel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  User, GraduationCap, Building2, MapPin, Award,
  CheckCircle2, Save, BookOpen, Briefcase, Heart,
  Target, FileText, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

interface ProfilePageProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

// Comprehensive profile completion calculator
function calcCompletion(p: Partial<UserProfile>): number {
  const checks: [boolean, number][] = [
    // Personal (30pts)
    [!!(p.firstName && p.lastName), 6],
    [!!p.email, 4],
    [!!p.phone, 3],
    [!!p.dateOfBirth, 4],
    [!!(p.gender), 3],
    [!!p.country, 5],
    [!!(p.state || p.city), 5],
    // Academic (35pts)
    [!!p.institution, 8],
    [!!p.educationLevel, 6],
    [!!p.fieldOfStudy, 7],
    [!!(p.gpa && p.gpa > 0), 7],
    [!!(p.yearLevel || p.expectedGraduationDate), 4],
    [!!p.course, 3],
    // Scholarship Profile (35pts)
    [!!(p.achievements && p.achievements.length > 0), 5],
    [!!(p.extracurriculars && p.extracurriculars.length > 0), 5],
    [!!(p.leadership && p.leadership.length > 0), 5],
    [!!(p.workExperience && p.workExperience.length > 0), 5],
    [!!(p.careerGoals && p.careerGoals.trim()), 7],
    [!!(p.personalStatement && p.personalStatement.trim()), 8],
  ];
  return Math.min(100, checks.reduce((s, [met, pts]) => s + (met ? pts : 0), 0));
}

const COMPLETION_FIELDS = [
  { label: 'First & Last Name', key: (p: Partial<UserProfile>) => !!(p.firstName && p.lastName) },
  { label: 'Phone Number', key: (p: Partial<UserProfile>) => !!p.phone },
  { label: 'Date of Birth', key: (p: Partial<UserProfile>) => !!p.dateOfBirth },
  { label: 'Country & Region', key: (p: Partial<UserProfile>) => !!p.country },
  { label: 'Institution', key: (p: Partial<UserProfile>) => !!p.institution },
  { label: 'Field of Study', key: (p: Partial<UserProfile>) => !!p.fieldOfStudy },
  { label: 'GPA / CGPA', key: (p: Partial<UserProfile>) => !!(p.gpa && p.gpa > 0) },
  { label: 'Career Goals', key: (p: Partial<UserProfile>) => !!(p.careerGoals?.trim()) },
  { label: 'Personal Statement', key: (p: Partial<UserProfile>) => !!(p.personalStatement?.trim()) },
  { label: 'Achievements / Awards', key: (p: Partial<UserProfile>) => !!(p.achievements?.length) },
];

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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const completion = calcCompletion(formData);
  const missingFields = COMPLETION_FIELDS.filter((f) => !f.key(formData));

  const set = useCallback(<K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setArr = useCallback((key: keyof UserProfile, raw: string) => {
    const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, [key]: arr }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const newCompletion = calcCompletion(formData);
      const updated: UserProfile = {
        ...formData,
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
          education_level: updated.educationLevel,
          institution: updated.institution,
          course: updated.course || null,
          field_of_study: updated.fieldOfStudy,
          year_level: updated.yearLevel || null,
          graduation_year: updated.graduationYear || null,
          expected_graduation_date: updated.expectedGraduationDate || null,
          previous_institution: updated.previousInstitution || null,
          gpa: updated.gpa,
          gpa_scale: updated.gpaScale,
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
            Student Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
            Complete your profile once and it will be reused across all your scholarship applications.
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

        {/* ── Academic Information ── */}
        <SectionCard icon={<GraduationCap size={16} />} title="Academic Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Current Institution <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.institution}
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
              <input type="text" required value={formData.fieldOfStudy}
                onChange={(e) => set('fieldOfStudy', e.target.value)}
                placeholder="e.g. Computer Science" className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Education Level <span className="text-rose-500">*</span></label>
              <select value={formData.educationLevel}
                onChange={(e) => set('educationLevel', e.target.value as EducationLevel)}
                className={INPUT_CLASS}>
                <option value="High School">High School</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Postgraduate (Masters)">Postgraduate (Masters)</option>
                <option value="Doctorate (PhD)">Doctorate (PhD)</option>
                <option value="Vocational / Technical">Vocational / Technical</option>
                <option value="Postdoctoral">Postdoctoral</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Current Year / Level</label>
              <input type="text" value={formData.yearLevel || ''}
                onChange={(e) => set('yearLevel', e.target.value)}
                placeholder="e.g. Year 2, 300 Level" className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>GPA / CGPA <span className="text-rose-500">*</span></label>
              <input type="number" step="0.01" min="0" max="10"
                value={formData.gpa || ''}
                onChange={(e) => set('gpa', parseFloat(e.target.value) || 0)}
                placeholder="e.g. 3.75" className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Grading Scale</label>
              <select value={formData.gpaScale || 4.0}
                onChange={(e) => set('gpaScale', parseFloat(e.target.value))}
                className={INPUT_CLASS}>
                <option value={4.0}>4.0 Scale</option>
                <option value={5.0}>5.0 Scale</option>
                <option value={7.0}>7.0 Scale</option>
                <option value={10.0}>10.0 Scale (India / Some Universities)</option>
              </select>
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

        {/* ── Scholarship Profile ── */}
        <SectionCard icon={<Award size={16} />} title="Academic Achievements & Awards" defaultOpen={false}>
          <p className="text-xs text-slate-500 mb-3">Enter each item separated by a comma.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Achievements & Honours</label>
              <input type="text" value={formData.achievements?.join(', ') || ''}
                onChange={(e) => setArr('achievements', e.target.value)}
                placeholder="Dean's List, National Science Fair 2nd Place"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Awards</label>
              <input type="text" value={formData.awards?.join(', ') || ''}
                onChange={(e) => setArr('awards', e.target.value)}
                placeholder="Best Graduate Award, STEM Excellence Prize"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Certifications</label>
              <input type="text" value={formData.certifications?.join(', ') || ''}
                onChange={(e) => setArr('certifications', e.target.value)}
                placeholder="AWS Cloud Practitioner, Google Data Analytics"
                className={INPUT_CLASS} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Briefcase size={16} />} title="Experience" defaultOpen={false}>
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
              <label className={LABEL_CLASS}>Work Experience</label>
              <input type="text" value={formData.workExperience?.join(', ') || ''}
                onChange={(e) => setArr('workExperience', e.target.value)}
                placeholder="Software Intern at Andela, Research Assistant at UNILAG"
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Volunteer Experience</label>
              <input type="text" value={formData.volunteering?.join(', ') || ''}
                onChange={(e) => setArr('volunteering', e.target.value)}
                placeholder="Community Tutor, Red Cross Youth Volunteer"
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
                placeholder="Describe your career aspirations and how a scholarship would support your goals..."
                className={TEXTAREA_CLASS} />
              <p className="text-[11px] text-slate-400 mt-1">{formData.careerGoals?.length || 0} characters</p>
            </div>
            <div>
              <label className={LABEL_CLASS}>Personal Statement / About Me</label>
              <textarea rows={5} value={formData.personalStatement || ''}
                onChange={(e) => set('personalStatement', e.target.value)}
                placeholder="Write a brief personal statement about your academic journey, challenges you've overcome, and your vision..."
                className={TEXTAREA_CLASS} />
              <p className="text-[11px] text-slate-400 mt-1">{formData.personalStatement?.length || 0} characters</p>
            </div>
          </div>
        </SectionCard>

        {/* ── Other ── */}
        <SectionCard icon={<Heart size={16} />} title="Financial Information" defaultOpen={false}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="financialNeed"
              checked={formData.financialNeed || false}
              onChange={(e) => set('financialNeed', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="financialNeed" className="text-xs text-slate-700 font-medium cursor-pointer">
              I have demonstrated financial need and may require financial support to pursue my education
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
