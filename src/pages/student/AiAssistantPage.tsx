import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Bot, User, ArrowRight, RefreshCw, 
  Target, Clock, FileText, CheckCircle2, AlertCircle, 
  Trash2, X, ChevronRight, ExternalLink, HelpCircle
} from 'lucide-react';
import { UserProfile, Scholarship, Application } from '../../types';
import { 
  ChatMessage, 
  STARTER_PROMPTS, 
  WORKSPACE_STARTER_PROMPTS, 
  sendStudentAIChat 
} from '../../services/aiService';

interface AiAssistantPageProps {
  userProfile: UserProfile;
  scholarships: Scholarship[];
  applications: Application[];
  initialScholarshipId?: string;
  onNavigate: (path: string) => void;
}

export const AiAssistantPage: React.FC<AiAssistantPageProps> = ({
  userProfile,
  scholarships,
  applications,
  initialScholarshipId,
  onNavigate
}) => {
  const [activeScholarshipId, setActiveScholarshipId] = useState<string | undefined>(initialScholarshipId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeScholarship = activeScholarshipId 
    ? scholarships.find(s => s.id === activeScholarshipId) 
    : undefined;

  // Initialize welcoming message
  useEffect(() => {
    const welcomeText = activeScholarship
      ? `Hello **${userProfile.firstName}**! I'm **Scholavon AI**.\n\nI'm currently focused on **${activeScholarship.title}**.\n\nYou can ask me about:\n- 🎯 **Why you got your Match Score**\n- 📋 **What documents and requirements you are missing**\n- ✍️ **How to draft your personal statement**\n- ⏰ **Key deadlines and next steps**`
      : `Hello **${userProfile.firstName}**! I'm **Scholavon AI**, your personal scholarship advisor.\n\nI have access to your verified academic profile in **${userProfile.fieldOfStudy || 'your degree'}** and your **${applications.length} tracked applications**.\n\nHow can I help you succeed today?`;

    const initialMsg: ChatMessage = {
      id: 'msg-welcome',
      role: 'assistant',
      content: welcomeText,
      timestamp: new Date().toISOString(),
      suggestedActions: activeScholarship
        ? [
            { label: 'Check Readiness', path: `/applications/${activeScholarship.id}/workspace` },
            { label: 'View Scholarship Details', path: `/scholarships/${activeScholarship.id}` }
          ]
        : [
            { label: 'Find Matches', path: '/scholarships' },
            { label: 'Application Tracker', path: '/applications' },
            { label: 'Document Vault', path: '/documents' }
          ]
    };

    setMessages([initialMsg]);
  }, [userProfile.firstName, userProfile.fieldOfStudy, activeScholarshipId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await sendStudentAIChat(
        query,
        [...messages, userMsg],
        activeScholarshipId,
        userProfile
      );

      const assistantMsg: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        suggestedActions: response.suggestedActions,
        relatedScholarships: response.relatedScholarships
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content: 'Scholavon AI is temporarily unavailable. Please try again in a few moments.',
          timestamp: new Date().toISOString(),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = () => {
    const welcomeMsg: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      role: 'assistant',
      content: `Conversation reset. How else can I assist you with your scholarship journey, **${userProfile.firstName}**?`,
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMsg]);
  };

  // Helper to render basic markdown bold and bullet lines cleanly
  const renderFormattedContent = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-slate-900 text-sm sm:text-base mt-2 mb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const rawContent = line.replace(/^[-*]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
                <span className="text-indigo-500 font-bold mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatBold(rawContent) }} />
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
          );
        })}
      </div>
    );
  };

  function formatBold(str: string): string {
    return str.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  }

  const currentPrompts = activeScholarship
    ? [...WORKSPACE_STARTER_PROMPTS, ...STARTER_PROMPTS.slice(0, 3)]
    : STARTER_PROMPTS;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto pb-2">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs mb-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Scholavon AI
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Assistant
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Personalized scholarship intelligence, readiness checks & application advisor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              title="Reset conversation"
            >
              <Trash2 size={13} />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        {activeScholarship && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/60">
            <div className="flex items-center gap-2 min-w-0">
              <Target size={14} className="text-indigo-600 shrink-0" />
              <span className="text-slate-600 truncate">
                Context: <strong className="text-slate-900 font-semibold">{activeScholarship.title}</strong>
              </span>
            </div>
            <button
              onClick={() => setActiveScholarshipId(undefined)}
              className="text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <X size={13} />
              <span>Clear Focus</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Messages View */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200/80 shadow-2xs'
              }`}
            >
              {msg.role === 'user' ? (
                <span>{userProfile.firstName[0]}</span>
              ) : (
                <Sparkles size={14} />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                  : msg.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {msg.content}
                </p>
              ) : (
                renderFormattedContent(msg.content)
              )}

              {/* Related Scholarship Cards */}
              {msg.relatedScholarships && msg.relatedScholarships.length > 0 && (
                <div className="mt-3 space-y-2 pt-2 border-t border-slate-200/70">
                  {msg.relatedScholarships.map(sch => (
                    <div
                      key={sch.id}
                      onClick={() => onNavigate(`/scholarships/${sch.id}`)}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-2xs cursor-pointer transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">{sch.title}</span>
                        <span className="text-[11px] text-slate-500 block truncate">{sch.providerName} · ${sch.amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sch.matchScore && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sch.matchScore}% Match
                          </span>
                        )}
                        <ChevronRight size={14} className="text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                  {msg.suggestedActions.map((act, aIdx) => (
                    <button
                      key={aIdx}
                      onClick={() => onNavigate(act.path)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <span>{act.label}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              )}

              <span className={`text-[10px] block mt-2 text-right ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
              <Sparkles size={14} className="animate-spin" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 shadow-2xs flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-500 font-medium">Scholavon AI is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="mt-2.5 overflow-x-auto pb-1 shrink-0">
        <div className="flex items-center gap-2 min-w-max">
          {currentPrompts.map(p => (
            <button
              key={p.id}
              onClick={() => handleSendMessage(p.prompt)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <span>{p.icon}</span>
              <span>{p.prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="mt-2 bg-white rounded-2xl border border-slate-200/90 p-2 shadow-2xs shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask me anything about scholarships, readiness, or deadlines..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-transparent border-none focus:outline-hidden text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Send size={14} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
