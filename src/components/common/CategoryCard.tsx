import React from 'react';
import { Category } from '../../types';
import { 
  Cpu, Briefcase, Palette, GraduationCap, 
  Award, HeartPulse, BookOpen, ArrowRight, FolderTree 
} from 'lucide-react';

interface CategoryCardProps {
  category: Category;
  count?: number;
  onSelect: (categoryName: string) => void;
  selected?: boolean;
}

const getCategoryIcon = (nameOrIcon: string) => {
  const lower = nameOrIcon.toLowerCase();
  if (lower.includes('stem') || lower.includes('tech') || lower.includes('cpu')) {
    return Cpu;
  }
  if (lower.includes('business') || lower.includes('finance') || lower.includes('briefcase')) {
    return Briefcase;
  }
  if (lower.includes('art') || lower.includes('humanities') || lower.includes('palette')) {
    return Palette;
  }
  if (lower.includes('undergrad') || lower.includes('graduation')) {
    return GraduationCap;
  }
  if (lower.includes('postgrad') || lower.includes('phd') || lower.includes('doctorate')) {
    return Award;
  }
  if (lower.includes('health') || lower.includes('medicine') || lower.includes('heart')) {
    return HeartPulse;
  }
  return FolderTree;
};

const getCategoryStyles = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('stem') || lower.includes('tech')) {
    return {
      iconBg: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      borderHover: 'hover:border-indigo-400 hover:shadow-indigo-100/50'
    };
  }
  if (lower.includes('business') || lower.includes('finance')) {
    return {
      iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      borderHover: 'hover:border-emerald-400 hover:shadow-emerald-100/50'
    };
  }
  if (lower.includes('art') || lower.includes('humanities')) {
    return {
      iconBg: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
      badgeBg: 'bg-violet-50 text-violet-700 border-violet-100',
      borderHover: 'hover:border-violet-400 hover:shadow-violet-100/50'
    };
  }
  if (lower.includes('undergrad')) {
    return {
      iconBg: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-100',
      borderHover: 'hover:border-sky-400 hover:shadow-sky-100/50'
    };
  }
  if (lower.includes('postgrad') || lower.includes('phd')) {
    return {
      iconBg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-100',
      borderHover: 'hover:border-amber-400 hover:shadow-amber-100/50'
    };
  }
  if (lower.includes('health') || lower.includes('medicine')) {
    return {
      iconBg: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-100',
      borderHover: 'hover:border-rose-400 hover:shadow-rose-100/50'
    };
  }
  return {
    iconBg: 'bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    borderHover: 'hover:border-slate-400 hover:shadow-slate-100'
  };
};

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  count,
  onSelect,
  selected = false
}) => {
  const IconComponent = getCategoryIcon(category.iconName || category.name);
  const styles = getCategoryStyles(category.name);
  const displayCount = count !== undefined ? count : (category.scholarshipCount || 0);

  const handleClick = () => {
    onSelect(category.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(category.name);
    }
  };

  return (
    <div
      id={`category-card-${category.slug || category.id}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Explore ${category.name} scholarships`}
      className={`group relative text-left w-full p-5 sm:p-6 rounded-2xl bg-white border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 flex flex-col justify-between min-h-[140px] select-none ${
        selected
          ? 'border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/20'
          : `border-slate-200/90 ${styles.borderHover}`
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0 ${styles.iconBg}`}>
            <IconComponent size={22} className="stroke-[2.2]" />
          </div>

          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${styles.badgeBg}`}>
            {displayCount} {displayCount === 1 ? 'Award' : 'Opportunities'}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
          {category.name}
        </h3>

        {category.description && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-normal">
            {category.description}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
        <span>Explore Scholarships</span>
        <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform duration-200" />
      </div>
    </div>
  );
};
