import React from 'react';
import { Category, Scholarship } from '../../types';
import { CategoryCard } from './CategoryCard';
import { Sparkles, ArrowRight } from 'lucide-react';

interface CategorySectionProps {
  categories: Category[];
  scholarships: Scholarship[];
  onSelectCategory: (categoryName: string) => void;
  title?: string;
  subtitle?: string;
  showExploreAll?: boolean;
  onExploreAll?: () => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categories,
  scholarships,
  onSelectCategory,
  title = "Explore Scholarships by Category",
  subtitle = "Discover curated funding programs categorized by discipline, degree level, and academic goals.",
  showExploreAll = true,
  onExploreAll
}) => {
  // Calculate dynamic scholarship counts per category
  const getCategoryCount = (cat: Category) => {
    const q = cat.name.toLowerCase();
    const slug = cat.slug.toLowerCase();
    return scholarships.filter(s => {
      if (s.status === 'archived' || s.status === 'rejected') return false;
      const schCat = (s.category || '').toLowerCase();
      if (schCat === q || schCat === slug) return true;
      if (q.includes('stem') && (schCat.includes('stem') || s.fieldsOfStudy.some(f => /computer|engineer|tech|science|math/i.test(f)))) {
        return true;
      }
      if (q.includes('business') && (schCat.includes('business') || schCat.includes('finance') || s.fieldsOfStudy.some(f => /business|finance|economics|management/i.test(f)))) {
        return true;
      }
      if (q.includes('arts') && (schCat.includes('art') || schCat.includes('humanities') || s.fieldsOfStudy.some(f => /art|history|literature|philosophy|design/i.test(f)))) {
        return true;
      }
      if (q.includes('undergraduate') && (schCat.includes('undergrad') || s.educationLevels.includes('Undergraduate'))) {
        return true;
      }
      if (q.includes('postgraduate') && (schCat.includes('postgrad') || schCat.includes('phd') || s.educationLevels.some(l => l.includes('Postgraduate') || l.includes('Doctorate')))) {
        return true;
      }
      if (q.includes('health') && (schCat.includes('health') || schCat.includes('medicine') || s.fieldsOfStudy.some(f => /health|medicine|nursing|biomedical|epidemiology/i.test(f)))) {
        return true;
      }
      return false;
    }).length;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl font-normal">
            {subtitle}
          </p>
        </div>

        {showExploreAll && onExploreAll && (
          <button
            id="btn-category-explore-all"
            onClick={onExploreAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0"
          >
            <span>View All Categories</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={getCategoryCount(category)}
            onSelect={onSelectCategory}
          />
        ))}
      </div>
    </section>
  );
};
