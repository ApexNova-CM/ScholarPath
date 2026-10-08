import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/store';
import { optionalAuthenticateToken } from '../middleware/auth';
import { ScholarshipRecord, StudentProfileRecord } from '../types';
import { config } from '../config';

const router = Router();

// Helper to retrieve all scholarships merging local DB and Supabase if configured
async function getAllScholarshipsFromSource(): Promise<ScholarshipRecord[]> {
  const localList = db.getScholarships();
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await supabase
        .from('scholarships')
        .select('*');
      if (data && Array.isArray(data)) {
        const map = new Map<string, ScholarshipRecord>();
        for (const s of localList) {
          map.set(s.id, s);
        }
        for (const row of data) {
          if (!map.has(row.id)) {
            map.set(row.id, {
              id: row.id,
              title: row.title || 'Untitled Scholarship',
              providerId: row.provider_id || '',
              providerName: row.provider_name || '',
              providerLogo: row.provider_logo,
              description: row.description || '',
              shortDescription: row.short_description || '',
              category: row.category || 'STEM & Tech',
              tags: row.tags || [],
              amount: row.amount !== undefined && row.amount !== null ? Number(row.amount) : undefined,
              currency: row.currency || 'USD',
              fundingType: row.funding_type || 'Full',
              amountPeriod: row.amount_period,
              amountDisplay: row.amount_display,
              eligibleCountries: row.eligible_countries || ['All'],
              eligibleStates: row.eligible_states,
              educationLevels: row.education_levels || ['Undergraduate'],
              fieldsOfStudy: row.fields_of_study || ['All'],
              minimumAge: row.minimum_age,
              maximumAge: row.maximum_age,
              minimumGPA: row.minimum_gpa,
              gpaScale: row.gpa_scale || 4.0,
              genderRequirement: row.gender_requirement || 'Any',
              financialNeedRequired: row.financial_need_required || false,
              otherRequirements: row.other_requirements,
              requiredDocuments: row.required_documents || [],
              applicationInstructions: row.application_instructions || '',
              applicationUrl: row.application_url || '',
              openingDate: row.opening_date,
              deadline: row.deadline || new Date().toISOString(),
              expectedResultDate: row.expected_result_date,
              status: row.status || 'verified',
              verificationStatus: row.verification_status || 'verified',
              verifiedBy: row.verified_by,
              verifiedAt: row.verified_at,
              verificationNotes: row.verification_notes,
              viewCount: row.view_count || 0,
              saveCount: row.save_count || 0,
              manuallyClosed: row.manually_closed,
              manuallyClosedAt: row.manually_closed_at,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
            });
          }
        }
        return Array.from(map.values());
      }
    } catch (err) {
      console.warn('[scholarships] error fetching scholarships from Supabase:', err);
    }
  }
  return localList;
}

