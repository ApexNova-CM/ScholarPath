import React, { useState, useEffect } from 'react';
import { 
  Scholarship, Provider, Category, EducationLevel, FundingType, AmountPeriod, 
  DocumentType, AwardType, AwardFrequency, ApplicationMethod, VerificationSourceType,
  InstitutionType, ScholarshipRequirementItem, ScholarshipApplicationStep, ScholarshipSelectionStep,
  ScholarshipStatus, VerificationStatus
} from '../../types';
import { StorageService } from '../../services/storage';
import { api } from '../../lib/apiClient';
import { generateUUID } from '../../lib/uuid';
import { fetchDocumentTypes, fetchScholarshipRequiredDocs, saveScholarshipRequiredDocs } from '../../services/documentService';
import { 
  PlusCircle, ArrowLeft, Save, ShieldCheck, CheckCircle2, 
  Trash2, AlertCircle, Sparkles, Coins, RefreshCw, Layers,
  ChevronDown, ChevronUp, GripVertical, Check, Info, Plus, Calendar,
  Globe, Award, GraduationCap, FileCheck, ArrowRight
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

const awardTypeOptions: AwardType[] = [
  'Full scholarship',
  'Partial scholarship',
  'Tuition',
  'Cash award',
  'Stipend',
  'Research funding',
  'Laptop/device',
  'Training',
  'Internship',
  'Mentorship',
  'Other'
];

const awardFrequencyOptions: AwardFrequency[] = [
  'One-time',
  'Monthly',
  'Quarterly',
  'Annual',
  'Other'
];

const applicationMethodOptions: ApplicationMethod[] = [
  'External Website',
  'Online Form',
  'Google Form',
  'Zoho Form',
  'Email',
  'Physical Application',
  'Scholavon Application',
  'Other'
];

const sourceTypeOptions: VerificationSourceType[] = [
  'Official Website',
  'Official Application Form',
  'Official Social Media',
  'Organization Announcement',
  'Partner Organization',
  'Other'
];

const institutionTypeOptions: InstitutionType[] = [
  'Public University',
  'Private University',
  'Polytechnic',
  'College of Education',
  'Secondary School',
  'Vocational Institute',
  'Any Accredited Institution'
];

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

const commonCoverageSuggestions = [
  'Full Tuition Fee',
  'Living Allowance / Stipend',
  'Accommodation / Housing',
  'Book & Learning Materials Allowance',
  'Round-trip Airfare / Travel',
  'Health Insurance',
  'Laptop / Equipment Grant',
  'Visa & Application Fee Subsidy',
  'Research & Conference Allowance'
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
  const [activeTab, setActiveTab] = useState<number>(0);

  // Form state initialized with existing data or sensible defaults
  const [formData, setFormData] = useState<Partial<Scholarship>>({
    title: existing?.title || '',
    providerName: existing?.providerName || '',
    providerId: existing?.providerId || generateUUID(),
    providerLogo: existing?.providerLogo || '',
    category: existing?.category || (categories[0]?.name || 'STEM & Tech'),
    scholarshipType: existing?.scholarshipType || '',
    fundingType: existing?.fundingType || 'Full',
    amount: existing?.amount !== undefined ? existing.amount : undefined,
    currency: existing?.currency || 'NGN',
    awardCurrency: existing?.awardCurrency || existing?.currency || 'NGN',
    awardType: existing?.awardType || 'Full scholarship',
    awardFrequency: existing?.awardFrequency || 'Annual',
    awardValueText: existing?.awardValueText || '',
    awardDescription: existing?.awardDescription || '',
    amountPeriod: existing?.amountPeriod || 'Annual',
    amountDisplay: existing?.amountDisplay || (existing?.amount ? formatSuggestedAmountDisplay(existing.amount, existing.currency || 'USD', existing.amountPeriod) : ''),
    whatTheAwardCovers: existing?.whatTheAwardCovers || [],
    numberOfRecipients: existing?.numberOfRecipients || '',

    // Eligibility
    eligibleCountries: existing?.eligibleCountries || ['Nigeria', 'International'],
    eligibleStates: existing?.eligibleStates || [],
    eligibleNationalities: existing?.eligibleNationalities || [],
    countryOfStudy: existing?.countryOfStudy || [],
    educationLevels: existing?.educationLevels || ['Undergraduate'],
    institutionTypes: existing?.institutionTypes || [],
    studyYears: existing?.studyYears || [],
    fieldsOfStudy: existing?.fieldsOfStudy || ['Computer Science', 'Engineering'],
    eligibleCourses: existing?.eligibleCourses || [],
    minimumGPA: existing?.minimumGPA !== undefined ? existing.minimumGPA : undefined,
    gpaScale: existing?.gpaScale || 4.0,
    academicStanding: existing?.academicStanding || '',
    genderRequirement: existing?.genderRequirement || 'Any',
    minimumAge: existing?.minimumAge,
    maximumAge: existing?.maximumAge,
    financialNeedRequired: existing?.financialNeedRequired || false,
    leadershipRequired: existing?.leadershipRequired || false,
    communityServiceRequired: existing?.communityServiceRequired || false,
    disabilityApplicable: existing?.disabilityApplicable || false,
    membershipRequirement: existing?.membershipRequirement || '',
    otherEligibilityConditions: existing?.otherEligibilityConditions || [],
    otherRequirements: existing?.otherRequirements || [],
    otherRequirementsNotes: existing?.otherRequirementsNotes || '',

    // Requirements
    requiredDocuments: existing?.requiredDocuments || ['Official Transcript', 'CV / Resume'],
    structuredRequirements: existing?.structuredRequirements || (
      existing?.requiredDocuments && existing.requiredDocuments.length > 0
        ? existing.requiredDocuments.map((doc, idx) => ({
            id: generateUUID(),
            name: doc,
            description: '',
            required: true,
            isDocument: true,
            acceptedFileTypes: ['PDF'],
            order: idx + 1
          }))
        : [
            {
              id: generateUUID(),
              name: 'Official Academic Transcript',
              description: 'Certified transcript from current or previous institution',
              required: true,
              isDocument: true,
              acceptedFileTypes: ['PDF'],
              order: 1
            },
            {
              id: generateUUID(),
              name: 'CV / Resume',
              description: 'Up-to-date curriculum vitae showing academic achievements',
              required: true,
              isDocument: true,
              acceptedFileTypes: ['PDF'],
              order: 2
            }
          ]
    ),

    // Application Details
    applicationMethod: existing?.applicationMethod || 'External Website',
    applicationInstructions: existing?.applicationInstructions || 'Submit online via the official portal before the deadline.',
    applicationUrl: existing?.applicationUrl || 'https://example.org/apply',
    officialWebsiteUrl: existing?.officialWebsiteUrl || '',
    applicationFee: existing?.applicationFee || '',
    applicationFeeCurrency: existing?.applicationFeeCurrency || 'NGN',
    accountRequired: existing?.accountRequired !== undefined ? existing.accountRequired : false,
    applicationSteps: existing?.applicationSteps || [
      { id: generateUUID(), stepNumber: 1, title: 'Visit the official application portal', description: 'Review the guidelines and verify eligibility requirements.' },
      { id: generateUUID(), stepNumber: 2, title: 'Complete application form', description: 'Fill out personal, academic, and contact details.' },
      { id: generateUUID(), stepNumber: 3, title: 'Upload required documents', description: 'Attach PDF transcripts, CV, and supporting materials.' },
      { id: generateUUID(), stepNumber: 4, title: 'Submit application', description: 'Review all entries and submit before the closing date.' }
    ],

    // Important Dates
    openingDate: existing?.openingDate || '',
    deadline: existing?.deadline || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    deadlineTime: existing?.deadlineTime || '23:59',
    expectedResultDate: existing?.expectedResultDate || '',
    awardDate: existing?.awardDate || '',
    timezone: existing?.timezone || 'WAT (UTC+1)',

    // Selection Process
    selectionProcess: existing?.selectionProcess || 'Application Review → Shortlisting → Final Selection',
    selectionCriteria: existing?.selectionCriteria || 'Academic merit, leadership potential, and statement quality.',
    testRequired: existing?.testRequired || false,
    interviewRequired: existing?.interviewRequired || false,
    essayRequired: existing?.essayRequired || false,
    shortlistingProcess: existing?.shortlistingProcess || 'Candidates will be notified via email within 4 weeks of deadline.',
    selectionSteps: existing?.selectionSteps || [
      { id: generateUUID(), stageNumber: 1, name: 'Initial Eligibility Screening', description: 'Verification of minimum GPA and required documents.' },
      { id: generateUUID(), stageNumber: 2, name: 'Committee Review', description: 'Assessment of academic standing and leadership background.' },
      { id: generateUUID(), stageNumber: 3, name: 'Award Notification', description: 'Selected scholars receive award letters and instructions.' }
    ],
    otherSelectionInfo: existing?.otherSelectionInfo || '',

    // Verification & Publishing
    status: existing?.status || 'verified',
    verificationStatus: existing?.verificationStatus || 'verified',
    officialSourceUrl: existing?.officialSourceUrl || '',
    sourceType: existing?.sourceType || 'Official Website',
    verifiedBy: existing?.verifiedBy || 'Scholavon Audit Operations',
    verifiedAt: existing?.verifiedAt || new Date().toISOString(),
    verificationNotes: existing?.verificationNotes || 'Scholarship verified from official organization website and verified application form.',
    isFeatured: existing?.isFeatured || false,
    autoCloseOnDeadline: existing?.autoCloseOnDeadline !== undefined ? existing.autoCloseOnDeadline : true,
    description: existing?.description || '',
    shortDescription: existing?.shortDescription || '',
    tags: existing?.tags || ['STEM', 'Merit-based', 'Tuition Support']
  });

  // Text inputs for arrays
  const [fieldsInput, setFieldsInput] = useState(formData.fieldsOfStudy?.join(', ') || '');
  const [countriesInput, setCountriesInput] = useState(formData.eligibleCountries?.join(', ') || '');
  const [statesInput, setStatesInput] = useState(formData.eligibleStates?.join(', ') || '');
  const [nationalitiesInput, setNationalitiesInput] = useState(formData.eligibleNationalities?.join(', ') || '');
  const [studyCountryInput, setStudyCountryInput] = useState(formData.countryOfStudy?.join(', ') || '');
  const [eligibleCoursesInput, setEligibleCoursesInput] = useState(formData.eligibleCourses?.join(', ') || '');
  const [tagsInput, setTagsInput] = useState(formData.tags?.join(', ') || '');
  const [customCoverageInput, setCustomCoverageInput] = useState('');
  const [otherEligInput, setOtherEligInput] = useState(formData.otherEligibilityConditions?.join('\n') || '');

  const [isVerified, setIsVerified] = useState(existing ? existing.verificationStatus === 'verified' : true);
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
          const matchedIds = types
            .filter(t => existing.requiredDocuments.some(rd => rd.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(rd.toLowerCase())))
            .map(t => t.id);
          setSelectedDocTypeIds(matchedIds);
        }
      }
    }
    loadDocTypes();
  }, [existing?.id]);

  // Auto-generate amountDisplay when amount, currency, or period changes
  const updateAmountField = (amountVal: number | undefined, currVal: string, periodVal: string) => {
    const autoGen = formatSuggestedAmountDisplay(amountVal, currVal, periodVal);
    if (!hasManuallyEditedDisplay) {
      setFormData(prev => ({
        ...prev,
        amount: amountVal,
        currency: currVal,
        awardCurrency: currVal,
        amountPeriod: periodVal as AmountPeriod,
        amountDisplay: autoGen
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        amount: amountVal,
        currency: currVal,
        awardCurrency: currVal,
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

  const toggleInstitutionType = (type: InstitutionType) => {
    const current = (formData.institutionTypes as InstitutionType[]) || [];
    if (current.includes(type)) {
      setFormData({ ...formData, institutionTypes: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, institutionTypes: [...current, type] });
    }
  };

  const toggleCoverageItem = (item: string) => {
    const current = formData.whatTheAwardCovers || [];
    if (current.includes(item)) {
      setFormData({ ...formData, whatTheAwardCovers: current.filter(c => c !== item) });
    } else {
      setFormData({ ...formData, whatTheAwardCovers: [...current, item] });
    }
  };

  const addCustomCoverageItem = () => {
    if (!customCoverageInput.trim()) return;
    const item = customCoverageInput.trim();
    if (!formData.whatTheAwardCovers?.includes(item)) {
      setFormData({ ...formData, whatTheAwardCovers: [...(formData.whatTheAwardCovers || []), item] });
    }
    setCustomCoverageInput('');
  };

  // Structured Requirements Handlers
  const addRequirement = () => {
    const items = formData.structuredRequirements || [];
    const newItem: ScholarshipRequirementItem = {
      id: generateUUID(),
      name: '',
      description: '',
      required: true,
      isDocument: true,
      acceptedFileTypes: ['PDF'],
      order: items.length + 1
    };
    setFormData({ ...formData, structuredRequirements: [...items, newItem] });
  };

  const updateRequirement = (id: string, updates: Partial<ScholarshipRequirementItem>) => {
    const items = (formData.structuredRequirements || []).map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    setFormData({ ...formData, structuredRequirements: items });
  };

  const removeRequirement = (id: string) => {
    const items = (formData.structuredRequirements || [])
      .filter(item => item.id !== id)
      .map((item, idx) => ({ ...item, order: idx + 1 }));
    setFormData({ ...formData, structuredRequirements: items });
  };

  const moveRequirement = (index: number, direction: 'up' | 'down') => {
    const items = [...(formData.structuredRequirements || [])];
    if (direction === 'up' && index > 0) {
      const temp = items[index];
      items[index] = items[index - 1];
      items[index - 1] = temp;
    } else if (direction === 'down' && index < items.length - 1) {
      const temp = items[index];
      items[index] = items[index + 1];
      items[index + 1] = temp;
    }
    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    setFormData({ ...formData, structuredRequirements: reordered });
  };

  // Application Steps Handlers
  const addApplicationStep = () => {
    const steps = formData.applicationSteps || [];
    const newStep: ScholarshipApplicationStep = {
      id: generateUUID(),
      stepNumber: steps.length + 1,
      title: '',
      description: ''
    };
    setFormData({ ...formData, applicationSteps: [...steps, newStep] });
  };

  const updateApplicationStep = (id: string, updates: Partial<ScholarshipApplicationStep>) => {
    const steps = (formData.applicationSteps || []).map(step => 
      step.id === id ? { ...step, ...updates } : step
    );
    setFormData({ ...formData, applicationSteps: steps });
  };

  const removeApplicationStep = (id: string) => {
    const steps = (formData.applicationSteps || [])
      .filter(step => step.id !== id)
      .map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setFormData({ ...formData, applicationSteps: steps });
  };

  const moveApplicationStep = (index: number, direction: 'up' | 'down') => {
    const steps = [...(formData.applicationSteps || [])];
    if (direction === 'up' && index > 0) {
      const temp = steps[index];
      steps[index] = steps[index - 1];
      steps[index - 1] = temp;
    } else if (direction === 'down' && index < steps.length - 1) {
      const temp = steps[index];
      steps[index] = steps[index + 1];
      steps[index + 1] = temp;
    }
    const reordered = steps.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setFormData({ ...formData, applicationSteps: reordered });
  };

  // Selection Steps Handlers
  const addSelectionStep = () => {
    const steps = formData.selectionSteps || [];
    const newStep: ScholarshipSelectionStep = {
      id: generateUUID(),
      stageNumber: steps.length + 1,
      name: '',
      description: ''
    };
    setFormData({ ...formData, selectionSteps: [...steps, newStep] });
  };

  const updateSelectionStep = (id: string, updates: Partial<ScholarshipSelectionStep>) => {
    const steps = (formData.selectionSteps || []).map(step => 
      step.id === id ? { ...step, ...updates } : step
    );
    setFormData({ ...formData, selectionSteps: steps });
  };

  const removeSelectionStep = (id: string) => {
    const steps = (formData.selectionSteps || [])
      .filter(step => step.id !== id)
      .map((step, idx) => ({ ...step, stageNumber: idx + 1 }));
    setFormData({ ...formData, selectionSteps: steps });
  };

  const moveSelectionStep = (index: number, direction: 'up' | 'down') => {
    const steps = [...(formData.selectionSteps || [])];
    if (direction === 'up' && index > 0) {
      const temp = steps[index];
      steps[index] = steps[index - 1];
      steps[index - 1] = temp;
    } else if (direction === 'down' && index < steps.length - 1) {
      const temp = steps[index];
      steps[index] = steps[index + 1];
      steps[index + 1] = temp;
    }
    const reordered = steps.map((step, idx) => ({ ...step, stageNumber: idx + 1 }));
    setFormData({ ...formData, selectionSteps: reordered });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const preparedFields = fieldsInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedCountries = countriesInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedStates = statesInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedNationalities = nationalitiesInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedStudyCountry = studyCountryInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedEligibleCourses = eligibleCoursesInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedTags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
    const preparedOtherElig = otherEligInput.split('\n').map(s => s.trim()).filter(Boolean);

    // Derived required documents:
    // 1. If legacy requiredDocuments had explicit items, keep them.
    // 2. Derive document items from structuredRequirements to maintain compatibility with existing document vault.
    const structuredDocNames = (formData.structuredRequirements || [])
      .filter(r => r.isDocument && r.name.trim())
      .map(r => r.name.trim());
    const selectedDocNames = selectedDocTypeIds
      .map(id => dbDocTypes.find(t => t.id === id)?.name)
      .filter(Boolean) as string[];
    const combinedDocs = Array.from(new Set([...(existing?.requiredDocuments || []), ...structuredDocNames, ...selectedDocNames]));

    const scholarshipIdToSave = existing ? existing.id : generateUUID();

    const currentVerificationStatus: VerificationStatus = isVerified ? 'verified' : (formData.verificationStatus || 'pending_verification');
    const currentStatus: ScholarshipStatus = formData.status || (isVerified ? 'verified' : 'draft');

    const scholarshipToSave: Scholarship = {
      id: scholarshipIdToSave,
      title: formData.title || 'Untitled Scholarship',
      providerId: formData.providerId || generateUUID(),
      providerName: formData.providerName?.trim() || 'Provider Organization',
      providerLogo: formData.providerLogo?.trim() || '',
      category: formData.category || (categories[0]?.name || 'STEM & Tech'),
      scholarshipType: formData.scholarshipType?.trim() || '',
      fundingType: (formData.fundingType as FundingType) || 'Full',
      tags: preparedTags,

      // Award Details
      amount: formData.amount !== undefined && formData.amount !== null && !isNaN(Number(formData.amount)) ? Number(formData.amount) : undefined,
      currency: formData.currency || 'NGN',
      awardCurrency: formData.awardCurrency || formData.currency || 'NGN',
      awardType: formData.awardType || 'Full scholarship',
      awardFrequency: formData.awardFrequency || 'Annual',
      awardValueText: formData.awardValueText?.trim() || '',
      awardDescription: formData.awardDescription?.trim() || '',
      amountPeriod: formData.amountPeriod || 'Annual',
      amountDisplay: formData.amountDisplay?.trim() || (formData.amount ? formatSuggestedAmountDisplay(formData.amount, formData.currency, formData.amountPeriod) : (formData.awardValueText || '')),
      whatTheAwardCovers: formData.whatTheAwardCovers || [],
      numberOfRecipients: formData.numberOfRecipients || '',

      // Eligibility
      eligibleCountries: preparedCountries.length > 0 ? preparedCountries : ['All'],
      eligibleStates: preparedStates,
      eligibleNationalities: preparedNationalities,
      countryOfStudy: preparedStudyCountry,
      educationLevels: formData.educationLevels && formData.educationLevels.length > 0 ? formData.educationLevels : ['Undergraduate'],
      institutionTypes: formData.institutionTypes,
      studyYears: formData.studyYears,
      fieldsOfStudy: preparedFields.length > 0 ? preparedFields : ['All'],
      eligibleCourses: preparedEligibleCourses,
      minimumAge: formData.minimumAge !== undefined && !isNaN(Number(formData.minimumAge)) ? Number(formData.minimumAge) : undefined,
      maximumAge: formData.maximumAge !== undefined && !isNaN(Number(formData.maximumAge)) ? Number(formData.maximumAge) : undefined,
      minimumGPA: formData.minimumGPA !== undefined && !isNaN(Number(formData.minimumGPA)) ? Number(formData.minimumGPA) : undefined,
      gpaScale: Number(formData.gpaScale) || 4.0,
      academicStanding: formData.academicStanding?.trim() || '',
      genderRequirement: formData.genderRequirement || 'Any',
      financialNeedRequired: Boolean(formData.financialNeedRequired),
      leadershipRequired: Boolean(formData.leadershipRequired),
      communityServiceRequired: Boolean(formData.communityServiceRequired),
      disabilityApplicable: Boolean(formData.disabilityApplicable),
      membershipRequirement: formData.membershipRequirement?.trim() || '',
      otherEligibilityConditions: preparedOtherElig,
      otherRequirements: formData.otherRequirements || [],
      otherRequirementsNotes: formData.otherRequirementsNotes?.trim() || '',

      // Requirements
      requiredDocuments: combinedDocs.length > 0 ? combinedDocs : ['Official Academic Transcript', 'CV / Resume'],
      structuredRequirements: formData.structuredRequirements || [],

      // Application Details
      applicationMethod: formData.applicationMethod || 'External Website',
      applicationInstructions: formData.applicationInstructions || '',
      applicationUrl: formData.applicationUrl || '',
      officialWebsiteUrl: formData.officialWebsiteUrl?.trim() || '',
      applicationFee: formData.applicationFee?.trim() || '',
      applicationFeeCurrency: formData.applicationFeeCurrency || 'NGN',
      accountRequired: Boolean(formData.accountRequired),
      applicationSteps: formData.applicationSteps || [],

      // Important Dates
      openingDate: formData.openingDate || '',
      deadline: formData.deadline || new Date().toISOString(),
      deadlineTime: formData.deadlineTime || '',
      expectedResultDate: formData.expectedResultDate || '',
      awardDate: formData.awardDate || '',
      timezone: formData.timezone || 'WAT (UTC+1)',

      // Selection Process
      selectionProcess: formData.selectionProcess?.trim() || '',
      selectionCriteria: formData.selectionCriteria?.trim() || '',
      testRequired: Boolean(formData.testRequired),
      interviewRequired: Boolean(formData.interviewRequired),
      essayRequired: Boolean(formData.essayRequired),
      shortlistingProcess: formData.shortlistingProcess?.trim() || '',
      selectionSteps: formData.selectionSteps || [],
      otherSelectionInfo: formData.otherSelectionInfo?.trim() || '',

      // Verification & Trust
      status: currentStatus,
      verificationStatus: currentVerificationStatus,
      officialSourceUrl: formData.officialSourceUrl?.trim() || '',
      sourceType: formData.sourceType || 'Official Website',
      verifiedAt: isVerified ? (existing?.verifiedAt || new Date().toISOString()) : undefined,
      verifiedBy: isVerified ? (existing?.verifiedBy || 'Scholavon Audit Operations') : undefined,
      verificationNotes: formData.verificationNotes?.trim() || '',
      lastUpdatedAt: new Date().toISOString(),

      // Publishing & Stats
      isFeatured: Boolean(formData.isFeatured),
      autoCloseOnDeadline: formData.autoCloseOnDeadline !== undefined ? formData.autoCloseOnDeadline : true,
      description: formData.description || '',
      shortDescription: formData.shortDescription || formData.description?.slice(0, 140) || '',
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
    }, 1200);
  };

  const sections = [
    { id: 0, title: 'Basic Info', icon: Globe },
    { id: 1, title: 'Award Details', icon: Coins },
    { id: 2, title: 'Eligibility', icon: GraduationCap },
    { id: 3, title: 'Requirements', icon: FileCheck },
    { id: 4, title: 'Application', icon: ArrowRight },
    { id: 5, title: 'Important Dates', icon: Calendar },
    { id: 6, title: 'Selection Process', icon: Layers },
    { id: 7, title: 'Verification & Trust', icon: ShieldCheck },
    { id: 8, title: 'Publishing Controls', icon: Award },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header & Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('/admin/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 bg-white shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Scholarships List</span>
        </button>

        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full uppercase tracking-wider">
          {existing ? 'Edit Opportunity Audit' : 'New Scholarship Opportunity'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {existing ? `Edit: ${existing.title}` : 'Add Scholarship Opportunity'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Capture verifiable scholarship criteria, structured requirements, application steps, and audit trails.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">Scholarship saved successfully!</p>
            <p className="text-[11px] opacity-90">Synced across database, search discovery, and student eligibility matching.</p>
          </div>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-2xs overflow-x-auto scrollbar-none flex items-center gap-1">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeTab === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveTab(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{sec.title}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* ========================================================================= */}
        {/* SECTION 0: BASIC INFORMATION */}
        {/* ========================================================================= */}
        {activeTab === 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Globe size={16} />
                <span>1. Basic Information</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Core identity, provider organization, categorization, and descriptions.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Scholarship Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Mastercard Foundation Scholars Program at University of Toronto"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Provider / Organization <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.providerName}
                    onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                    placeholder="e.g. Shell Nigeria, Mastercard Foundation, Chevening Secretariat"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scholarship Type / Sub-Type</label>
                  <input
                    type="text"
                    value={formData.scholarshipType || ''}
                    onChange={(e) => setFormData({ ...formData, scholarshipType: e.target.value })}
                    placeholder="e.g. Merit-based, Fellowship, Research Grant"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Provider Logo / Image URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.providerLogo || ''}
                    onChange={(e) => setFormData({ ...formData, providerLogo: e.target.value })}
                    placeholder="https://example.org/logo.png"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Short Description <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(1-2 concise sentences for cards)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Brief summary displayed on scholarship cards..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Detailed Description <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(Comprehensive overview for detail page)</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed eligibility overview, organization objectives, program benefits, and guidelines..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Search & Filter Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="STEM, Merit, Underrepresented, Full Tuition, Africa, International"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1: AWARD DETAILS */}
        {/* ========================================================================= */}
        {activeTab === 1 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Coins size={16} />
                <span>2. Award Details</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Define award amount, frequency, coverage benefits, and recipient scope without forcing arbitrary numbers.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Award Type</label>
                  <select
                    value={formData.awardType || 'Full scholarship'}
                    onChange={(e) => setFormData({ ...formData, awardType: e.target.value as AwardType })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                  >
                    {awardTypeOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Award Frequency</label>
                  <select
                    value={formData.awardFrequency || 'Annual'}
                    onChange={(e) => {
                      const newFreq = e.target.value as AwardFrequency;
                      setFormData(prev => ({ ...prev, awardFrequency: newFreq }));
                      updateAmountField(formData.amount, formData.currency || 'NGN', newFreq === 'Annual' ? 'Annual' : newFreq === 'Monthly' ? 'Monthly' : 'One-time');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                  >
                    {awardFrequencyOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Recipients / Slots (Optional)</label>
                  <input
                    type="text"
                    value={formData.numberOfRecipients || ''}
                    onChange={(e) => setFormData({ ...formData, numberOfRecipients: e.target.value })}
                    placeholder="e.g. 50 scholars, 10 per region"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Numeric Amount (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.amount !== undefined ? formData.amount : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      updateAmountField(val, formData.currency || 'NGN', formData.amountPeriod || 'Annual');
                    }}
                    placeholder="e.g. 500000 (leave blank if undisclosed)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency || 'NGN'}
                    onChange={(e) => {
                      const newCurr = e.target.value;
                      updateAmountField(formData.amount, newCurr, formData.amountPeriod || 'Annual');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    {currencyOptions.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Period / Term</label>
                  <select
                    value={formData.amountPeriod || 'Annual'}
                    onChange={(e) => {
                      const newPeriod = e.target.value as AmountPeriod;
                      updateAmountField(formData.amount, formData.currency || 'NGN', newPeriod);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    {amountPeriodOptions.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Amount Display / Badge Label</label>
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
                    placeholder="e.g. ₦500,000 annually, Full Tuition + $1,500/mo, or Up to $25,000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Public text shown on discovery cards and detail header.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Descriptive Value Notes (e.g. if variable)</label>
                  <input
                    type="text"
                    value={formData.awardValueText || ''}
                    onChange={(e) => setFormData({ ...formData, awardValueText: e.target.value })}
                    placeholder="e.g. Varies by program, Up to 100% tuition waiver"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* What the Award Covers */}
              <div className="space-y-2 pt-2">
                <label className="block font-semibold text-slate-700">What the Award Covers (Check all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {commonCoverageSuggestions.map(item => {
                    const checked = formData.whatTheAwardCovers?.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleCoverageItem(item)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          checked
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {checked && <Check size={12} />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={customCoverageInput}
                    onChange={(e) => setCustomCoverageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCoverageItem(); }}}
                    placeholder="Add custom coverage item..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={addCustomCoverageItem}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-semibold text-xs hover:bg-slate-700 cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: ELIGIBILITY */}
        {/* ========================================================================= */}
        {activeTab === 2 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <GraduationCap size={16} />
                <span>3. Eligibility Criteria</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Record exact criteria stated by the source (leave blank if not specified).</p>
            </div>

            <div className="space-y-4">
              {/* Location & Nationality */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">A. Location & Nationalities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Eligible Countries (comma-separated or 'All')</label>
                    <input
                      type="text"
                      value={countriesInput}
                      onChange={(e) => setCountriesInput(e.target.value)}
                      placeholder="Nigeria, Ghana, Kenya (or All)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Eligible States / Regions (Optional)</label>
                    <input
                      type="text"
                      value={statesInput}
                      onChange={(e) => setStatesInput(e.target.value)}
                      placeholder="Lagos, Rivers, Delta, Kano (Optional)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Eligible Nationalities (Optional)</label>
                    <input
                      type="text"
                      value={nationalitiesInput}
                      onChange={(e) => setNationalitiesInput(e.target.value)}
                      placeholder="Nigerian, African Nationals, Commonwealth Citizens"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Country of Study / Destination (Optional)</label>
                    <input
                      type="text"
                      value={studyCountryInput}
                      onChange={(e) => setStudyCountryInput(e.target.value)}
                      placeholder="United Kingdom, Canada, Nigeria, United States"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Education & Academic Criteria */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">B. Education & Academics</h3>
                
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Education Levels</label>
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
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Institution Types</label>
                  <div className="flex flex-wrap gap-2">
                    {institutionTypeOptions.map(inst => {
                      const checked = (formData.institutionTypes as InstitutionType[])?.includes(inst);
                      return (
                        <button
                          key={inst}
                          type="button"
                          onClick={() => toggleInstitutionType(inst)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                            checked
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {inst}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Eligible Fields of Study (comma-separated or 'All')</label>
                    <input
                      type="text"
                      value={fieldsInput}
                      onChange={(e) => setFieldsInput(e.target.value)}
                      placeholder="Computer Science, Engineering, Medicine, All"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Specific Eligible Courses / Programs (Optional)</label>
                    <input
                      type="text"
                      value={eligibleCoursesInput}
                      onChange={(e) => setEligibleCoursesInput(e.target.value)}
                      placeholder="Software Engineering, Nursing, Petroleum Engineering"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Minimum GPA Required (Leave blank if none)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.0"
                      max="100.0"
                      value={formData.minimumGPA !== undefined ? formData.minimumGPA : ''}
                      onChange={(e) => setFormData({ ...formData, minimumGPA: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="e.g. 3.50"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">GPA Scale</label>
                    <select
                      value={formData.gpaScale || 4.0}
                      onChange={(e) => setFormData({ ...formData, gpaScale: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                    >
                      <option value="4.0">4.0 Scale (Standard)</option>
                      <option value="5.0">5.0 Scale (Nigerian Universities)</option>
                      <option value="7.0">7.0 Scale</option>
                      <option value="10.0">10.0 Scale</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Academic Standing / Class (Optional)</label>
                    <input
                      type="text"
                      value={formData.academicStanding || ''}
                      onChange={(e) => setFormData({ ...formData, academicStanding: e.target.value })}
                      placeholder="e.g. First Class or Second Class Upper"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Age Bounds & Other Eligibility */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">C. Age & Special Conditions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Minimum Age (Optional)</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={formData.minimumAge !== undefined ? formData.minimumAge : ''}
                      onChange={(e) => setFormData({ ...formData, minimumAge: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="e.g. 18"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Maximum Age (Optional)</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={formData.maximumAge !== undefined ? formData.maximumAge : ''}
                      onChange={(e) => setFormData({ ...formData, maximumAge: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="e.g. 30"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender Requirement</label>
                    <select
                      value={formData.genderRequirement || 'Any'}
                      onChange={(e) => setFormData({ ...formData, genderRequirement: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                    >
                      <option value="Any">Any Gender</option>
                      <option value="Female">Female Only</option>
                      <option value="Male">Male Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Membership / Affiliation</label>
                    <input
                      type="text"
                      value={formData.membershipRequirement || ''}
                      onChange={(e) => setFormData({ ...formData, membershipRequirement: e.target.value })}
                      placeholder="e.g. IEEE member, Host community indigene"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.financialNeedRequired)}
                      onChange={(e) => setFormData({ ...formData, financialNeedRequired: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-800">Financial Need Required</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.leadershipRequired)}
                      onChange={(e) => setFormData({ ...formData, leadershipRequired: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-800">Leadership Track Record</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.communityServiceRequired)}
                      onChange={(e) => setFormData({ ...formData, communityServiceRequired: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-800">Community Service</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.disabilityApplicable)}
                      onChange={(e) => setFormData({ ...formData, disabilityApplicable: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-800">Persons with Disabilities</span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Other Eligibility Conditions (1 per line, optional)</label>
                  <textarea
                    rows={3}
                    value={otherEligInput}
                    onChange={(e) => setOtherEligInput(e.target.value)}
                    placeholder="Must not be holding another ongoing full scholarship&#10;Must be enrolled in an accredited university&#10;Commitment to return to home country upon completion"
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: REQUIREMENTS */}
        {/* ========================================================================= */}
        {activeTab === 3 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                  <FileCheck size={16} />
                  <span>4. Application Requirements</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Structured, repeatable requirements supporting documents and non-document criteria.</p>
              </div>
              <button
                type="button"
                onClick={addRequirement}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus size={13} />
                <span>Add Requirement</span>
              </button>
            </div>

            <div className="space-y-3">
              {(formData.structuredRequirements || []).length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-slate-500">No structured requirements defined yet.</p>
                  <button
                    type="button"
                    onClick={addRequirement}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs underline cursor-pointer"
                  >
                    Click here to add the first requirement
                  </button>
                </div>
              ) : (
                (formData.structuredRequirements || []).map((req, idx) => (
                  <div key={req.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">Requirement #{idx + 1}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveRequirement(idx, 'up')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === (formData.structuredRequirements?.length || 0) - 1}
                          onClick={() => moveRequirement(idx, 'down')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRequirement(req.id)}
                          className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ml-1"
                          title="Delete Requirement"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">Requirement Name</label>
                        <input
                          type="text"
                          required
                          value={req.name}
                          onChange={(e) => updateRequirement(req.id, { name: e.target.value })}
                          placeholder="e.g. Official Academic Transcript, Personal Statement, Recommendation Letter"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-4 pt-5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.required}
                            onChange={(e) => updateRequirement(req.id, { required: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="font-semibold text-slate-700">Mandatory</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={req.isDocument}
                            onChange={(e) => updateRequirement(req.id, { isDocument: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="font-semibold text-slate-700">Document Upload</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">Description / Instructions</label>
                        <input
                          type="text"
                          value={req.description || ''}
                          onChange={(e) => updateRequirement(req.id, { description: e.target.value })}
                          placeholder="e.g. Signed by university registrar, max 500 words, etc."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                        />
                      </div>

                      {req.isDocument && (
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Accepted File Formats</label>
                          <input
                            type="text"
                            value={req.acceptedFileTypes?.join(', ') || 'PDF'}
                            onChange={(e) => updateRequirement(req.id, { acceptedFileTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            placeholder="PDF, DOCX, JPG"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">Other Requirements & General Notes</label>
                <textarea
                  rows={3}
                  value={formData.otherRequirementsNotes || ''}
                  onChange={(e) => setFormData({ ...formData, otherRequirementsNotes: e.target.value })}
                  placeholder="Additional special criteria, background notes, or portfolio specifications..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: APPLICATION DETAILS */}
        {/* ========================================================================= */}
        {activeTab === 4 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <ArrowRight size={16} />
                <span>5. Application Details & Step-by-Step Flow</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Separate official provider homepage from direct application submission URLs and define steps.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Direct Application URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.applicationUrl}
                    onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                    placeholder="https://apply.mastercardfdn.org/apply-now"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Exact link where students start/submit their application.</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Provider / Program Website</label>
                  <input
                    type="url"
                    value={formData.officialWebsiteUrl || ''}
                    onChange={(e) => setFormData({ ...formData, officialWebsiteUrl: e.target.value })}
                    placeholder="https://mastercardfdn.org/scholars"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Main organization homepage or official press announcement.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Application Method</label>
                  <select
                    value={formData.applicationMethod || 'External Website'}
                    onChange={(e) => setFormData({ ...formData, applicationMethod: e.target.value as ApplicationMethod })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    {applicationMethodOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Application Fee (if any)</label>
                  <input
                    type="text"
                    value={formData.applicationFee || ''}
                    onChange={(e) => setFormData({ ...formData, applicationFee: e.target.value })}
                    placeholder="e.g. Free, $50, or None"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.accountRequired)}
                      onChange={(e) => setFormData({ ...formData, accountRequired: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Account Registration Required</span>
                      <span className="text-[10px] text-slate-500 block">Student must register on third-party portal</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">General Application Instructions</label>
                <textarea
                  rows={3}
                  value={formData.applicationInstructions || ''}
                  onChange={(e) => setFormData({ ...formData, applicationInstructions: e.target.value })}
                  placeholder="Step-by-step summary, advice for submission, portal guidelines..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Step-by-Step Repeatable Steps */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Repeatable Application Steps</h3>
                    <p className="text-[11px] text-slate-500">Guide students step-by-step from portal registration to final confirmation.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addApplicationStep}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(formData.applicationSteps || []).map((step, idx) => (
                    <div key={step.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[11px] shrink-0 mt-1">
                        {idx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => updateApplicationStep(step.id, { title: e.target.value })}
                            placeholder="Step Title (e.g. Create Applicant Account)"
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden font-medium"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={step.description || ''}
                            onChange={(e) => updateApplicationStep(step.id, { description: e.target.value })}
                            placeholder="Details or action required in this step..."
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveApplicationStep(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === (formData.applicationSteps?.length || 0) - 1}
                          onClick={() => moveApplicationStep(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeApplicationStep(step.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: IMPORTANT DATES */}
        {/* ========================================================================= */}
        {activeTab === 5 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Calendar size={16} />
                <span>6. Important Dates & Lifecycle Deadlines</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Maintain strict timeline synchronization for notifications, closing-soon badges, and automatic lifecycle state.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Application Deadline Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 font-medium"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Decisive closing date for student submissions.</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Closing Time (Optional)</label>
                  <input
                    type="text"
                    value={formData.deadlineTime || ''}
                    onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value })}
                    placeholder="e.g. 23:59 or 17:00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: 23:59 (end of day).</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={formData.timezone || 'WAT (UTC+1)'}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    placeholder="e.g. WAT (UTC+1), GMT, EST"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Application Opens Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.openingDate ? formData.openingDate.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Result Announcement Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.expectedResultDate ? formData.expectedResultDate.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, expectedResultDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Award Disbursement Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.awardDate ? formData.awardDate.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, awardDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 6: SELECTION PROCESS */}
        {/* ========================================================================= */}
        {activeTab === 6 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Layers size={16} />
                <span>7. Selection Process & Evaluation</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Specify evaluation stages, screening tests, interviews, essays, and decision milestones.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selection Process Summary</label>
                  <input
                    type="text"
                    value={formData.selectionProcess || ''}
                    onChange={(e) => setFormData({ ...formData, selectionProcess: e.target.value })}
                    placeholder="e.g. Application Review → Aptitude Test → Panel Interview → Final Selection"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Key Selection Criteria</label>
                  <input
                    type="text"
                    value={formData.selectionCriteria || ''}
                    onChange={(e) => setFormData({ ...formData, selectionCriteria: e.target.value })}
                    placeholder="e.g. Academic excellence, leadership impact, community service"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.testRequired)}
                    onChange={(e) => setFormData({ ...formData, testRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">Aptitude Test Required</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.interviewRequired)}
                    onChange={(e) => setFormData({ ...formData, interviewRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">Interview Required</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.essayRequired)}
                    onChange={(e) => setFormData({ ...formData, essayRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">Essay / Statement Required</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shortlisting & Notification Process</label>
                <textarea
                  rows={2}
                  value={formData.shortlistingProcess || ''}
                  onChange={(e) => setFormData({ ...formData, shortlistingProcess: e.target.value })}
                  placeholder="e.g. Shortlisted applicants will be invited for interview by November 15."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Structured Selection Steps */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Structured Selection Stages</h3>
                    <p className="text-[11px] text-slate-500">Sequence of evaluation stages from application receipt to final award.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSelectionStep}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Add Stage</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(formData.selectionSteps || []).map((step, idx) => (
                    <div key={step.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0 mt-1">
                        {idx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => updateSelectionStep(step.id, { name: e.target.value })}
                            placeholder="Stage Name (e.g. Document Verification)"
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden font-medium"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            value={step.description || ''}
                            onChange={(e) => updateSelectionStep(step.id, { description: e.target.value })}
                            placeholder="Details or criteria evaluated at this stage..."
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSelectionStep(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === (formData.selectionSteps?.length || 0) - 1}
                          onClick={() => moveSelectionStep(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSelectionStep(step.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 7: VERIFICATION & TRUST */}
        {/* ========================================================================= */}
        {activeTab === 7 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>8. Verification Audit & Trust Integrity</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Control the verified status badge and record verification evidence and official source URLs.</p>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3.5 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => {
                    setIsVerified(e.target.checked);
                    setFormData(prev => ({
                      ...prev,
                      verificationStatus: e.target.checked ? 'verified' : 'pending_verification',
                      status: e.target.checked ? 'verified' : (prev.status === 'verified' ? 'draft' : prev.status)
                    }));
                  }}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <div>
                  <span className="font-bold text-slate-900 text-sm block">Mark as Verified ✓ (Publish with Verified Trust Badge)</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5 leading-relaxed">
                    Check this box only if the provider and official application form have been confirmed legitimate and dates are authenticated.
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Status</label>
                  <select
                    value={formData.verificationStatus || (isVerified ? 'verified' : 'pending_verification')}
                    onChange={(e) => {
                      const v = e.target.value as VerificationStatus;
                      setFormData({ ...formData, verificationStatus: v });
                      setIsVerified(v === 'verified');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    <option value="verified">Verified (Publicly certified)</option>
                    <option value="pending_verification">Pending Verification (Review Queue)</option>
                    <option value="changes_requested">Needs Review / Changes Requested</option>
                    <option value="unverified">Unverified</option>
                    <option value="rejected">Rejected / Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Source Type</label>
                  <select
                    value={formData.sourceType || 'Official Website'}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as VerificationSourceType })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    {sourceTypeOptions.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Verification Source URL</label>
                  <input
                    type="url"
                    value={formData.officialSourceUrl || ''}
                    onChange={(e) => setFormData({ ...formData, officialSourceUrl: e.target.value })}
                    placeholder="https://official.org/scholarship-announcement-2026"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Public verification proof link shown to students.</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verified By (Auditor / Admin Name)</label>
                  <input
                    type="text"
                    value={formData.verifiedBy || ''}
                    onChange={(e) => setFormData({ ...formData, verifiedBy: e.target.value })}
                    placeholder="e.g. Scholavon Audit Operations"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Verification Evidence & Notes</label>
                <textarea
                  rows={3}
                  value={formData.verificationNotes || ''}
                  onChange={(e) => setFormData({ ...formData, verificationNotes: e.target.value })}
                  placeholder="Record how the scholarship was verified (e.g. Confirmed on provider's official portal and verified active application form on October 8, 2026)."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Last verified date: {formData.verifiedAt ? new Date(formData.verifiedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Pending verification'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 8: PUBLISHING CONTROLS */}
        {/* ========================================================================= */}
        {activeTab === 8 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                <Award size={16} />
                <span>9. Admin Publishing Controls</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Control live visibility, promotion banners, and deadline expiration behavior.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Publishing Status</label>
                  <select
                    value={formData.status || 'verified'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ScholarshipStatus })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    <option value="verified">Published (Active & Visible)</option>
                    <option value="draft">Draft (Saved but not visible publicly)</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="archived">Archived</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.isFeatured)}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">Featured Opportunity</span>
                      <span className="text-[10px] text-slate-500 block">Highlights opportunity in student recommendations banner</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoCloseOnDeadline !== false}
                    onChange={(e) => setFormData({ ...formData, autoCloseOnDeadline: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Auto-close when deadline passes</span>
                    <span className="text-[10px] text-slate-500 block">Automatically transitions lifecycle state from Open → Closed when the closing deadline date/time is reached.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Section Navigation & Submission Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {existing && onDeleteScholarship && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete Opportunity</span>
              </button>
            )}

            {activeTab > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab(prev => Math.max(0, prev - 1))}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Previous Section
              </button>
            )}

            {activeTab < sections.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveTab(prev => Math.min(sections.length - 1, prev + 1))}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
              >
                Next: {sections[activeTab + 1].title} →
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
              <span>{isVerified ? 'Save & Publish (Verified)' : 'Save Opportunity'}</span>
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
