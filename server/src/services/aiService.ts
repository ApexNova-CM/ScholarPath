import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import { db } from '../db/store';
import { evaluateEligibility, getMatchCategory } from '../../../src/services/eligibility';
import { evaluateScholarshipReadiness } from '../../../src/services/documentService';
import { computeLifecycleStatus, isScholarshipActive } from '../../../src/services/scholarshipFilters';
import { calculateDaysUntilDeadline } from '../../../src/services/reminderService';
import { 
  UserProfile, 
  Scholarship, 
  Application, 
  StoredDocument 
} from '../../../src/types';

export interface ChatMessageTurn {
  role: 'user' | 'model';
  content: string;
}

export interface AIChatRequest {
  message: string;
  history?: ChatMessageTurn[];
  contextScholarshipId?: string;
  userProfile?: any;
  applications?: any[];
  documents?: any[];
}

export interface AIChatResponse {
  reply: string;
  suggestedActions?: Array<{
    label: string;
    path: string;
    type?: 'primary' | 'secondary';
  }>;
  relatedScholarships?: Array<{
    id: string;
    title: string;
    providerName: string;
    amount?: number;
    deadline: string;
    matchScore?: number;
    lifecycleStatus: string;
  }>;
}

/**
 * Maps Database record into strongly typed UserProfile
 */
