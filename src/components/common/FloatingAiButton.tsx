import React from 'react';
import { Sparkles } from 'lucide-react';

interface FloatingAiButtonProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const FloatingAiButton: React.FC<FloatingAiButtonProps> = ({
  currentPath,
  onNavigate
}) => {
  // Hide on the dedicated AI Assistant page
  if (currentPath === '/ai-assistant' || currentPath.startsWith('/ai-assistant?')) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-30">
      <button
        id="btn-floating-ai"
        onClick={() => onNavigate('/ai-assistant')}
        className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer border border-white/20 hover:scale-105"
        title="Ask ScholarPath AI"
        aria-label="Open ScholarPath AI Assistant"
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-white animate-pulse" />
        </div>
        <span className="text-xs font-bold tracking-tight pr-1 hidden sm:inline">
          Ask ScholarPath AI
        </span>
      </button>
    </div>
  );
};
