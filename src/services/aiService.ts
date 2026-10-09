import { api } from '../lib/apiClient';
import { StorageService } from './storage';
import { evaluateEligibility, getMatchCategory } from './eligibility';
import { evaluateScholarshipReadiness } from './documentService';
import { calculateDaysUntilDeadline } from './reminderService';
import { computeLifecycleStatus } from './scholarshipFilters';
import { Scholarship, UserProfile, Application } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
  isError?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  icon: string;
  title: string;
  prompt: string;
  category: 'discovery' | 'deadlines' | 'readiness' | 'applications' | 'outcomes' | 'workspace';
}

export const STARTER_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'p-match',
    icon: '🎯',
    title: 'Match Recommendations',
    prompt: "Find scholarships that match my profile",
    category: 'discovery'
  },
  {
    id: 'p-readiness',
    icon: '📋',
    title: 'Readiness Check',
    prompt: "What am I missing before I apply?",
    category: 'readiness'
  },
  {
    id: 'p-essay',
    icon: '✍️',
    title: 'Essay & Personal Statement',
    prompt: "How do I structure a compelling scholarship essay?",
    category: 'workspace'
  },
  {
    id: 'p-deadline',
    icon: '⏰',
    title: 'Upcoming Deadlines',
    prompt: "What scholarships are closing soon?",
    category: 'deadlines'
  },
  {
    id: 'p-career',
    icon: '💼',
    title: 'Career & Resume Advice',
    prompt: "What are high-impact resume tips for students?",
    category: 'discovery'
  },
  {
    id: 'p-guide',
    icon: '💡',
    title: 'Scholavon Platform Guide',
    prompt: "How do I use the Document Vault and Application Workspace?",
    category: 'workspace'
  }
];

export const WORKSPACE_STARTER_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'p-ws-missing',
    icon: '🔎',
    title: 'Missing Requirements',
    prompt: "What am I missing for this scholarship?",
    category: 'readiness'
  },
  {
    id: 'p-ws-match',
    icon: '🎯',
    title: 'Match Explanation',
    prompt: "Why did I get this Match Score?",
    category: 'discovery'
  },
  {
    id: 'p-ws-essay',
    icon: '✍️',
    title: 'Draft Essay Hook',
    prompt: "Help me outline an essay for this scholarship",
    category: 'workspace'
  },
  {
    id: 'p-ws-explain',
    icon: '💡',
    title: 'Explain Terms',
    prompt: "Explain this scholarship to me in simple terms",
    category: 'workspace'
  }
];

/**
 * Sends a message to the AI Assistant backend endpoint, with client-side fallback
 */
