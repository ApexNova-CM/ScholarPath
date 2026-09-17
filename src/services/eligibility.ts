import { Scholarship, UserProfile, EligibilityResult, EligibilityCriterion } from '../types';

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
      summary: 'Sign in and complete your academic profile to check personalized eligibility.'
    };
  }

  if (profile.profileCompletion < 40) {
    return {
      status: 'profile_incomplete',
      score: profile.profileCompletion,
      criteria: [],
      hardDisqualified: false,
      summary: 'Your profile is incomplete. Fill in your GPA, field of study, and education level for exact matching.'
    };
  }

  const criteria: EligibilityCriterion[] = [];
  let hardDisqualified = false;
  let hardDisqualificationReason: string | undefined;

  // 1. Education Level Check (HARD CONSTRAINT)
  const isEducationLevelMet = 
    scholarship.educationLevels.length === 0 ||
    scholarship.educationLevels.includes(profile.educationLevel);

  criteria.push({
    factor: 'Education Level',
    label: `Target Level: ${scholarship.educationLevels.join(', ') || 'Any'}`,
    met: isEducationLevelMet,
    isHardRequirement: true,
    detail: isEducationLevelMet 
      ? `Your education level (${profile.educationLevel}) matches this scholarship.`
      : `Requires ${scholarship.educationLevels.join(' or ')}, but your profile is currently ${profile.educationLevel}.`
  });

  if (!isEducationLevelMet) {
    hardDisqualified = true;
    hardDisqualificationReason = `Does not meet the education level requirement (${scholarship.educationLevels.join(', ')}).`;
  }

  // 2. GPA Check (HARD CONSTRAINT if specified)
  if (scholarship.minimumGPA && scholarship.minimumGPA > 0) {
    // Normalize GPA scales if different (assume 4.0 standard)
    const normalizedUserGPA = (profile.gpa / (profile.gpaScale || 4.0)) * 4.0;
    const normalizedReqGPA = (scholarship.minimumGPA / (scholarship.gpaScale || 4.0)) * 4.0;
    const isGpaMet = normalizedUserGPA >= normalizedReqGPA - 0.001; // floating point tolerance

    criteria.push({
      factor: 'GPA',
      label: `Minimum GPA: ${scholarship.minimumGPA.toFixed(2)} / ${scholarship.gpaScale.toFixed(1)}`,
      met: isGpaMet,
      isHardRequirement: true,
      detail: isGpaMet
        ? `Your GPA (${profile.gpa.toFixed(2)} / ${profile.gpaScale.toFixed(1)}) meets the minimum requirement (${scholarship.minimumGPA.toFixed(2)}).`
        : `Minimum GPA requirement (${scholarship.minimumGPA.toFixed(2)}) not met (your GPA: ${profile.gpa.toFixed(2)}).`
    });

    if (!isGpaMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Minimum GPA of ${scholarship.minimumGPA.toFixed(2)} is required (your GPA: ${profile.gpa.toFixed(2)}).`;
      }
    }
  }

  // 3. Location / Eligible Countries Check (HARD CONSTRAINT)
  const isCountryOpenToAll = 
    !scholarship.eligibleCountries || 
    scholarship.eligibleCountries.length === 0 || 
    scholarship.eligibleCountries.includes('All') ||
    scholarship.eligibleCountries.includes('International') ||
    scholarship.eligibleCountries.includes('Global');

  const isCountryMet = isCountryOpenToAll || 
    scholarship.eligibleCountries.some(c => c.toLowerCase() === profile.country.toLowerCase());

  criteria.push({
    factor: 'Location',
    label: isCountryOpenToAll ? 'Open to All Countries / International' : `Eligible Countries: ${scholarship.eligibleCountries.join(', ')}`,
    met: isCountryMet,
    isHardRequirement: true,
    detail: isCountryMet
      ? `Your location (${profile.country}) is eligible for this opportunity.`
      : `Limited to students from ${scholarship.eligibleCountries.join(', ')} (your country: ${profile.country}).`
  });

  if (!isCountryMet) {
    hardDisqualified = true;
    if (!hardDisqualificationReason) {
      hardDisqualificationReason = `Your country of origin (${profile.country}) is outside the eligible list.`;
    }
  }

  // 4. Field of Study Check (Weighted soft or hard constraint depending on fields)
  const isFieldOpenToAll = 
    !scholarship.fieldsOfStudy || 
    scholarship.fieldsOfStudy.length === 0 || 
    scholarship.fieldsOfStudy.includes('All') ||
    scholarship.fieldsOfStudy.includes('Any');

  let isFieldMet = isFieldOpenToAll;
  if (!isFieldOpenToAll && profile.fieldOfStudy) {
    const userFieldLower = profile.fieldOfStudy.toLowerCase();
    const userCourseLower = (profile.course || '').toLowerCase();
    isFieldMet = scholarship.fieldsOfStudy.some(f => {
      const fLower = f.toLowerCase();
      return userFieldLower.includes(fLower) || fLower.includes(userFieldLower) ||
             userCourseLower.includes(fLower) || fLower.includes(userCourseLower);
    });
  }

  criteria.push({
    factor: 'Field of Study',
    label: isFieldOpenToAll ? 'All Fields of Study' : `Target Fields: ${scholarship.fieldsOfStudy.join(', ')}`,
    met: isFieldMet,
    isHardRequirement: false,
    detail: isFieldMet
      ? `Your field of study (${profile.fieldOfStudy || profile.course}) aligns with this award.`
      : `Preferred fields: ${scholarship.fieldsOfStudy.join(', ')} (your field: ${profile.fieldOfStudy || 'Not specified'}).`
  });

  // 5. Age Limits Check (if specified)
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

  // 6. Gender requirement (if specified)
  if (scholarship.genderRequirement && scholarship.genderRequirement !== 'Any') {
    const isGenderMet = !profile.gender || profile.gender === scholarship.genderRequirement;
    criteria.push({
      factor: 'Gender',
      label: `Eligibility: ${scholarship.genderRequirement} applicants`,
      met: isGenderMet,
      isHardRequirement: true,
      detail: isGenderMet
        ? `Meets the gender eligibility criteria.`
        : `This specific fund is reserved for ${scholarship.genderRequirement} applicants.`
    });

    if (!isGenderMet) {
      hardDisqualified = true;
      if (!hardDisqualificationReason) {
        hardDisqualificationReason = `Targeted for ${scholarship.genderRequirement} applicants.`;
      }
    }
  }

  // Calculate Weighted Match Score
  // Weights:
  // Education Level: 30%
  // GPA: 25%
  // Country / Location: 20%
  // Field of Study: 15%
  // Profile completeness & credentials bonus: 10%
  let rawScore = 0;
  if (isEducationLevelMet) rawScore += 30;
  
  if (scholarship.minimumGPA) {
    const normalizedUserGPA = (profile.gpa / (profile.gpaScale || 4.0)) * 4.0;
    const normalizedReqGPA = (scholarship.minimumGPA / (scholarship.gpaScale || 4.0)) * 4.0;
    if (normalizedUserGPA >= normalizedReqGPA) {
      rawScore += 25;
    } else {
      // Proportional points if close, but hard disqualifier caps overall score
      const ratio = Math.max(0, normalizedUserGPA / normalizedReqGPA);
      rawScore += Math.round(25 * ratio);
    }
  } else {
    // If no GPA required, award full GPA points
    rawScore += 25;
  }

  if (isCountryMet) rawScore += 20;
  if (isFieldMet) rawScore += 15;

  // Profile readiness bonus (awards, certs, leadership)
  const experienceCount = (profile.awards?.length || 0) + (profile.certifications?.length || 0) + (profile.leadership?.length || 0);
  rawScore += Math.min(10, 4 + experienceCount * 2);

  // CRITICAL RULE: "Hard disqualifiers should override the percentage.
  // Example: A user cannot receive '98% match' if they fail a mandatory requirement."
  let finalScore = rawScore;
  let status: EligibilityResult['status'] = 'eligible';
  let summary = 'You satisfy all verified core criteria for this scholarship.';

  if (hardDisqualified) {
    // Cap score at 38% maximum and explicitly state disqualification
    finalScore = Math.min(38, Math.round(rawScore * 0.4));
    status = 'not_eligible';
    summary = hardDisqualificationReason || 'Mandatory eligibility requirements are not currently met.';
  } else if (finalScore >= 85) {
    status = 'strong_match';
    summary = 'Strong Match — Your academic background and profile are highly aligned.';
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