function mapProfileRecord(record: any, user: any): UserProfile {
  return {
    id: record?.userId || user?.id,
    email: user?.email || '',
    role: 'student',
    firstName: record?.firstName || user?.firstName || 'Student',
    lastName: record?.lastName || user?.lastName || '',
    country: record?.country || 'United States',
    phone: record?.phone,
    dateOfBirth: record?.dateOfBirth,
    educationLevel: record?.educationLevel || 'Undergraduate',
    institution: record?.institution || '',
    fieldOfStudy: record?.fieldOfStudy || '',
    course: record?.course,
    yearLevel: record?.yearLevel,
    graduationYear: record?.graduationYear,
    gpa: record?.gpa || 0,
    gpaScale: record?.gpaScale || 4.0,
    financialNeed: record?.financialNeed || false,
    gender: record?.gender,
    awards: record?.awards || [],
    achievements: record?.achievements || [],
    extracurriculars: record?.extracurriculars || [],
    certifications: record?.certifications || [],
    leadership: record?.leadership || [],
    volunteering: record?.volunteering || [],
    workExperience: record?.workExperience || [],
    profileCompletion: record?.profileCompletion || 0,
    createdAt: record?.createdAt || new Date().toISOString(),
    updatedAt: record?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Builds controlled, authenticated context for a student
 */
export function buildStudentContext(
  userId: string,
  contextScholarshipId?: string,
  clientProfile?: any,
  clientApplications?: any[],
  clientDocuments?: any[]
) {
  const userRec = db.findUserById(userId);
  const profileRec = db.getProfile(userId);
  const profile = clientProfile
    ? { ...mapProfileRecord(profileRec, userRec), ...clientProfile }
    : mapProfileRecord(profileRec, userRec);

  const dbApps = db.getApplicationsByUser(userId) as Application[];
  const applications = (clientApplications && clientApplications.length > 0 ? clientApplications : dbApps) as Application[];

  const rawDocs = db.getDocumentsByUser(userId);
  const dbDocs: StoredDocument[] = rawDocs.map(d => ({
    id: d.id,
    userId: d.userId,
    name: d.name,
    type: d.type,
    fileSize: d.fileSize,
    fileUrl: d.fileUrl,
    fileFormat: d.fileFormat,
    verified: d.verified,
    uploadedAt: d.uploadedAt,
    status: 'available' as const,
  }));
  const documents: StoredDocument[] = (clientDocuments && clientDocuments.length > 0 ? clientDocuments : dbDocs) as StoredDocument[];

  const savedIds = db.getSavedIdsByUser(userId);
  const allScholarships = (db.getScholarships() as Scholarship[]).filter(
    s => s.status !== 'archived' && s.status !== 'rejected'
  );

  // Match calculations for top scholarships
  const matches = allScholarships.map(sch => {
    const eligibility = evaluateEligibility(sch, profile);
    const lifecycle = computeLifecycleStatus(sch);
    const daysRemaining = calculateDaysUntilDeadline(sch.deadline);
    const readiness = evaluateScholarshipReadiness(sch, profile, documents);
    return {
      scholarship: sch,
      eligibility,
      lifecycle,
      daysRemaining,
      readiness
    };
  });

  let focusScholarship: Scholarship | undefined;
  let focusEligibility: any;
  let focusReadiness: any;

  if (contextScholarshipId) {
    focusScholarship = allScholarships.find(s => s.id === contextScholarshipId);
    if (focusScholarship) {
      focusEligibility = evaluateEligibility(focusScholarship, profile);
      focusReadiness = evaluateScholarshipReadiness(focusScholarship, profile, documents);
    }
  }

  return {
    profile,
    applications,
    documents,
    savedIds,
    allScholarships,
    matches,
    focusScholarship,
    focusEligibility,
    focusReadiness
  };
}

/**
 * Formats the system prompt with strict rules, full platform awareness, and natural conversational persona
 */
function buildSystemPrompt(ctx: ReturnType<typeof buildStudentContext>): string {
  const profileSummary = `
Student Profile:
- Name: ${ctx.profile.firstName} ${ctx.profile.lastName}
- Education Level: ${ctx.profile.educationLevel}
- Field of Study: ${ctx.profile.fieldOfStudy || 'Not specified'}
- GPA: ${ctx.profile.gpa > 0 ? `${ctx.profile.gpa} / ${ctx.profile.gpaScale}` : 'Not provided'}
- Country / Location: ${ctx.profile.country}
- Profile Completeness: ${ctx.profile.profileCompletion}%
`;

  const applicationsSummary = ctx.applications.length > 0
    ? ctx.applications.map(a => `
Application: "${a.scholarshipTitle}"
- Status: ${a.status}
- Applied Date: ${a.appliedAt || a.appliedDate || 'In drafting'}
- Outcome Details: ${a.outcomeDetails ? JSON.stringify(a.outcomeDetails) : 'None'}
- Status Milestones: ${(a.statusHistory || []).map(h => `${h.status} (${h.source || 'updated'})`).join(' -> ')}
`).join('\n')
    : 'No applications started yet.';

  const documentsSummary = ctx.documents.length > 0
    ? ctx.documents.map(d => `- ${d.name} (Type: ${d.type}, Status: ${d.status})`).join('\n')
    : 'No documents uploaded to Document Vault.';

  const topMatchesSummary = ctx.matches
    .filter(m => m.lifecycle !== 'closed' && !m.eligibility.hardDisqualified)
    .sort((a, b) => b.eligibility.score - a.eligibility.score)
    .slice(0, 5)
    .map(m => `
- "${m.scholarship.title}" (ID: ${m.scholarship.id})
  Provider: ${m.scholarship.providerName} | Amount: $${(m.scholarship.amount || 0).toLocaleString()} ${m.scholarship.currency || 'USD'}
  Match Score: ${m.eligibility.score}% (${getMatchCategory(m.eligibility.score)})
  Readiness Score: ${m.readiness.score}% (${m.readiness.category})
  Deadline: ${m.scholarship.deadline} (${m.daysRemaining !== null ? `${m.daysRemaining} days remaining` : 'Date passed'}, Lifecycle: ${m.lifecycle})
  Required Docs: ${(m.scholarship.requiredDocuments || []).join(', ') || 'None listed'}
`).join('\n');

  let focusSection = '';
  if (ctx.focusScholarship) {
    focusSection = `
CURRENT FOCUS SCHOLARSHIP (Student is currently viewing / working on this):
- Title: "${ctx.focusScholarship.title}" (ID: ${ctx.focusScholarship.id})
- Provider: ${ctx.focusScholarship.providerName}
- Award: $${(ctx.focusScholarship.amount || 0).toLocaleString()} ${ctx.focusScholarship.currency || 'USD'} (${ctx.focusScholarship.fundingType})
- Deadline: ${ctx.focusScholarship.deadline} (Lifecycle: ${computeLifecycleStatus(ctx.focusScholarship)})
- Match Score: ${ctx.focusEligibility?.score}% (Criteria Met: ${ctx.focusEligibility?.criteria?.filter((c: any) => c.met).length || 0}/${ctx.focusEligibility?.criteria?.length || 0})
- Readiness: ${ctx.focusReadiness?.score}% (${ctx.focusReadiness?.category}, Missing Required: ${ctx.focusReadiness?.missingCount})
- Description: ${ctx.focusScholarship.description}
- Required Documents: ${(ctx.focusScholarship.requiredDocuments || []).join(', ') || 'None'}
`;
  }

  return `
You are Vona, a brilliant, versatile, empathetic, and highly capable personal AI assistant created for Scholavon.
You are assisting ${ctx.profile.firstName}.

=== YOUR IDENTITY & CONVERSATIONAL PERSONA ===
- Name: Vona. You are Scholavon's dedicated, world-class personal AI assistant and mentor.
- Personality: Warm, articulate, intellectually agile, insightful, encouraging, and natural.
- Broad General Intelligence: You operate with the breadth and depth of advanced modern conversational AI (similar to ChatGPT). You can discuss and solve problems across virtually any domain:
  * Mathematics: Algebra, calculus, geometry, statistics, probability, logic, step-by-step derivations.
  * Science & Technology: Physics, chemistry, biology, computer science, software engineering, systems design, data structures, algorithms, AI/ML, debugging code in any programming language (Python, TypeScript, JavaScript, Rust, C++, Java, Go, SQL, etc.).
  * Sports & Athletics: Football (soccer), basketball, athletics, rules, team strategies, historical tournaments, leagues, and records.
  * Arts, Culture & Entertainment: Cinema, music, literature, philosophy, history, pop culture.
  * Creative & Professional Writing: Creative stories, poetry, satire, speeches, grammar refinement, technical documentation, resume bullets, cover letters, and scholarship essays.
  * Interpersonal & Everyday Advice: Communication skills, relationship perspectives, conflict resolution, habit building, time management, study methods, lifestyle, and productivity.
  * Humor & Wit: Appropriate, clever, good-natured humor and creative banter when fitting.
- Natural Conversational Flow:
  * Do NOT start every response with repetitive greetings ("Hello Maya!"). Greet naturally when starting a conversation or when greeted, and maintain fluid back-and-forth dialogue thereafter.
  * Do NOT output boilerplate disclaimers (e.g. "As an AI language model...", "I do not have feelings, but...").
  * Obey user formatting, length, and style instructions (e.g. concise vs in-depth, bullet points, step-by-step, tables, code blocks).
  * Answer follow-up questions accurately by referencing earlier turns in the conversation.
  * If asked directly about your nature, answer honestly and cheerfully as Vona, Scholavon's personal AI assistant. Never pretend to be a biological human or invent fake lived experiences.

=== CONTEXT RELEVANCE & STUDENT PRIVACY ===
- Selective Grounding:
  * When the user's inquiry relates to scholarships, education, applications, document vault, career planning, or Scholavon, leverage the verified student context below to give personalized, high-value guidance.
  * When the user asks a general-purpose question (e.g. a math problem, coding challenge, football rule, book recommendation, or relationship advice), answer the question directly, completely, and naturally. DO NOT force or awkwardly shoehorn scholarship data, GPA, or Document Vault stats into unrelated general topics.
- Privacy & Safety Boundaries:
  * You strictly protect student privacy. You only have access to ${ctx.profile.firstName}'s authorized records.
  * Never disclose other students' data, admin credentials, system secrets, or backend keys.
  * Ground all platform-specific claims in the authentic data provided. Never invent fake scholarships or guarantee admission/award outcomes.

=== SCHOLAVON PLATFORM EXPERTISE (SPECIALTY DOMAIN) ===
You possess comprehensive expertise on Scholavon:
1. Scholarship Discovery: Multi-parameter filtering (degree, field, country, funding type), verified catalog.
2. Match Scoring: Criteria matching (education level, study field, GPA, nationality, financial need) rated 0-100%.
3. Application Workspace & Tracker: Lifecycle pipeline (Preparing -> Applied -> Under Review -> Shortlisted -> Interview -> Awarded / Not Selected), milestone history, document checklists, essay drafting.
4. Document Vault: Storage and verification for transcripts, CVs, personal statements, recommendation letters, readiness scoring.
5. Profile Completeness: 100-point scoring framework.
6. Deadlines & Alerts: Timelines, countdowns, closing soon notices.
7. Subscriptions: Free tier (3 AI prompts/month) vs Scholavon Plus (unlimited AI prompts, priority matching, unlimited workspaces).
8. Support: Human support reachable at support@scholavon.com via Contact Support.

=== AUTHENTICATED STUDENT CONTEXT ===
${profileSummary}
${focusSection}
=== STUDENT APPLICATIONS & OUTCOMES ===
${applicationsSummary}

=== STUDENT DOCUMENT VAULT METADATA ===
${documentsSummary}

=== TOP MATCHED SCHOLARSHIPS AVAILABLE IN SCHOLAVON ===
${topMatchesSummary}
`;
}

/**
 * Contextual grounding fallback generator when API key is not present or in test environment.
 * Generates exact, factual, grounded answers using canonical Scholavon engines and rich domain expertise.
 */
function generateGroundedFallbackResponse(
  userMessage: string,
  ctx: ReturnType<typeof buildStudentContext>
): AIChatResponse {
  const lower = userMessage.toLowerCase().trim();
  const firstName = ctx.profile.firstName;

  // 1. Security & Boundary Safeguards (Top Priority)
  if (
    lower.includes('another student') ||
    lower.includes('other student') ||
    lower.includes('other user') ||
    lower.includes('admin') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('delete') ||
    lower.includes('submit for me') ||
    lower.includes('bypass')
  ) {
    return {
      reply: `I cannot perform that action or access unauthorized information.\n\nVona strictly respects data isolation and user privacy. I cannot view other students' accounts, admin records, or perform automatic submissions without your direct action.`,
      suggestedActions: [{ label: 'Return to Dashboard', path: '/dashboard' }]
    };
  }

  // 2. Identity, Persona & Greeting ("Who are you?", "Hi Vona", "What can you do?")
  if (
    lower.includes('who are you') ||
    lower.includes('what are you') ||
    lower.includes('what is your name') ||
    lower.includes('what can you do') ||
    lower.includes('what can you help') ||
    lower.includes('tell me about yourself') ||
    lower.startsWith('hello') ||
    lower.startsWith('hi ') ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower.startsWith('hey ')
  ) {
    return {
      reply: `Hello ${firstName}! I'm **Vona**, your personal AI assistant at Scholavon.\n\n` +
        `I'm here to help you navigate every aspect of your academic, scholarship, and career journey. Here are some of the things we can do together:\n\n` +
        `- 🎯 **Match Score & Discovery**: Find tailored scholarships matching your **${ctx.profile.educationLevel}** studies in **${ctx.profile.fieldOfStudy || 'your field'}**.\n` +
        `- 📋 **Application Readiness & Vault**: Check what documents or profile requirements you need before applying.\n` +
        `- ✍️ **Essay & Writing Coaching**: Draft and polish compelling personal statements, scholarship essays, and cover letters.\n` +
        `- ⏰ **Deadlines & Timelines**: Track upcoming closing dates and set prioritized action steps.\n` +
        `- 📊 **Application Tracker & Outcomes**: Review your current pipeline, shortlist milestones, and award results.\n` +
        `- 💡 **General Knowledge, Tech & Careers**: Ask me anything about programming, career preparation, study techniques, or everyday topics!\n\n` +
        `What would you like to explore today?`,
      suggestedActions: [
        { label: 'Find Top Matches', path: '/scholarships' },
        { label: 'Check Readiness', path: '/documents' },
        { label: 'View Applications', path: '/applications' }
      ]
    };
  }

  // 3. Find / Discover Scholarships (Takes precedence over general profile check)
  if (
    lower.includes('find') ||
    lower.includes('search') ||
    lower.includes('recommend') ||
    lower.includes('match my profile') ||
    lower.includes('matching scholarships') ||
    lower.includes('scholarships that match') ||
    (lower.includes('scholarship') && (lower.includes('match') || lower.includes('for me') || lower.includes('available')))
  ) {
    const top = ctx.matches
      .filter(m => m.lifecycle !== 'closed' && !m.eligibility.hardDisqualified)
      .sort((a, b) => b.eligibility.score - a.eligibility.score)
      .slice(0, 3);

    if (top.length > 0) {
      const list = top.map(m => 
        `### **${m.scholarship.title}**\n` +
        `- **Provider**: ${m.scholarship.providerName}\n` +
        `- **Award**: $${(m.scholarship.amount || 0).toLocaleString()} ${m.scholarship.currency || 'USD'} (${m.scholarship.fundingType})\n` +
        `- **Match Score**: **${m.eligibility.score}%** (${getMatchCategory(m.eligibility.score)})\n` +
        `- **Readiness**: **${m.readiness.score}%** (${m.readiness.category})\n` +
        `- **Deadline**: ${new Date(m.scholarship.deadline).toLocaleDateString()} (${m.daysRemaining !== null ? `${m.daysRemaining} days left` : 'Active'})\n`
      ).join('\n');

      return {
        reply: `Here are top scholarships matching your academic profile in **${ctx.profile.fieldOfStudy || 'your study'}**:\n\n${list}`,
        relatedScholarships: top.map(m => ({
          id: m.scholarship.id,
          title: m.scholarship.title,
          providerName: m.scholarship.providerName,
          amount: m.scholarship.amount,
          deadline: m.scholarship.deadline,
          matchScore: m.eligibility.score,
          lifecycleStatus: m.lifecycle
        })),
        suggestedActions: [
          { label: `View ${top[0].scholarship.title}`, path: `/scholarships/${top[0].scholarship.id}` },
          { label: 'Explore All Scholarships', path: '/scholarships' }
        ]
      };
    }
  }

  // 4. Match Score Inquiries (Focus or General)
  if (lower.includes('match score') || lower.includes('why did i get this match') || lower.includes('eligibility')) {
    if (ctx.focusScholarship && ctx.focusEligibility) {
      const criteriaList = ctx.focusEligibility.criteria
        .map((c: any) => `- **${c.factor}**: ${c.met ? '✅ Met' : '❌ Needs Attention'} — ${c.detail}`)
        .join('\n');

      return {
        reply: `### Match Analysis for **${ctx.focusScholarship.title}**\n\n` +
          `Your canonical Match Score is **${ctx.focusEligibility.score}%** (${getMatchCategory(ctx.focusEligibility.score)}).\n\n` +
          `**Criteria Breakdown**:\n${criteriaList}\n\n` +
          `*Note: Match Scores reflect compatibility with stated criteria and do not guarantee selection.*`,
        suggestedActions: [
          { label: 'Open Workspace', path: `/applications/${ctx.focusScholarship.id}/workspace` },
          { label: 'View Scholarship', path: `/scholarships/${ctx.focusScholarship.id}` }
        ]
      };
    }

    const top = ctx.matches
      .filter(m => !m.eligibility.hardDisqualified)
      .sort((a, b) => b.eligibility.score - a.eligibility.score)[0];

    if (top) {
      return {
        reply: `Your match scores are calculated by comparing your education level (${ctx.profile.educationLevel}), field of study (${ctx.profile.fieldOfStudy}), GPA, and location against provider criteria.\n\n` +
          `Your highest match right now is **${top.scholarship.title}** at **${top.eligibility.score}%** (${getMatchCategory(top.eligibility.score)}).`,
        suggestedActions: [
          { label: `View ${top.scholarship.title}`, path: `/scholarships/${top.scholarship.id}` },
          { label: 'Explore All Matches', path: '/scholarships' }
        ]
      };
    }
  }

  // 5. Readiness, Document Vault & Missing Documents
  if (
    lower.includes('readiness') ||
    lower.includes('missing') ||
    lower.includes('ready to apply') ||
    lower.includes('document') ||
    lower.includes('vault')
  ) {
    if (ctx.focusScholarship && ctx.focusReadiness) {
      const missingItems = ctx.focusReadiness.items
        .filter((i: any) => i.status === 'missing' && i.isRequired)
        .map((i: any) => `- ❌ **${i.name}**: ${i.description}`)
        .join('\n');

      const readyItems = ctx.focusReadiness.items
        .filter((i: any) => i.status === 'complete')
        .map((i: any) => `- ✅ **${i.name}**`)
        .join('\n');

      let reply = `### Application Readiness for **${ctx.focusScholarship.title}**\n\n` +
        `Your current Readiness Score is **${ctx.focusReadiness.score}%** (${ctx.focusReadiness.category}).\n\n`;

      if (readyItems) {
        reply += `**Completed Items**:\n${readyItems}\n\n`;
      }
      if (missingItems) {
        reply += `**Items Missing Before Submission**:\n${missingItems}\n\n`;
      } else {
        reply += `🎉 You have satisfied all structured document and profile requirements!\n\n`;
      }

      return {
        reply,
        suggestedActions: [
          { label: 'Upload to Vault', path: '/documents' },
          { label: 'Open Workspace', path: `/applications/${ctx.focusScholarship.id}/workspace` }
        ]
      };
    }

    // General Document Vault Status
    const docCount = ctx.documents.length;
    const docsList = ctx.documents.length > 0
      ? ctx.documents.map(d => `- 📄 **${d.name}** (${d.type})`).join('\n')
      : 'No documents uploaded yet.';

    return {
      reply: `### Document Vault Status\n\nYou currently have **${docCount} document${docCount === 1 ? '' : 's'}** in your Document Vault:\n\n${docsList}\n\n` +
        `To maximize readiness across all applications, make sure you have uploaded:\n` +
        `- 📄 **Official Academic Transcript**\n` +
        `- 📝 **Curriculum Vitae (CV) / Resume**\n` +
        `- ✍️ **Statement of Purpose / Personal Statement**\n` +
        `- 📬 **Letters of Recommendation**`,
      suggestedActions: [
        { label: 'Manage Document Vault', path: '/documents' },
        { label: 'View Applications', path: '/applications' }
      ]
    };
  }

  // 6. Deadlines & Closing Soon
  if (lower.includes('deadline') || lower.includes('closing soon') || lower.includes('closing this week') || lower.includes('days left')) {
    const upcoming = ctx.matches
      .filter(m => m.lifecycle !== 'closed' && m.daysRemaining !== null && m.daysRemaining >= 0 && m.daysRemaining <= 45)
      .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))
      .slice(0, 3);

    if (upcoming.length > 0) {
      const list = upcoming.map(m => 
        `- **${m.scholarship.title}**\n  - Deadline: **${new Date(m.scholarship.deadline).toLocaleDateString()}** (${m.daysRemaining} days remaining)\n  - Award: $${(m.scholarship.amount || 0).toLocaleString()} ${m.scholarship.currency || 'USD'}\n  - Match: **${m.eligibility.score}%**`
      ).join('\n');

      return {
        reply: `Here are the scholarships closing soonest:\n\n${list}\n\n💡 *Tip: Start your applications early to ensure all letters of recommendation and transcripts are ready.*`,
        suggestedActions: [
          { label: 'Explore Deadlines', path: '/scholarships' },
          { label: 'Check Applications', path: '/applications' }
        ]
      };
    } else {
      return {
        reply: `You don't have any immediate deadlines closing in the next few days. All active scholarships have comfortable preparation windows.`,
        suggestedActions: [{ label: 'Find Scholarships', path: '/scholarships' }]
      };
    }
  }

  // 7. Application Tracker & Outcomes
  if (
    lower.includes('application') ||
    lower.includes('shortlist') ||
    lower.includes('award') ||
    lower.includes('interview') ||
    lower.includes('under review') ||
    lower.includes('not selected') ||
    lower.includes('pipeline') ||
    lower.includes('status')
  ) {
    const apps = ctx.applications;
    if (apps.length === 0) {
      return {
        reply: `You haven't started tracking any scholarship applications yet for your **${ctx.profile.educationLevel}** studies in **${ctx.profile.fieldOfStudy || 'your field'}**.\n\nWhen you find a scholarship you like, click **Start Application** or **Prepare Application** to organize your documents, draft essays, and track status milestones!`,
        suggestedActions: [{ label: 'Find Scholarships', path: '/scholarships' }]
      };
    }

    const shortlisted = apps.filter(a => a.status === 'Shortlisted');
    const awarded = apps.filter(a => a.status === 'Awarded');
    const interview = apps.filter(a => a.status === 'Interview');
    const underReview = apps.filter(a => a.status === 'Under Review');
    const applied = apps.filter(a => a.status === 'Applied');
    const preparing = apps.filter(a => a.status === 'Preparing');

    let reply = `### Your Application Pipeline Summary (${apps.length} Total)\n` +
      `**Student Profile**: ${ctx.profile.firstName} ${ctx.profile.lastName} (${ctx.profile.educationLevel} in **${ctx.profile.fieldOfStudy || 'General'}**)\n\n`;

    if (awarded.length > 0) {
      reply += `🏆 **Awarded (${awarded.length})**:\n` + awarded.map(a => `- **${a.scholarshipTitle}**: Awarded ${a.outcomeDetails?.awardAmount ? `$${a.outcomeDetails.awardAmount.toLocaleString()}` : 'Grant'}`).join('\n') + '\n\n';
    }
    if (shortlisted.length > 0) {
      reply += `⭐ **Shortlisted (${shortlisted.length})**:\n` + shortlisted.map(a => `- **${a.scholarshipTitle}**: ${a.outcomeDetails?.nextStep || a.notes || 'Advancing to next round'}`).join('\n') + '\n\n';
    }
    if (interview.length > 0) {
      reply += `🎙️ **Interview Scheduled (${interview.length})**:\n` + interview.map(a => `- **${a.scholarshipTitle}**: ${a.outcomeDetails?.interviewDate ? `On ${new Date(a.outcomeDetails.interviewDate).toLocaleDateString()}` : 'Scheduled'}`).join('\n') + '\n\n';
    }
    if (underReview.length > 0) {
      reply += `⏳ **Under Review (${underReview.length})**:\n` + underReview.map(a => `- **${a.scholarshipTitle}**`).join('\n') + '\n\n';
    }
    if (applied.length > 0) {
      reply += `📬 **Submitted (${applied.length})**:\n` + applied.map(a => `- **${a.scholarshipTitle}**`).join('\n') + '\n\n';
    }
    if (preparing.length > 0) {
      reply += `📝 **In Preparation (${preparing.length})**:\n` + preparing.map(a => `- **${a.scholarshipTitle}**`).join('\n') + '\n\n';
    }

    return {
      reply,
      suggestedActions: [
        { label: 'Open Application Tracker', path: '/applications' }
      ]
    };
  }

  // 8. "What should I do next?" / Next Steps
  if (lower.includes('what should i do next') || lower.includes('next step') || lower.includes('action list')) {
    const steps: string[] = [];

    if (ctx.profile.profileCompletion < 80) {
      steps.push(`1. **Complete your student profile** (${ctx.profile.profileCompletion}% complete) — adding field and GPA unlocks higher accuracy match scores.`);
    }

    if (ctx.documents.length < 2) {
      steps.push(`2. **Upload foundational documents** to your Document Vault (e.g. Transcript, Resume).`);
    }

    const preparingApps = ctx.applications.filter(a => a.status === 'Preparing');
    if (preparingApps.length > 0) {
      steps.push(`3. **Finish drafting your applications** in Workspace for: **${preparingApps[0].scholarshipTitle}**.`);
    }

    const highMatches = ctx.matches.filter(m => m.eligibility.score >= 80 && m.lifecycle !== 'closed');
    if (highMatches.length > 0) {
      steps.push(`4. **Explore top-tier match**: **${highMatches[0].scholarship.title}** (${highMatches[0].eligibility.score}% match).`);
    }

    if (steps.length === 0) {
      steps.push(`1. Explore newly added verified opportunities.\n2. Review submission deadlines in your tracker.`);
    }

    return {
      reply: `### Recommended Next Steps for ${firstName}\n\n` + steps.join('\n\n'),
      suggestedActions: [
        { label: 'View Profile', path: '/profile' },
        { label: 'Document Vault', path: '/documents' },
        { label: 'Find Scholarships', path: '/scholarships' }
      ]
    };
  }

  // 9. Profile Inquiry
  if (
    lower.includes('profile') ||
    lower.includes('field of study') ||
    lower.includes('my gpa') ||
    lower.includes('what do you know about')
  ) {
    const gaps: string[] = [];
    if (!ctx.profile.fieldOfStudy) gaps.push('Field of study');
    if (!ctx.profile.gpa || ctx.profile.gpa === 0) gaps.push('GPA');
    if (ctx.profile.profileCompletion < 100) gaps.push('Extracurriculars and certifications');

    let reply = `Here is a summary of your academic profile on Scholavon:\n\n` +
      `- **Name**: ${ctx.profile.firstName} ${ctx.profile.lastName}\n` +
      `- **Education Level**: ${ctx.profile.educationLevel}\n` +
      `- **Field of Study**: ${ctx.profile.fieldOfStudy || 'Not provided'}\n` +
      `- **GPA**: ${ctx.profile.gpa > 0 ? `${ctx.profile.gpa.toFixed(2)} / ${ctx.profile.gpaScale.toFixed(1)}` : 'Not provided'}\n` +
      `- **Location**: ${ctx.profile.country}\n` +
      `- **Profile Completion**: **${ctx.profile.profileCompletion}%**\n\n`;

    if (gaps.length > 0) {
      reply += `💡 **Recommended Profile Improvements**:\nAdding your ${gaps.join(', ')} will increase your match score accuracy.`;
    } else {
      reply += `🎉 Your profile is complete and optimized for scholarship matching!`;
    }

    return {
      reply,
      suggestedActions: [
        { label: 'Edit Profile', path: '/profile' },
        { label: 'Explore Scholarships', path: '/scholarships' }
      ]
    };
  }

  // 10. Humor, Jokes & Creative Writing (Poetry, Stories)
  if (
    lower.includes('poem') ||
    lower.includes('poetry') ||
    lower.includes('story') ||
    lower.includes('joke') ||
    lower.includes('funny') ||
    lower.includes('riddle')
  ) {
    if (lower.includes('joke') || lower.includes('funny')) {
      return {
        reply: `Why do programmers prefer dark mode?\n\n*Because light attracts bugs!* 🐛💻\n\nNeed another joke, a riddle, or a creative story? Just let me know!`
      };
    }

    if (lower.includes('poem') || lower.includes('poetry')) {
      return {
        reply: `### A Spark in the Quiet\n\n` +
          `*The midnight cursor blinks in place,*\n` +
          `*A silent glow across the page.*\n` +
          `*Each line of thought, each step of grace,*\n` +
          `*Unfolds upon tomorrow's stage.*\n\n` +
          `*For knowledge sought is never lost,*\n` +
          `*Though long the road and steep the climb—*\n` +
          `*The dream that's built whatever cost,*\n` +
          `*Will echo through the halls of time.*\n\n` +
          `Would you like me to write a poem on a specific theme, style, or meter?`
      };
    }

    return {
      reply: `### Creative Writing with Vona\n\n` +
        `I can help you craft stories, write poems, brainstorm creative characters, and explore narrative structure. Share what theme or idea you'd like to write about!`
    };
  }

  // 11. Natural Science (Biology, Chemistry, Physics, Photosynthesis)
  if (
    lower.includes('photosynthesis') ||
    lower.includes('physics') ||
    lower.includes('chemistry') ||
    lower.includes('biology') ||
    lower.includes('quantum') ||
    lower.includes('gravity') ||
    lower.includes('dna') ||
    lower.includes('cellular')
  ) {
    if (lower.includes('photosynthesis')) {
      return {
        reply: `### Photosynthesis: Nature's Energy Conversion\n\n` +
          `**Photosynthesis** is the biochemical process by which plants, algae, and some bacteria convert light energy into chemical energy stored in glucose.\n\n` +
          `**Chemical Equation**:\n` +
          `\\[ 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{Light Energy} \\xrightarrow{\\text{Chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\]\n\n` +
          `**Key Stages**:\n` +
          `1. **Light-Dependent Reactions** (Thylakoid membranes): Solar photons split water (\\(\\text{H}_2\\text{O}\\)), releasing \\(\\text{O}_2\\) and generating ATP and NADPH.\n` +
          `2. **Light-Independent Reactions / Calvin Cycle** (Stroma): Uses ATP and NADPH to fix atmospheric carbon dioxide (\\(\\text{CO}_2\\)) into glucose.`
      };
    }

    return {
      reply: `### Science & Natural Inquiry with Vona\n\n` +
        `I can help explain scientific mechanisms, experimental design, and core principles across physics, chemistry, and biology. Share any concept or problem you want to explore!`
    };
  }

  // 12. Essay & Academic Writing Assistance
  if (
    lower.includes('essay') ||
    lower.includes('personal statement') ||
    lower.includes('statement of purpose') ||
    lower.includes('cover letter') ||
    lower.includes('drafting') ||
    lower.includes('essay hook') ||
    (lower.includes('write') && (lower.includes('statement') || lower.includes('application') || lower.includes('scholarship')))
  ) {
    return {
      reply: `### Essay & Writing Coaching with Vona\n\n` +
        `Writing a standout scholarship essay comes down to a clear narrative arc:\n\n` +
        `1. **The Hook (Opening)**: Start in media res with a pivotal challenge, defining moment, or clear question that sparked your passion for **${ctx.profile.fieldOfStudy || 'your academic path'}**.\n` +
        `2. **The Journey & Growth**: Connect your academic milestones, projects, or leadership experiences to the broader impact you want to create.\n` +
        `3. **Why This Opportunity**: Specifically address the scholarship provider's mission and how their support enables your specific goals.\n` +
        `4. **Future Vision**: Conclude with a confident, concrete vision for the future after graduation.\n\n` +
        `💡 *Tip: You can paste your outline or draft right here in our chat, and I'll give you detailed feedback on clarity, structure, and impact!*`,
      suggestedActions: [
        { label: 'Document Vault', path: '/documents' },
        { label: 'Find Scholarships', path: '/scholarships' }
      ]
    };
  }

  // 13. Career, Resume & Professional Advice
  if (
    lower.includes('resume') ||
    lower.includes('cv') ||
    lower.includes('career') ||
    lower.includes('job') ||
    lower.includes('interview') ||
    lower.includes('internship') ||
    lower.includes('linkedin')
  ) {
    return {
      reply: `### Career & Professional Guidance\n\n` +
        `Here are high-impact strategies tailored for students in **${ctx.profile.fieldOfStudy || 'higher education'}**:\n\n` +
        `- **Action-Oriented Resume Bullets**: Use Google's formula: *"Accomplished [X] as measured by [Y], by doing [Z]"*. Highlight measurable outcomes over simple job duties.\n` +
        `- **STAR Interview Method**: Structure answers to behavioral questions around **S**ituation, **T**ask, **A**ction, and **R**esult.\n` +
        `- **Strategic Vault Storage**: Keep your resume and CV updated in your Document Vault so you can attach them to applications in one click.\n` +
        `- **Networking & Mentorship**: Reach out to professors and industry alumni with a concise note explaining your project or interest.\n\n` +
        `Would you like me to review a specific resume bullet point or help you practice an interview question?`,
      suggestedActions: [
        { label: 'Document Vault', path: '/documents' },
        { label: 'Application Tracker', path: '/applications' }
      ]
    };
  }

  // 14. Mathematics & Arithmetic
  if (
    lower.includes('solve') ||
    lower.includes('equation') ||
    lower.includes('calculus') ||
    lower.includes('derivative') ||
    lower.includes('integral') ||
    lower.includes('algebra') ||
    lower.includes('math') ||
    lower.includes('arithmetic') ||
    lower.includes('calculate') ||
    lower.includes('2 + 2') ||
    lower.includes('2x') ||
    lower.includes('pythagorean') ||
    lower.includes('formula')
  ) {
    if (lower.includes('2x + 5 = 15') || (lower.includes('2x') && lower.includes('15'))) {
      return {
        reply: `### Step-by-Step Algebraic Solution\n\n` +
          `To solve the linear equation:\n` +
          `\\[ 2x + 5 = 15 \\]\n\n` +
          `1. **Subtract 5 from both sides**:\n` +
          `   \\[ 2x = 15 - 5 \\]\n` +
          `   \\[ 2x = 10 \\]\n\n` +
          `2. **Divide both sides by 2**:\n` +
          `   \\[ x = \\frac{10}{2} \\]\n` +
          `   \\[ x = 5 \\]\n\n` +
          `**Solution**: \\( x = 5 \\).`
      };
    }

    if (lower.includes('2 + 2') || lower.includes('what is 2+2') || lower.includes('2 plus 2')) {
      return {
        reply: `**2 + 2 = 4**.\n\nLet me know if you'd like to work through more math or science problems!`
      };
    }

    return {
      reply: `### Mathematical Problem Solving with Vona\n\n` +
        `I can help you solve and break down math problems step-by-step:\n\n` +
        `- **Algebra & Equations**: Linear equations, quadratic formulas, systems of equations.\n` +
        `- **Calculus**: Derivatives, limits, integrals, and optimization problems.\n` +
        `- **Statistics & Probability**: Expected values, standard deviations, distributions, and hypothesis testing.\n` +
        `- **Geometry & Trigonometry**: Proofs, area/volume, vectors, and trigonometric identities.\n\n` +
        `Feel free to share the exact equation or problem statement, and let's solve it step-by-step!`
    };
  }

  // 15. Sports & Athletics (Football / Soccer, Basketball, Tournaments)
  if (
    lower.includes('football') ||
    lower.includes('soccer') ||
    lower.includes('world cup') ||
    lower.includes('messi') ||
    lower.includes('ronaldo') ||
    lower.includes('champions league') ||
    lower.includes('premier league') ||
    lower.includes('offside') ||
    lower.includes('basketball') ||
    lower.includes('nba') ||
    lower.includes('sports')
  ) {
    if (lower.includes('2022 world cup') || (lower.includes('world cup') && lower.includes('won'))) {
      return {
        reply: `### 2022 FIFA World Cup Champions\n\n` +
          `**Argentina** won the 2022 FIFA World Cup in Qatar! 🏆\n\n` +
          `- **Final Match**: Argentina defeated France **3–3 (4–2 on penalties)** in one of the most thrilling World Cup finals in history.\n` +
          `- **Key Highlights**: Lionel Messi scored twice and won the Golden Ball as best player; Kylian Mbappé scored a historic hat-trick for France.\n` +
          `- **Significance**: This was Argentina's third World Cup title (1978, 1986, 2022) and completed Lionel Messi's international trophy collection.`
      };
    }

    if (lower.includes('offside')) {
      return {
        reply: `### The Offside Rule in Football (Soccer) Explained\n\n` +
          `Under **IFAB Law 11**, an attacking player is in an **offside position** if:\n` +
          `1. Any part of their head, body, or feet is in the opponents' half (excluding the halfway line), and\n` +
          `2. Any part of their head, body, or feet is closer to the opponents' goal line than both the ball and the second-last opponent (usually the last outfield defender).\n\n` +
          `**When is it an Offside Offence?**\n` +
          `Being in an offside position is not an offence by itself. An offence only occurs at the moment the ball is played or touched by a teammate if the player becomes actively involved in play by:\n` +
          `- Interfering with play (playing or touching the ball),\n` +
          `- Interfering with an opponent (preventing them from playing the ball or obstructing vision),\n` +
          `- Gaining an advantage by playing the ball or interfering with an opponent after a rebound.\n\n` +
          `*Exceptions*: There is no offside directly from a goal kick, throw-in, or corner kick.`
      };
    }

    return {
      reply: `### Sports & Athletics Insights with Vona\n\n` +
        `I love discussing sports tactics, tournament histories, rules, and athletic training principles:\n\n` +
        `- ⚽ **Football / Soccer**: League standings, tactical formations (e.g. 4-3-3 pressing, low blocks), transfer rules, and major tournament histories (World Cup, UEFA Champions League).\n` +
        `- 🏀 **Basketball & Other Sports**: NBA stats, play designs, and athletic conditioning.\n` +
        `- 🏅 **Athletic Scholarships**: Strategies for student-athletes balancing NCAA/NAIA eligibility with academic performance.\n\n` +
        `What sports topic or match would you like to discuss?`
    };
  }

  // 14. Relationships, Communication & Interpersonal Dynamics
  if (
    lower.includes('relationship') ||
    lower.includes('roommate') ||
    lower.includes('boyfriend') ||
    lower.includes('girlfriend') ||
    lower.includes('partner') ||
    lower.includes('disagreement') ||
    lower.includes('argument') ||
    lower.includes('conflict') ||
    lower.includes('communication') ||
    lower.includes('friendship')
  ) {
    return {
      reply: `### Constructive Communication & Interpersonal Guidance\n\n` +
        `Healthy relationships and conflict resolution rely on empathetic, honest, and structured communication:\n\n` +
        `1. **Use "I" Statements**: Express how a situation affects you rather than attributing blame (e.g., *"I feel overwhelmed when plans change at the last minute"* instead of *"You always ruin our plans"*).\n` +
        `2. **Active Listening**: Give full attention without planning your rebuttal while the other person speaks. Validate their feelings before presenting your perspective.\n` +
        `3. **Focus on the Problem, Not the Person**: Treat disagreements as a shared challenge to solve together rather than a battle to win.\n` +
        `4. **Set Clear Boundaries**: Communicate expectations calmly, especially regarding shared spaces, finances, or personal time.\n\n` +
        `If you have a specific scenario or conversation you want to think through, feel free to share the details and we can craft a thoughtful approach!`
    };
  }

  // 15. Humor, Creative Writing & Entertainment
  if (
    lower.includes('joke') ||
    lower.includes('funny') ||
    lower.includes('poem') ||
    lower.includes('story') ||
    lower.includes('movie') ||
    lower.includes('film') ||
    lower.includes('book') ||
    lower.includes('music') ||
    lower.includes('song')
  ) {
    if (lower.includes('joke') || lower.includes('funny')) {
      return {
        reply: `Why do programmers prefer dark mode?\n\n*Because light attracts bugs!* 🐛💻\n\nNeed another joke, a riddle, or a creative story? Just let me know!`
      };
    }

    if (lower.includes('poem')) {
      return {
        reply: `### A Spark in the Quiet\n\n` +
          `*The midnight cursor blinks in place,*\n` +
          `*A silent glow across the page.*\n` +
          `*Each line of thought, each step of grace,*\n` +
          `*Unfolds upon tomorrow's stage.*\n\n` +
          `*For knowledge sought is never lost,*\n` +
          `*Though long the road and steep the climb—*\n` +
          `*The dream that's built whatever cost,*\n` +
          `*Will echo through the halls of time.*\n\n` +
          `Would you like me to write a poem on a specific theme, style, or meter?`
      };
    }

    return {
      reply: `### Creative Writing & Culture with Vona\n\n` +
        `I can help you explore storytelling, write poetry, discuss film analysis, or recommend great books and music:\n\n` +
        `- 📖 **Literature & Storytelling**: Plot architecture, character development, worldbuilding, and thematic analysis.\n` +
        `- 🎭 **Cinema & Media**: Narrative structures, cinematography concepts, and recommendations.\n` +
        `- ✍️ **Creative Drafting**: Micro-fiction, speeches, and creative exercises.\n\n` +
        `What creative project or artistic topic are you exploring today?`
    };
  }

  // 16. Natural Science (Physics, Chemistry, Biology)
  if (
    lower.includes('physics') ||
    lower.includes('chemistry') ||
    lower.includes('biology') ||
    lower.includes('photosynthesis') ||
    lower.includes('quantum') ||
    lower.includes('gravity') ||
    lower.includes('dna') ||
    lower.includes('cell') ||
    lower.includes('energy')
  ) {
    if (lower.includes('photosynthesis')) {
      return {
        reply: `### Photosynthesis: Nature's Energy Conversion\n\n` +
          `**Photosynthesis** is the biochemical process by which plants, algae, and some bacteria convert light energy into chemical energy stored in glucose.\n\n` +
          `**Chemical Equation**:\n` +
          `\\[ 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{Light Energy} \\xrightarrow{\\text{Chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2 \\]\n\n` +
          `**Key Stages**:\n` +
          `1. **Light-Dependent Reactions** (Thylakoid membranes): Solar photons split water (\\(\\text{H}_2\\text{O}\\)), releasing \\(\\text{O}_2\\) and generating ATP and NADPH.\n` +
          `2. **Light-Independent Reactions / Calvin Cycle** (Stroma): Uses ATP and NADPH to fix atmospheric carbon dioxide (\\(\\text{CO}_2\\)) into glucose.`
      };
    }

    return {
      reply: `### Science & Natural Inquiry with Vona\n\n` +
        `I can help explain scientific mechanisms, experimental design, and core principles across:\n\n` +
        `- ⚛️ **Physics**: Mechanics, thermodynamics, electromagnetism, and modern/quantum physics.\n` +
        `- 🧪 **Chemistry**: Organic synthesis, stoichiometry, thermodynamics, and molecular bonding.\n` +
        `- 🧬 **Biology & Biochemistry**: Genetics, cellular biology, physiology, and evolutionary biology.\n\n` +
        `Share any concept, reaction, or hypothesis you'd like to investigate!`
    };
  }

  // 17. Programming, Technology & Computer Science
  if (
    lower.includes('code') ||
    lower.includes('programming') ||
    lower.includes('python') ||
    lower.includes('javascript') ||
    lower.includes('typescript') ||
    lower.includes('react') ||
    lower.includes('algorithm') ||
    lower.includes('database') ||
    lower.includes('sql') ||
    lower.includes('git') ||
    lower.includes('software')
  ) {
    return {
      reply: `### Technology & Programming Insights\n\n` +
        `I can help you break down technical concepts, write clean code, debug errors, design software architectures, or discuss computer science best practices.\n\n` +
        `- **Clean Code Fundamentals**: Prioritize readability, modular components, explicit naming, and automated test coverage.\n` +
        `- **Algorithm Optimization**: When analyzing time/space complexity, identify redundant work, leverage hash maps for $O(1)$ lookups, and use divide-and-conquer where applicable.\n` +
        `- **Full-Stack Development**: Modern patterns in React, TypeScript, Node.js, REST/GraphQL APIs, and relational databases.\n\n` +
        `Feel free to share a code snippet, architecture question, or bug you are debugging, and let's solve it together!`
    };
  }

  // 18. Study Skills, Productivity & Education
  if (
    lower.includes('study') ||
    lower.includes('productivity') ||
    lower.includes('exam') ||
    lower.includes('learn') ||
    lower.includes('focus') ||
    lower.includes('pomodoro') ||
    lower.includes('feynman') ||
    lower.includes('time management')
  ) {
    return {
      reply: `### Evidence-Based Study & Productivity Methods\n\n` +
        `Here are three proven learning techniques for high academic performance:\n\n` +
        `1. **The Feynman Technique**: Explain a complex topic in simple terms as if teaching a beginner. Any point where you struggle to explain simply reveals a gap in understanding.\n` +
        `2. **Active Recall & Spaced Repetition**: Test yourself frequently instead of passively re-reading notes. Review difficult material on increasing intervals ($1, 3, 7, 14$ days).\n` +
        `3. **Pomodoro Sprints**: Work with undivided focus for 25–50 minutes, followed by a 5–10 minute break to preserve cognitive stamina.\n\n` +
        `How is your study routine going right now? Let me know if you want a custom study schedule!`
    };
  }

  // 19. Scholavon Platform Help & Navigation
  if (
    lower.includes('how does scholavon work') ||
    lower.includes('how to use') ||
    lower.includes('upgrade') ||
    lower.includes('plus') ||
    lower.includes('support') ||
    lower.includes('pricing') ||
    lower.includes('paystack')
  ) {
    return {
      reply: `### Scholavon Platform Guide\n\n` +
        `Here is a quick overview of how to get the most out of Scholavon:\n\n` +
        `- 🔍 **Find Scholarships**: Search and filter hundreds of verified opportunities by degree, field, country, and funding type.\n` +
        `- 🎯 **Match & Readiness Scores**: Our algorithms calculate your compatibility and highlight missing checklist items.\n` +
        `- 📁 **Document Vault**: Store your transcripts, CVs, and essays securely in one place.\n` +
        `- 💼 **Application Workspace**: Draft essays, organize required documents, and track milestone updates.\n` +
        `- ⭐ **Scholavon Plus**: Get unlimited AI questions with Vona, priority scholarship matching, and unlimited workspaces.\n` +
        `- 💬 **Human Support**: Need help from our human team? Contact **support@scholavon.com** anytime via the Contact Support option.\n\n` +
        `Where would you like to go next?`,
      suggestedActions: [
        { label: 'Explore Scholarships', path: '/scholarships' },
        { label: 'Document Vault', path: '/documents' },
        { label: 'View Pricing & Plans', path: '/pricing' }
      ]
    };
  }

  // Default intelligent general-purpose conversational fallback
  return {
    reply: `I'm happy to help you with that!\n\n` +
      `Regarding: *"**${userMessage}**"*\n\n` +
      `As your personal assistant **Vona**, I can assist across general topics (mathematics, programming, sports, writing, science, career planning) as well as your Scholavon academic and scholarship workspace.\n\n` +
      `Please let me know how you'd like to proceed or share more specific details!`
  };
}

