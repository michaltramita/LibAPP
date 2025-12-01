import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const ModuleCard = ({ module, index }) => {
  const navigate = useNavigate();

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 + index * 0.05 }}
      className="
        relative overflow-hidden
        rounded-2xl
        bg-white/12
        border border-white/18
        shadow-[0_18px_45px_rgba(0,0,0,0.45)]
        backdrop-blur-xl
        px-5 py-4
        flex flex-col justify-between
        min-h-[150px]
      "
    >
      <div>
        <h4 className="font-semibold text-sm md:text-base text-slate-50 mb-1.5">
          {module.title}
        </h4>
        <p className="text-xs md:text-sm text-slate-100/75">
          {module.short_description}
        </p>
      </div>

      <div className="mt-4">
        <Button
          onClick={handleNavigateToModule}
          className="
            w-full group
            bg-white/90 hover:bg-white
            text-[#B81457]
            font-medium text-xs md:text-sm
            rounded-full
          "
        >
          Prejsť do modulu
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </motion.div>
  );
};

const ModuleSelector = ({ modules }) => {
  if (!modules || modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="
          mt-8
          rounded-3xl
          bg-white/6
          border border-white/20
          shadow-[0_18px_60px_rgba(0,0,0,0.55)]
          backdrop-blur-2xl
          px-6 py-6
        "
      >
        <h3 className="text-lg font-semibold text-slate-50 mb-2">
          Dostupné moduly
        </h3>
        <p className="text-sm text-slate-100/80">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  // Rozdelenie podľa názvu modulu
  const salesModules = modules.filter((m) => {
    const t = (m.title || '').toLowerCase();
    return t.includes('obchodný') || t.includes('ponúk');
  });

  const leadershipModules = modules.filter((m) => {
    const t = (m.title || '').toLowerCase();
    return t.includes('individuálny') || t.includes('koučing');
  });

  // Moduly, ktoré nespadajú ani do jednej kategórie
  const usedCodes = new Set(
    [...salesModules, ...leadershipModules].map((m) => m.code)
  );
  const otherModules = modules.filter((m) => !usedCodes.has(m.code));

  const sections = [];
  if (salesModules.length) {
    sections.push({ key: 'SALES', label: 'SALES', items: salesModules });
  }
  if (leadershipModules.length) {
    sections.push({
      key: 'LEADERSHIP',
      label: 'LEADERSHIP',
      items: leadershipModules,
    });
  }
  if (otherModules.length) {
    sections.push({
      key: 'OTHER',
      label: 'OSTATNÉ MODULY',
      items: otherModules,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="mt-8"
    >
      <h3 className="text-lg md:text-xl font-semibold text-slate-50 mb-4">
        Dostupné moduly
      </h3>

      <div className="space-y-7">
        {sections.map((section, sectionIndex) => (
          <section key={section.key} className="space-y-3">
            <div className="text-[11px] tracking-[0.22em] uppercase text-slate-100/75">
              {section.label}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {section.items.map((module, idx) => (
                <ModuleCard
                  key={module.code}
                  module={module}
                  index={sectionIndex * 10 + idx}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </motion.div>
  );
};

export default ModuleSelector;
