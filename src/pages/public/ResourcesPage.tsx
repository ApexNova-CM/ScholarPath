import React from 'react';
import { BookOpen, FileText, CheckCircle2, ArrowRight, Download, Sparkles } from 'lucide-react';

interface ResourcesPageProps {
  onNavigate: (path: string) => void;
}

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ onNavigate }) => {
  const guides = [
    {
      title: 'Crafting a Competitive Personal Statement for Rhodes & Gates',
      category: 'Essay Guide',
      readTime: '6 min read',
      snippet: 'Learn how to construct a compelling narrative arc that demonstrates moral leadership, scholarly curiosity, and public purpose.',
    },
    {
      title: 'Deciphering Full Ride vs. Full Tuition: Financial Aid Breakdown',
      category: 'Financial Guide',
      readTime: '4 min read',
      snippet: 'A comprehensive overview of living stipends, health surcharges, college fees, and travel bursaries across the UK, US, and Europe.',
    },
    {
      title: 'Standardized Testing Benchmarks: GRE, TOEFL & IELTS Targets',
      category: 'Admissions Criteria',
      readTime: '5 min read',
      snippet: 'Realistic percentile score bands required by top-tier scholarship review boards across STEM and humanities programs.',
    },
    {
      title: 'How to Solicit High-Impact Academic & Faculty Letters of Recommendation',
      category: 'Dossier Preparation',
      readTime: '7 min read',
      snippet: 'Best practices for briefing your academic advisors and department chairs to ensure specific, evidence-backed reference evaluations.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#155EEF]">
          Scholarship Preparation & Guides
        </span>
        <h1 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0B1F46]">
          Scholar Knowledge Base & Resources
        </h1>
        <p className="text-sm sm:text-base text-[#64748B] leading-relaxed">
          Curated guides, statement frameworks, and admissions insights compiled by former fellowship recipients and university committee advisors.
        </p>
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {guides.map((guide, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs hover:border-[#155EEF]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="font-semibold text-[#155EEF]">{guide.category}</span>
                <span>{guide.readTime}</span>
              </div>
              <h2 className="font-sans text-base sm:text-lg font-bold text-[#0B1F46]">
                {guide.title}
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                {guide.snippet}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-[#64748B]">Free Scholar Resource</span>
              <button
                onClick={() => onNavigate('/scholarships')}
                className="text-xs font-semibold text-[#155EEF] hover:text-[#124bbf] flex items-center gap-1 cursor-pointer"
              >
                <span>Read Full Guide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Download Callout */}
      <div className="bg-[#F6F8FC] border border-[#E2E8F0] rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0B1F46]">
            <BookOpen className="w-4 h-4 text-[#155EEF]" />
            <span>Scholarship Application Dossier Checklist (PDF)</span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-xl">
            Download our complete 14-point institutional dossier audit checklist used by candidates applying for competitive 2026/27 global fellowships.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/scholarships')}
          className="px-6 py-3 bg-[#0B1F46] hover:bg-[#155EEF] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Access Checklist
        </button>
      </div>

    </div>
  );
};
