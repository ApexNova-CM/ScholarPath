import { Scholarship, UserProfile, EligibilityResult, EligibilityCriterion, APPLICANT_STAGE_LABELS } from '../types';

export function calculateAge(dateOfBirthString?: string): number | null {
  if (!dateOfBirthString) return null;
  const dob = new Date(dateOfBirthString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function evaluateEligibility(
  scholarship: Scholarship,
  profile: UserProfile | null
): EligibilityResult {
  // If user is not logged in or has not completed basic profile
  if (!profile) {
    return {
      status: 'profile_incomplete',
      score: 50,
      criteria: [],
      hardDisqualified: false,
      summary: 'Sign in and complete your profile to check personalized eligibility.'
    };
  }

  if (profile.profileCompletion < 40) {
    let incompleteSummary = 'Your profile is incomplete. Complete your profile details for personalized opportunity matching.';
    if (profile.applicantStage === 'secondary') {
      incompleteSummary = 'Your profile is incomplete. Add your school name, graduation year, and intended major for exact matching.';
    } else if (profile.applicantStage === 'vocational') {
      incompleteSummary = 'Your profile is incomplete. Add your trade specialization and skills for exact matching.';
    } else if (profile.applicantStage === 'early_career') {
      incompleteSummary = 'Your profile is incomplete. Add your target industry, skills, and experience for exact matching.';
    } else {
      incompleteSummary = 'Your profile is incomplete. Add your education level, field of study, or GPA for exact matching.';
    }

    return {
      status: 'profile_incomplete',
      score: profile.profileCompletion,
      criteria: [],
      hardDisqualified: false,
      summary: incompleteSummary
    };
  }

  const criteria: EligibilityCriterion[] = [];
  let hardDisqualified = false;
  let hardDisqualificationReason: string | undefined;

  // 1. Target Audience / Pathway Check (HARD CONSTRAINT if specified)
  const hasAudienceReq = Array.isArray(scholarship.targetAudiences) && scholarship.targetAudiences.length > 0;
  let isAudienceMet = true;

  if (hasAudienceReq) {
    if (profile.applicantStage) {
      isAudienceMet = scholarship.targetAudiences!.includes(profile.applicantStage);
    } else {
      // Legacy user without stage: infer compatibility from educationLevel
      const edu = profile.educationLevel;
      if (edu === 'High School') {
        isAudienceMet = scholarship.targetAudiences!.includes('secondary');
      } else if (edu === 'Undergraduate') {
        isAudienceMet = scholarship.targetAudiences!.includes('undergraduate');
      } else if (edu && (edu.includes('Postgraduate') || edu.includes('Doctorate') || edu.includes('Postdoctoral'))) {
        isAudienceMet = scholarship.targetAudiences!.includes('postgraduate');
      } else if (edu === 'Vocational / Technical') {
        isAudienceMet = scholarship.targetAudiences!.includes('vocational');
      } else {
        // Unknown legacy stage: allow if targetAudiences includes undergraduate
        isAudienceMet = scholarship.targetAudiences!.includes('undergraduate');
      }
    }

    const audienceLabels = scholarship.targetAudiences!.map(a => APPLICANT_STAGE_LABELS[a] || a).join(', ');
    criteria.push({
      factor: 'Target Audience',
      label: `Target Pathway: ${audienceLabels}`,
      met: isAudienceMet,
      isHardRequirement: true,
      detail: isAudienceMet
        ? `Your profile pathway aligns with this opportunity's target audience.`
        : `This opportunity is designated for ${audienceLabels} applicants.`
    });

    if (!isAudienceMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Designed specifically for ${audienceLabels} applicants.`;
      }
    }
  }

  // 2. Education Level Check (HARD CONSTRAINT if specified and applicable)
  const hasEduReq = Array.isArray(scholarship.educationLevels) && scholarship.educationLevels.length > 0;
  const inferredEducationLevel = profile.educationLevel || (profile.applicantStage === 'secondary' ? 'High School' : undefined);
  const isAudienceExemptFromEduLevel = 
    Boolean(profile.applicantStage && scholarship.targetAudiences?.includes(profile.applicantStage)) ||
    ((profile.applicantStage === 'vocational' || profile.applicantStage === 'early_career') &&
      scholarship.targetAudiences?.includes(profile.applicantStage));

  const isEducationLevelMet = 
    !hasEduReq ||
    isAudienceExemptFromEduLevel ||
    (inferredEducationLevel ? scholarship.educationLevels.includes(inferredEducationLevel) : false);

  if (hasEduReq && !isAudienceExemptFromEduLevel) {
    criteria.push({
      factor: 'Education Level',
      label: `Target Level: ${scholarship.educationLevels.join(', ') || 'Any'}`,
      met: isEducationLevelMet,
      isHardRequirement: true,
      detail: isEducationLevelMet 
        ? `Your education level (${inferredEducationLevel || profile.educationLevel || 'Not specified'}) matches this opportunity.`
        : `Requires ${scholarship.educationLevels.join(' or ')}, but your profile is currently ${inferredEducationLevel || profile.educationLevel || 'unspecified'}.`
    });

    if (!isEducationLevelMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Does not meet the education level requirement (${scholarship.educationLevels.join(', ')}).`;
      }
    }
  }

  // 3. GPA Check (HARD CONSTRAINT ONLY IF explicitly required by the opportunity)
  let hasUnknownGpa = false;
  let isGpaExempt = false;

  if (scholarship.minimumGPA && scholarship.minimumGPA > 0) {
    const userGpaVal = profile.gpa !== undefined && profile.gpa !== null && !isNaN(Number(profile.gpa)) && Number(profile.gpa) > 0
      ? Number(profile.gpa)
      : null;

    if (userGpaVal !== null) {
      // Normalize GPA scales if different (assume 4.0 standard)
      const normalizedUserGPA = (userGpaVal / (profile.gpaScale || 4.0)) * 4.0;
      const normalizedReqGPA = (scholarship.minimumGPA / (scholarship.gpaScale || 4.0)) * 4.0;
      const isGpaMet = normalizedUserGPA >= normalizedReqGPA - 0.001; // floating point tolerance

      criteria.push({
        factor: 'GPA',
        label: `Minimum GPA: ${scholarship.minimumGPA.toFixed(2)} / ${(scholarship.gpaScale || 4.0).toFixed(1)}`,
        met: isGpaMet,
        isHardRequirement: true,
        detail: isGpaMet
          ? `Your GPA (${userGpaVal.toFixed(2)} / ${(profile.gpaScale || 4.0).toFixed(1)}) meets the minimum requirement (${scholarship.minimumGPA.toFixed(2)}).`
          : `Minimum GPA requirement (${scholarship.minimumGPA.toFixed(2)}) not met (your GPA: ${userGpaVal.toFixed(2)}).`
      });

      if (!isGpaMet) {
        hardDisqualified = true;
        if (!hardDisqualificationReason) {
          hardDisqualificationReason = `Minimum GPA of ${scholarship.minimumGPA.toFixed(2)} is required (your GPA: ${userGpaVal.toFixed(2)}).`;
        }
      }
    } else {
      // User has no GPA recorded on profile
      isGpaExempt = (profile.applicantStage === 'vocational' || profile.applicantStage === 'early_career') &&
        Boolean(scholarship.targetAudiences?.includes(profile.applicantStage));

      if (isGpaExempt) {
        criteria.push({
          factor: 'GPA',
          label: `Minimum GPA: ${scholarship.minimumGPA.toFixed(2)} / ${(scholarship.gpaScale || 4.0).toFixed(1)}`,
          met: true,
          isHardRequirement: false,
          detail: `GPA requirement waived for your specialized professional/vocational pathway.`
        });
      } else {
        // Missing or unknown GPA: do not automatically hard-disqualify applicant
        hasUnknownGpa = true;
        criteria.push({
          factor: 'GPA',
          label: `Minimum GPA: ${scholarship.minimumGPA.toFixed(2)} / ${(scholarship.gpaScale || 4.0).toFixed(1)}`,
          met: false,
          isHardRequirement: false, // Non-fatal info/warning
          detail: `Minimum GPA of ${scholarship.minimumGPA.toFixed(2)} is required. Add your GPA to your profile to confirm eligibility.`
        });
      }
    }
  }

  // 4. Location / Eligible Countries Check (HARD CONSTRAINT)
  const isCountryOpenToAll = 
    !scholarship.eligibleCountries || 
    scholarship.eligibleCountries.length === 0 || 
    scholarship.eligibleCountries.includes('All') ||
    scholarship.eligibleCountries.includes('International') ||
    scholarship.eligibleCountries.includes('Global');

  const isCountryMet = isCountryOpenToAll || 
    (profile.country && scholarship.eligibleCountries.some(c => c.toLowerCase() === profile.country.toLowerCase()));

  criteria.push({
    factor: 'Location',
    label: isCountryOpenToAll ? 'Open to All Countries / International' : `Eligible Countries: ${scholarship.eligibleCountries.join(', ')}`,
    met: isCountryMet,
    isHardRequirement: true,
    detail: isCountryMet
      ? `Your location (${profile.country || 'Global'}) is eligible for this opportunity.`
      : `Limited to applicants from ${scholarship.eligibleCountries.join(', ')} (your country: ${profile.country}).`
  });

  if (!isCountryMet) {
    hardDisqualified = true;
    if (!hardDisqualificationReason) {
      hardDisqualificationReason = `Your country of origin (${profile.country}) is outside the eligible list.`;
    }
  }

  // 5. Field of Study / Industry / Specialization Check
  const isFieldOpenToAll = 
    !scholarship.fieldsOfStudy || 
    scholarship.fieldsOfStudy.length === 0 || 
    scholarship.fieldsOfStudy.includes('All') ||
    scholarship.fieldsOfStudy.includes('Any');

  let isFieldMet = isFieldOpenToAll;
  const userFieldCandidates = [
    profile.fieldOfStudy,
    profile.course,
    profile.targetMajor,
    profile.tradeSpecialization,
    profile.targetIndustry,
  ].filter(Boolean) as string[];

  if (!isFieldOpenToAll && userFieldCandidates.length > 0) {
    isFieldMet = scholarship.fieldsOfStudy.some(f => {
      const fLower = f.toLowerCase();
      return userFieldCandidates.some(u => {
        const uLower = u.toLowerCase();
        return uLower.includes(fLower) || fLower.includes(uLower);
      });
    });
  }

  const primaryField = profile.fieldOfStudy || profile.targetMajor || profile.tradeSpecialization || profile.targetIndustry || profile.course;
  criteria.push({
    factor: 'Field / Specialization',
    label: isFieldOpenToAll ? 'All Fields & Specializations' : `Target Fields: ${scholarship.fieldsOfStudy.join(', ')}`,
    met: isFieldMet,
    isHardRequirement: false,
    detail: isFieldMet
      ? `Your field or specialization (${primaryField || 'General'}) aligns with this opportunity.`
      : `Preferred fields: ${scholarship.fieldsOfStudy.join(', ')} (your profile: ${primaryField || 'Not specified'}).`
  });

  // 6. Skills Alignment Check (for internships, apprenticeships, fellowships, etc.)
  let hasSkillsReq = Array.isArray(scholarship.skillsRequired) && scholarship.skillsRequired.length > 0;
  let matchingSkills: string[] = [];
  if (hasSkillsReq) {
    const userSkills = (profile.skills || []).map(s => s.toLowerCase());
    matchingSkills = scholarship.skillsRequired!.filter(reqSkill => 
      userSkills.some(us => us.includes(reqSkill.toLowerCase()) || reqSkill.toLowerCase().includes(us))
    );
    const isSkillsMet = matchingSkills.length > 0;
    criteria.push({
      factor: 'Skills & Capabilities',
      label: `Key Skills: ${scholarship.skillsRequired!.slice(0, 3).join(', ')}${scholarship.skillsRequired!.length > 3 ? '...' : ''}`,
      met: isSkillsMet,
      isHardRequirement: false,
      detail: isSkillsMet
        ? `You match ${matchingSkills.length} of ${scholarship.skillsRequired!.length} listed skills (${matchingSkills.join(', ')}).`
        : `Desired skills: ${scholarship.skillsRequired!.join(', ')} (your profile has not listed these yet).`
    });
  }

  // 7. Age Limits Check (if specified)
  const userAge = calculateAge(profile.dateOfBirth);
  if (userAge !== null && (scholarship.minimumAge || scholarship.maximumAge)) {
    const meetsMinAge = !scholarship.minimumAge || userAge >= scholarship.minimumAge;
    const meetsMaxAge = !scholarship.maximumAge || userAge <= scholarship.maximumAge;
    const isAgeMet = meetsMinAge && meetsMaxAge;

    criteria.push({
      factor: 'Age',
      label: `Age requirement: ${scholarship.minimumAge || 0} - ${scholarship.maximumAge || 'No limit'} years`,
      met: isAgeMet,
      isHardRequirement: true,
      detail: isAgeMet
        ? `Your age (${userAge}) is within the eligible age window.`
        : `Applicant age must be between ${scholarship.minimumAge || 0} and ${scholarship.maximumAge || 'any'} years old (current age: ${userAge}).`
    });

    if (!isAgeMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Age limit requirement not met.`;
      }
    }
  }

  // 8. Gender requirement (if specified)
  if (scholarship.genderRequirement && scholarship.genderRequirement !== 'Any') {
    const isGenderMet = !profile.gender || profile.gender === scholarship.genderRequirement;
    criteria.push({
      factor: 'Gender',
      label: `Eligibility: ${scholarship.genderRequirement} applicants`,
      met: isGenderMet,
      isHardRequirement: true,
      detail: isGenderMet
        ? `Meets the gender eligibility criteria.`
        : `This specific opportunity is reserved for ${scholarship.genderRequirement} applicants.`
    });

    if (!isGenderMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Targeted for ${scholarship.genderRequirement} applicants.`;
      }
    }
  }

  // Calculate Weighted Match Score
  // Audience / Education: 30%
  // GPA: 25% (or full 25% if no GPA required)
  // Country: 20%
  // Field / Specialization / Industry: 15%
  // Skills, Readiness & Experience bonus: 10%
  let rawScore = 0;
  if (isAudienceMet && isEducationLevelMet) rawScore += 30;
  else if (isAudienceMet || isEducationLevelMet) rawScore += 18;

  if (scholarship.minimumGPA && scholarship.minimumGPA > 0) {
    const userGpaVal = profile.gpa !== undefined && profile.gpa !== null && !isNaN(Number(profile.gpa)) && Number(profile.gpa) > 0
      ? Number(profile.gpa)
      : null;
    if (userGpaVal !== null) {
      const normalizedUserGPA = (userGpaVal / (profile.gpaScale || 4.0)) * 4.0;
      const normalizedReqGPA = (scholarship.minimumGPA / (scholarship.gpaScale || 4.0)) * 4.0;
      if (normalizedUserGPA >= normalizedReqGPA) {
        rawScore += 25;
      } else {
        const ratio = Math.max(0, normalizedUserGPA / normalizedReqGPA);
        rawScore += Math.round(25 * ratio);
      }
    } else if (isGpaExempt) {
      rawScore += 25;
    }
  } else {
    // If no GPA required, award full GPA points
    rawScore += 25;
  }

  if (isCountryMet) rawScore += 20;
  if (isFieldMet) rawScore += 15;

  // Profile readiness, skills and credentials bonus
  const skillBonus = hasSkillsReq ? Math.min(6, matchingSkills.length * 2) : 2;
  const experienceCount = (profile.awards?.length || 0) + (profile.certifications?.length || 0) + (profile.leadership?.length || 0) + (profile.tradeCertifications?.length || 0);
  rawScore += Math.min(10, skillBonus + experienceCount * 2);

  // CRITICAL RULE: "Hard disqualifiers should override the percentage.
  // Example: A user cannot receive '98% match' if they fail a mandatory requirement."
  let finalScore = rawScore;
  let status: EligibilityResult['status'] = 'eligible';
  let summary = `You satisfy all verified core criteria for this ${scholarship.opportunityType || 'opportunity'}.`;

  if (hardDisqualified) {
    // Cap score at 38% maximum and explicitly state disqualification
    finalScore = Math.min(38, Math.round(rawScore * 0.4));
    status = 'not_eligible';
    summary = hardDisqualificationReason || 'Mandatory eligibility requirements are not currently met.';
  } else if (hasUnknownGpa) {
    status = 'partial_match';
    summary = `Potentially eligible. Add your GPA to your profile to confirm the minimum GPA requirement (${scholarship.minimumGPA!.toFixed(2)}).`;
  } else if (finalScore >= 85) {
    status = 'strong_match';
    summary = 'Strong Match — Your background and profile are highly aligned.';
  } else if (finalScore >= 65) {
    status = 'eligible';
    summary = 'Eligible — You qualify for this opportunity.';
  } else {
    status = 'partial_match';
    summary = 'Partial Match — Some criteria differ, but you may still be eligible to apply.';
  }

  return {
    status,
    score: Math.min(99, Math.max(10, finalScore)),
    criteria,
    hardDisqualified,
    hardDisqualificationReason,
    summary
  };
}

/**
 * Returns a human-readable match category label for a given score (0–100).
 * Scholarships below 50 are not shown in the Recommended section.
 */
export function getMatchCategory(score: number): 'Excellent Match' | 'Strong Match' | 'Possible Match' | 'Low Match' {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 50) return 'Possible Match';
  return 'Low Match';
}

/**
 * Returns Tailwind colour classes for a given match score tier.
 */
export function getMatchCategoryColors(score: number): { bg: string; text: string; border: string } {
  if (score >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
  if (score >= 75) return { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
  return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
}
