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
    id: 'p-deadline',
    icon: '⏰',
    title: 'Upcoming Deadlines',
    prompt: "What scholarships are closing soon?",
    category: 'deadlines'
  },
  {
    id: 'p-readiness',
    icon: '📋',
    title: 'Readiness Check',
    prompt: "What am I missing before I apply?",
    category: 'readiness'
  },
  {
    id: 'p-apps',
    icon: '📊',
    title: 'Application Attention',
    prompt: "Which of my applications need attention?",
    category: 'applications'
  },
  {
    id: 'p-outcomes',
    icon: '🏆',
    title: 'Results & Shortlists',
    prompt: "What are my current application results?",
    category: 'outcomes'
  },
  {
    id: 'p-next',
    icon: '💡',
    title: 'Next Actions',
    prompt: "What should I do next?",
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
      return {
        content: res.reply,
        suggestedActions: res.suggestedActions,
        relatedScholarships: res.relatedScholarships
      };
    }
  } catch (err) {
    console.warn('Backend AI route unavailable or offline, generating client-side grounded response:', err);
  }

  // Client-side grounded fallback using local storage and canonical services
  return generateClientGroundedResponse(message, contextScholarshipId, userProfile);
}

/**
 * Client-side fallback grounded response generator
 */
function generateClientGroundedResponse(
  message: string,
  contextScholarshipId?: string,
  userProfile?: UserProfile
): Omit<ChatMessage, 'id' | 'timestamp' | 'role'> {
  const profile = userProfile || StorageService.getUserById('usr-student-001') || {
    id: 'usr-student-001',
    email: 'student@scholarpath.org',
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

  const lower = message.toLowerCase();

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

  // General fallback
  const topMatch = scholarships[0];
  return {
    content: `Hello ${profile.firstName}! I'm **ScholarPath AI**.\n\n` +
      `You currently have **${applications.length} applications** and **${documents.length} documents** in your vault.\n\n` +
      `Ask me any questions about finding scholarships, checking requirements, or tracking your deadlines!`,
    suggestedActions: [
      { label: 'Find Scholarships', path: '/scholarships' },
      { label: 'Document Vault', path: '/documents' },
      { label: 'My Applications', path: '/applications' }
    ]
  };
}