// Evaluate eligibility helper (server authority)
function evaluateServerEligibility(scholarship: ScholarshipRecord, profile: StudentProfileRecord | null) {
  if (!profile) {
    return {
      status: 'profile_incomplete',
      score: 50,
      criteria: [],
      hardDisqualified: false,
      summary: 'Sign in and complete your academic profile to check personalized eligibility.',
    };
  }

  if (profile.profileCompletion < 40) {
    return {
      status: 'profile_incomplete',
      score: profile.profileCompletion,
      criteria: [],
      hardDisqualified: false,
      summary: 'Your profile is incomplete. Fill in your GPA, field of study, and education level for exact matching.',
    };
  }

  const criteria: any[] = [];
  let hardDisqualified = false;
  let hardDisqualificationReason: string | undefined;

  // Education Level
  const isLevelMet =
    scholarship.educationLevels.length === 0 ||
    scholarship.educationLevels.includes('All' as any) ||
    scholarship.educationLevels.includes(profile.educationLevel);

  criteria.push({
    factor: 'Education Level',
    label: `Target Level: ${scholarship.educationLevels.join(', ') || 'Any'}`,
    met: isLevelMet,
    isHardRequirement: true,
    detail: isLevelMet
      ? `Your education level (${profile.educationLevel}) matches this scholarship.`
      : `Requires ${scholarship.educationLevels.join(' or ')}, but your profile is currently ${profile.educationLevel}.`,
  });

  if (!isLevelMet) {
    hardDisqualified = true;
    hardDisqualificationReason = `Education level mismatch: this award requires ${scholarship.educationLevels.join(' or ')}.`;
  }

  // Location / Country
  const isCountryMet =
    scholarship.eligibleCountries.length === 0 ||
    scholarship.eligibleCountries.includes('All') ||
    scholarship.eligibleCountries.map((c) => c.toLowerCase()).includes(profile.country.toLowerCase());

  criteria.push({
    factor: 'Location',
    label: `Citizenship: ${scholarship.eligibleCountries.join(', ')}`,
    met: isCountryMet,
    isHardRequirement: true,
    detail: isCountryMet
      ? `Students from ${profile.country} are eligible.`
      : `Restricted to citizens of ${scholarship.eligibleCountries.join(', ')}.`,
  });

  if (!isCountryMet && !hardDisqualified) {
    hardDisqualified = true;
    hardDisqualificationReason = `Country restriction: must be from ${scholarship.eligibleCountries.join(', ')}.`;
  }

  // GPA
  let isGpaMet = true;
  if (scholarship.minimumGPA && scholarship.minimumGPA > 0) {
    const normalizedProfileGPA = (profile.gpa / (profile.gpaScale || 4.0)) * 4.0;
    const normalizedReqGPA = (scholarship.minimumGPA / (scholarship.gpaScale || 4.0)) * 4.0;
    isGpaMet = normalizedProfileGPA >= normalizedReqGPA - 0.05;

    criteria.push({
      factor: 'GPA',
      label: `Minimum GPA: ${scholarship.minimumGPA.toFixed(2)} (${scholarship.gpaScale.toFixed(1)} scale)`,
      met: isGpaMet,
      isHardRequirement: true,
      detail: isGpaMet
        ? `Your GPA (${profile.gpa.toFixed(2)}) meets the minimum requirement (${scholarship.minimumGPA.toFixed(2)}).`
        : `Requires minimum GPA of ${scholarship.minimumGPA.toFixed(2)}, currently ${profile.gpa.toFixed(2)}.`,
    });

  if (!isGpaMet && !hardDisqualified) {
    hardDisqualified = true;
    hardDisqualificationReason = `GPA requirement of ${scholarship.minimumGPA.toFixed(2)} not met (currently ${profile.gpa.toFixed(2)}).`;
  }
}

  // Field of Study
  const isFieldMet =
    scholarship.fieldsOfStudy.length === 0 ||
    scholarship.fieldsOfStudy.includes('All') ||
    scholarship.fieldsOfStudy.some(
      (f) =>
        f.toLowerCase() === profile.fieldOfStudy.toLowerCase() ||
        profile.fieldOfStudy.toLowerCase().includes(f.toLowerCase()) ||
        f.toLowerCase().includes(profile.fieldOfStudy.toLowerCase())
    );

  criteria.push({
    factor: 'Field of Study',
    label: `Disciplines: ${scholarship.fieldsOfStudy.join(', ')}`,
    met: isFieldMet,
    isHardRequirement: false,
    detail: isFieldMet
      ? `Your field (${profile.fieldOfStudy}) aligns with eligible subjects.`
      : `Preferred disciplines: ${scholarship.fieldsOfStudy.join(', ')}.`,
  });

  // Calculate score
  let score = 0;
  if (hardDisqualified) {
    score = 25;
  } else {
    score = 65;
    if (isFieldMet) score += 20;
    if (profile.gpa && profile.gpa >= 3.5) score += 10;
    if (profile.awards && profile.awards.length > 0) score += 5;
  }
  score = Math.min(100, Math.max(10, score));

  let status: 'eligible' | 'strong_match' | 'partial_match' | 'not_eligible' = 'partial_match';
  if (hardDisqualified) {
    status = 'not_eligible';
  } else if (score >= 85) {
    status = 'strong_match';
  } else if (score >= 70) {
    status = 'eligible';
  }

  return {
    status,
    score,
    criteria,
    hardDisqualified,
    hardDisqualificationReason,
    summary: hardDisqualified
      ? hardDisqualificationReason!
      : `High probability match (${score}%) based on your academic profile.`,
  };
}