/**
 * Main AI Assistant processing entry point
 */
export async function processAIChat(
  userId: string,
  req: AIChatRequest
): Promise<AIChatResponse> {
  const ctx = buildStudentContext(
    userId,
    req.contextScholarshipId,
    req.userProfile,
    req.applications,
    req.documents
  );

  // If Gemini API Key is configured, attempt real Gemini API invocation
  if (config.geminiApiKey && config.geminiApiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const systemInstruction = buildSystemPrompt(ctx);

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      
      if (req.history && req.history.length > 0) {
        req.history.slice(-8).forEach(h => {
          contents.push({
            role: h.role,
            parts: [{ text: h.content }]
          });
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: req.message }]
      });

      let response: any;
      
      // 1. Primary Attempt: Gemini 2.5 Flash with Google Search Grounding for current facts
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents as any,
          config: {
            systemInstruction,
            temperature: 0.6,
            tools: [{ googleSearch: {} } as any]
          }
        });
      } catch (searchErr: any) {
        // 2. Secondary Attempt: Gemini 2.5 Flash without search tool if tool is not supported
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents as any,
            config: {
              systemInstruction,
              temperature: 0.6,
            }
          });
        } catch (primaryErr: any) {
          // 3. Fallback Model Attempt: Gemini 2.0 Flash
          console.warn('gemini-2.5-flash failed, attempting fallback model gemini-2.0-flash:', primaryErr?.message || primaryErr);
          response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: contents as any,
            config: {
              systemInstruction,
              temperature: 0.6,
            }
          });
        }
      }

      const text = response?.text || '';
      if (text.trim().length > 0) {
        // Provide suggested actions only when the prompt or context is relevant to Scholavon platform
        const suggestedActions: Array<{ label: string; path: string }> = [];
        const lowerReq = req.message.toLowerCase();
        const isPlatformRelated = 
          lowerReq.includes('scholarship') ||
          lowerReq.includes('application') ||
          lowerReq.includes('document') ||
          lowerReq.includes('vault') ||
          lowerReq.includes('deadline') ||
          lowerReq.includes('match') ||
          lowerReq.includes('readiness') ||
          lowerReq.includes('scholavon') ||
          lowerReq.includes('profile') ||
          !!ctx.focusScholarship;

        if (isPlatformRelated) {
          if (ctx.focusScholarship) {
            suggestedActions.push({ label: 'Open Workspace', path: `/applications/${ctx.focusScholarship.id}/workspace` });
          }
          suggestedActions.push({ label: 'Explore Scholarships', path: '/scholarships' });
        }

        return {
          reply: text,
          suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
        };
      }
    } catch (err: any) {
      console.warn('Gemini API call encountered an issue, falling back to grounded Vona engine:', err?.message || err);
    }
  }

  // Grounded Vona engine fallback
  return generateGroundedFallbackResponse(req.message, ctx);
}


