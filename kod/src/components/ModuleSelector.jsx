import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const glassCardClasses =
  'bg-white/80 backdrop-blur border border-slate-200/80 rounded-3xl shadow-[0_18px_45px_rgba(15,23,42,0.08)]';

const visualsByCategory = {
  sales: {
    badge: 'bg-rose-100 text-rose-700',
    accent: 'text-rose-700',
    halo: 'from-rose-50 via-white to-white',
    blob: 'bg-rose-200/70',
    image:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
  },
  leadership: {
    badge: 'bg-indigo-100 text-indigo-700',
    accent: 'text-indigo-700',
    halo: 'from-indigo-50 via-white to-white',
    blob: 'bg-indigo-200/70',
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
  },
  default: {
    badge: 'bg-slate-100 text-slate-700',
    accent: 'text-slate-700',
    halo: 'from-slate-50 via-white to-white',
    blob: 'bg-slate-200/70',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
  },
};

const moduleVisualPresets = [
  {
    match: (module, normalizedTitle) =>
      module.code === 'OR01' || normalizedTitle.includes('obchodný rozhovor'),
    visuals: {
      badge: 'bg-amber-100 text-amber-800',
      accent: 'text-amber-800',
      halo: 'from-amber-50 via-white to-white',
      blob: 'bg-amber-200/70',
      image:
        'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    },
  },
  {
    match: (module, normalizedTitle) =>
      normalizedTitle.includes('ponúk') || normalizedTitle.includes('ponuku'),
    visuals: {
      badge: 'bg-emerald-100 text-emerald-800',
      accent: 'text-emerald-800',
      halo: 'from-emerald-50 via-white to-white',
      blob: 'bg-emerald-200/70',
      image:
        'https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&w=1200&q=80',
    },
  },
  {
    match: (module, normalizedTitle) =>
      normalizedTitle.includes('senior') || normalizedTitle.includes('leadership'),
    visuals: {
      badge: 'bg-indigo-100 text-indigo-800',
      accent: 'text-indigo-800',
      halo: 'from-indigo-50 via-white to-white',
      blob: 'bg-indigo-200/70',
      image:
        'https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=1200&q=80',
    },
  },
];

const fallbackImages = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
];

const getVisualsForModule = (module, category, index) => {
  const normalizedTitle = (module?.title || '').toLowerCase();

  const preset = moduleVisualPresets.find(({ match }) => match(module, normalizedTitle));
  if (preset) {
    return preset.visuals;
  }

  const baseVisuals = visualsByCategory[category] || visualsByCategory.default;
  return {
    ...baseVisuals,
    image: fallbackImages[index % fallbackImages.length],
  };
};

const getCategoryKey = (title = '') => {
  const normalized = title.toLowerCase();

  if (normalized.includes('obchodný rozhovor') || normalized.includes('tvorba ponúk')) {
    return 'sales';
  }

  if (normalized.includes('individuálny rozhovor') || normalized.includes('koučing')) {
    return 'leadership';
  }

  return 'default';
};

const ModuleCard = ({ module, index, category }) => {
  const navigate = useNavigate();

  const visuals = getVisualsForModule(module, category, index);
  const description =
    module?.long_description || module?.description || module?.short_description;

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className={`${glassCardClasses} relative overflow-hidden p-6 sm:p-7 flex flex-col gap-6`}
    >
      <div
        className={`absolute inset-x-0 -top-10 h-32 bg-gradient-to-b ${visuals.halo} pointer-events-none`}
      />
      <div
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-60"
        style={{ backgroundColor: 'transparent' }}
      >
        <div className={`h-full w-full rounded-full ${visuals.blob}`} />
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.12em] ${visuals.badge}`}
          >
            {category === 'sales'
              ? 'Sales'
              : category === 'leadership'
                ? 'Leadership'
                : 'Modul'}
          </span>
          {module.estimated_time && (
            <span className="text-xs text-slate-500">{module.estimated_time}</span>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-xl text-slate-900 leading-tight">
            {module.title}
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />
          <img
            src={module.image_url || visuals.image}
            alt={module.title}
            className="h-36 w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      <Button
        onClick={handleNavigateToModule}
        className="w-full group bg-[#B81547] hover:bg-[#9e123d] text-white"
      >
        Prejsť do modulu
        <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
      </Button>
    </motion.div>
  );
};

const ModuleSelector = ({ modules }) => {
  if (!modules || modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className={`${glassCardClasses} p-6`}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-2">Dostupné moduly</h3>
        <p className="text-slate-500 text-sm">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  const categorizedModules = useMemo(() => {
    return modules.reduce(
      (acc, module) => {
        const categoryKey = getCategoryKey(module.title);
        if (categoryKey === 'sales') {
          acc.sales.push(module);
        } else if (categoryKey === 'leadership') {
          acc.leadership.push(module);
        } else {
          acc.other.push(module);
        }
        return acc;
      },
      { sales: [], leadership: [], other: [] }
    );
  }, [modules]);

  const groupedCount =
    categorizedModules.sales.length + categorizedModules.leadership.length;
  const useSimpleGrid = groupedCount === 0;

  if (useSimpleGrid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-bold text-slate-900">Dostupné moduly</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.code || module.title}
              module={module}
              index={index}
              category={getCategoryKey(module.title)}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="space-y-6"
    >
      <h3 className="text-lg font-bold text-slate-900">Dostupné moduly</h3>

      {categorizedModules.sales.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500">Sales</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categorizedModules.sales.map((module, index) => (
              <ModuleCard
                key={module.code || module.title}
                module={module}
                index={index}
                category="sales"
              />
            ))}
          </div>
        </section>
      )}

      {categorizedModules.leadership.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500">Leadership</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categorizedModules.leadership.map((module, index) => (
              <ModuleCard
                key={module.code || module.title}
                module={module}
                index={categorizedModules.sales.length + index}
                category="leadership"
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default ModuleSelector;