export async function sendStudentAIChat(
  message: string,
  history: ChatMessage[] = [],
  contextScholarshipId?: string,
  userProfile?: UserProfile
): Promise<Omit<ChatMessage, 'id' | 'timestamp' | 'role'>> {
  try {
    const formattedHistory = history.map(h => ({
      role: (h.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      content: h.content
    }));

    const applications = userProfile?.id ? StorageService.getApplications(userProfile.id) : [];
    const documents = userProfile?.id ? StorageService.getDocuments(userProfile.id) : [];

    const res = await api.post<{
      reply: string;
      suggestedActions?: Array<{ label: string; path: string }>;
      relatedScholarships?: any[];
    }>('/student/ai/chat', {
      message,
      history: formattedHistory,
      contextScholarshipId,
      userProfile,
      applications,
      documents
    });

    if (res && res.reply) {
      if (userProfile?.id && userProfile.subscriptionStatus !== 'premium') {
        StorageService.incrementMonthlyAiPromptUsage(userProfile.id);
      }
      return {
        content: res.reply,
        suggestedActions: res.suggestedActions,
        relatedScholarships: res.relatedScholarships
      };
    }
  } catch (err: any) {
    const isUpgradeRequired = 
      err?.code === 'UPGRADE_REQUIRED' || 
      err?.response?.data?.code === 'UPGRADE_REQUIRED' ||
      err?.response?.status === 403 ||
      err?.message?.includes('UPGRADE_REQUIRED') ||
      err?.message?.includes('limit reached');

    if (isUpgradeRequired) {
      const customErr: any = new Error(err?.response?.data?.error || err?.message || 'Monthly AI prompt limit reached. Upgrade to Scholavon Plus for unlimited AI assistance with Vona.');
      customErr.code = 'UPGRADE_REQUIRED';
      throw customErr;
    }

    console.warn('Backend AI route unavailable or offline, generating client-side grounded response:', err);
  }

  // Client-side grounded fallback using local storage and canonical services
  return generateClientGroundedResponse(message, contextScholarshipId, userProfile);
}

/**
 * Client-side fallback grounded response generator featuring Vona
 */
function generateClientGroundedResponse(
  message: string,
  contextScholarshipId?: string,
  userProfile?: UserProfile
): Omit<ChatMessage, 'id' | 'timestamp' | 'role'> {
  const profile = userProfile || StorageService.getUserById('usr-student-001') || {
    id: 'usr-student-001',
    email: 'student@scholavon.org',
    role: 'student',
    firstName: 'Student',
    lastName: '',
    country: 'United States',
    educationLevel: 'Undergraduate',
    institution: '',
    fieldOfStudy: '',
    gpa: 0,
    gpaScale: 4.0,
    profileCompletion: 50,
    createdAt: '',
    updatedAt: ''
  };

  if (profile.subscriptionStatus !== 'premium') {
    const currentUsage = StorageService.getMonthlyAiPromptUsage(profile.id);
    if (currentUsage.used >= 3) {
      const quotaErr: any = new Error('Monthly AI assistant prompt limit reached (3 prompts/month on Free tier). Upgrade to Scholavon Plus for unlimited AI assistance with Vona.');
      quotaErr.code = 'UPGRADE_REQUIRED';
      throw quotaErr;
    }
    StorageService.incrementMonthlyAiPromptUsage(profile.id);
  }

  const scholarships = StorageService.getScholarships().filter(s => s.status !== 'archived' && s.status !== 'rejected');
  const applications = StorageService.getApplications(profile.id);
  const documents = StorageService.getDocuments(profile.id);

  let focusSch: Scholarship | undefined;
  let focusEligibility: any;
  let focusReadiness: any;

  if (contextScholarshipId) {
    focusSch = scholarships.find(s => s.id === contextScholarshipId);
    if (focusSch) {
      focusEligibility = evaluateEligibility(focusSch, profile);
      focusReadiness = evaluateScholarshipReadiness(focusSch, profile, documents);
    }
  }

  const lower = message.toLowerCase().trim();

  // Security & Boundaries
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
      content: `I cannot perform that action or access unauthorized information.\n\nVona strictly respects user privacy and data boundaries. I cannot view other students' private records or perform automatic submissions without your direct action.`,
      suggestedActions: [{ label: 'Return to Dashboard', path: '/dashboard' }]
    };
  }

  // Identity / Greeting
  if (
    lower.includes('who are you') ||
    lower.includes('what are you') ||
    lower.includes('what is your name') ||
    lower.includes('what can you do') ||
    lower.includes('what can you help') ||
    lower.startsWith('hello') ||
    lower.startsWith('hi ') ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey' ||
    lower.startsWith('hey ')
  ) {
    return {
      content: `Hello ${profile.firstName}! I'm **Vona**, your personal AI assistant at Scholavon.\n\n` +
        `I'm here to support your entire academic, scholarship, and career journey:\n\n` +
        `- 🎯 **Match Recommendations**: Find tailored scholarships for your **${profile.educationLevel}** studies in **${profile.fieldOfStudy || 'your study'}**.\n` +
        `- 📋 **Application Readiness**: Check what documents or profile requirements you need before applying.\n` +
        `- ✍️ **Essay & Writing Coaching**: Draft and polish compelling personal statements and essays.\n` +
        `- ⏰ **Upcoming Deadlines**: Track closing opportunities and prioritize next steps.\n` +
        `- 📊 **Application Tracker**: Monitor your application pipeline and outcome milestones.\n` +
        `- 💡 **Everyday & Technical Questions**: Ask me about coding, career planning, productivity, or study habits!\n\n` +
        `How can I help you succeed today?`,
      suggestedActions: [
        { label: 'Find Scholarships', path: '/scholarships' },
        { label: 'Document Vault', path: '/documents' },
        { label: 'My Applications', path: '/applications' }
      ]
    };
  }

  // Match / Eligibility
  if (lower.includes('match') || lower.includes('eligible')) {
    if (focusSch && focusEligibility) {
      return {
        content: `### Match Analysis: **${focusSch.title}**\n\n` +
          `Your Match Score is **${focusEligibility.score}%** (${getMatchCategory(focusEligibility.score)}).\n\n` +
          focusEligibility.criteria.map((c: any) => `- **${c.factor}**: ${c.met ? '✅ Met' : '❌ Needs Attention'} (${c.detail})`).join('\n') +
          `\n\n*Scores reflect requirements compatibility and do not guarantee selection.*`,
        suggestedActions: [
          { label: 'Open Workspace', path: `/applications/${focusSch.id}/workspace` },
          { label: 'View Scholarship', path: `/scholarships/${focusSch.id}` }
        ]
      };
    }
  }

  // Readiness / Missing
  if (lower.includes('readiness') || lower.includes('missing') || lower.includes('ready')) {
    if (focusSch && focusReadiness) {
      const missing = focusReadiness.items.filter((i: any) => i.status === 'missing' && i.isRequired);
      return {
        content: `### Application Readiness: **${focusSch.title}**\n\n` +
          `Your Readiness Score is **${focusReadiness.score}%** (${focusReadiness.category}).\n\n` +
          (missing.length > 0 
            ? `**Missing Required Items**:\n` + missing.map((i: any) => `- ❌ **${i.name}**: ${i.description}`).join('\n')
            : `🎉 All required documents and profile details are ready for submission!`),
        suggestedActions: [
          { label: 'Upload Documents', path: '/documents' },
          { label: 'Open Workspace', path: `/applications/${focusSch.id}/workspace` }
        ]
      };
    }
  }

  // Deadlines
  if (lower.includes('deadline') || lower.includes('closing')) {
    const closing = scholarships
      .map(s => ({ sch: s, days: calculateDaysUntilDeadline(s.deadline), lifecycle: computeLifecycleStatus(s) }))
      .filter(s => s.lifecycle !== 'closed' && s.days !== null && s.days >= 0 && s.days <= 45)
      .sort((a, b) => (a.days || 0) - (b.days || 0))
      .slice(0, 3);

    if (closing.length > 0) {
      return {
        content: `Here are the scholarships with upcoming deadlines:\n\n` +
          closing.map(c => `- **${c.sch.title}**: ${c.days} days remaining (Due ${new Date(c.sch.deadline).toLocaleDateString()})`).join('\n'),
        suggestedActions: [
          { label: 'Find Scholarships', path: '/scholarships' },
          { label: 'Application Tracker', path: '/applications' }
        ]
      };
    }
  }

  // Applications
  if (lower.includes('application') || lower.includes('shortlist') || lower.includes('result') || lower.includes('award')) {
    if (applications.length === 0) {
      return {
        content: `You haven't started any scholarship applications yet. Explore opportunities to find ones you like!`,
        suggestedActions: [{ label: 'Find Scholarships', path: '/scholarships' }]
      };
    }
    return {
      content: `### Your Applications (${applications.length} Total)\n\n` +
        applications.map(a => `- **${a.scholarshipTitle}**: ${a.status}${a.outcomeDetails?.awardAmount ? ` (Awarded $${a.outcomeDetails.awardAmount.toLocaleString()})` : ''}`).join('\n'),
      suggestedActions: [{ label: 'View Applications', path: '/applications' }]
    };
  }

  // General / Coding / Career / Writing fallback
  if (lower.includes('essay') || lower.includes('statement') || lower.includes('write')) {
    return {
      content: `### Essay & Writing Coaching with Vona\n\n` +
        `Writing a memorable scholarship essay requires focus and structure:\n\n` +
        `1. **Hook the Reader**: Start with a defining moment that sparked your interest in **${profile.fieldOfStudy || 'your study'}**.\n` +
        `2. **Demonstrate Growth**: Share concrete challenges you overcame and what you learned.\n` +
        `3. **Align with the Provider**: Mention how this scholarship empowers your specific future goals.\n\n` +
        `Paste your outline or draft anytime and I'll help you refine it!`,
      suggestedActions: [
        { label: 'Document Vault', path: '/documents' },
        { label: 'Find Scholarships', path: '/scholarships' }
      ]
    };
  }

  // General conversational response
  return {
    content: `Hello ${profile.firstName}! I'm **Vona**, your personal AI assistant.\n\n` +
      `Regarding *"**${message}**"*:\n\n` +
      `I can help you explore this topic in depth or connect it with your academic goals in **${profile.educationLevel}** (${profile.fieldOfStudy || 'General'}).\n\n` +
      `You currently have **${applications.length} applications** and **${documents.length} documents** in your vault. Let me know what you'd like to work on!`,
    suggestedActions: [
      { label: 'Find Scholarships', path: '/scholarships' },
      { label: 'Document Vault', path: '/documents' },
      { label: 'My Applications', path: '/applications' }
    ]
  };
}