// GET /api/v1/scholarships (Public with optional filters)
router.get('/', optionalAuthenticateToken, async (req: Request, res: Response): Promise<void> => {
  let list = await getAllScholarshipsFromSource();

  // If public / student, show verified active scholarships (not archived/rejected)
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin) {
    list = list.filter((s) => (s.verificationStatus === 'verified' || !s.verificationStatus) && s.status !== 'archived' && s.status !== 'rejected');
  }

  const {
    category,
    country,
    educationLevel,
    fundingType,
    search,
    status,
    verificationStatus,
    minAmount,
    maxAmount,
    page = '1',
    limit = '50',
  } = req.query;

  if (category && typeof category === 'string') {
    list = list.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }

  if (country && typeof country === 'string') {
    const cLower = country.toLowerCase();
    list = list.filter(
      (s) => s.eligibleCountries.includes('All') || s.eligibleCountries.some((c) => c.toLowerCase() === cLower)
    );
  }

  if (educationLevel && typeof educationLevel === 'string') {
    list = list.filter(
      (s) => s.educationLevels.includes('All' as any) || s.educationLevels.includes(educationLevel as any)
    );
  }

  if (fundingType && typeof fundingType === 'string') {
    list = list.filter((s) => s.fundingType.toLowerCase() === fundingType.toLowerCase());
  }

  if (status && typeof status === 'string') {
    list = list.filter((s) => s.status === status);
  }

  if (verificationStatus && typeof verificationStatus === 'string') {
    list = list.filter((s) => s.verificationStatus === verificationStatus);
  }

  if (minAmount && !isNaN(Number(minAmount))) {
    list = list.filter((s) => (s.amount || 0) >= Number(minAmount));
  }

  if (maxAmount && !isNaN(Number(maxAmount))) {
    list = list.filter((s) => (s.amount || 0) <= Number(maxAmount));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.providerName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  const total = list.length;
  const p = Math.max(1, parseInt(page as string, 10));
  const l = Math.max(1, parseInt(limit as string, 10));
  const start = (p - 1) * l;
  const paginated = list.slice(start, start + l);

  res.json({
    success: true,
    data: {
      items: paginated,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    },
  });
});

// GET /api/v1/scholarships/:id
router.get('/:id', optionalAuthenticateToken, async (req: Request, res: Response): Promise<void> => {
  let scholarship = db.findScholarshipById(req.params.id);
  if (!scholarship && config.supabaseUrl && config.supabaseServiceRoleKey) {
    const all = await getAllScholarshipsFromSource();
    scholarship = all.find((s) => s.id === req.params.id);
  }
  if (!scholarship) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  // Increment view count
  scholarship.viewCount = (scholarship.viewCount || 0) + 1;
  db.updateScholarship(scholarship.id, { viewCount: scholarship.viewCount });

  let eligibility = null;
  if (req.user) {
    const profile = db.getProfile(req.user.id) || null;
    eligibility = evaluateServerEligibility(scholarship, profile);
  }

  res.json({
    success: true,
    data: {
      scholarship,
      eligibility,
    },
  });
});

// GET /api/v1/scholarships/:id/eligibility
router.get('/:id/eligibility', optionalAuthenticateToken, (req: Request, res: Response): void => {
  const scholarship = db.findScholarshipById(req.params.id);
  if (!scholarship) {
    res.status(404).json({
      success: false,
      error: { code: 'SCHOLARSHIP_NOT_FOUND', message: 'Scholarship not found.' },
    });
    return;
  }

  const profile = req.user ? db.getProfile(req.user.id) || null : null;
  const eligibility = evaluateServerEligibility(scholarship, profile);

  res.json({
    success: true,
    data: eligibility,
  });
});

export default router;
