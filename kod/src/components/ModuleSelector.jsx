// src/components/ModuleSelector.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const ModuleCard = ({ module, index }) => {
  const navigate = useNavigate();

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="
        glass-chip
        h-full
        min-h-[160px]
        p-5
        flex flex-col justify-between
      "
    >
      <div>
        <h4 className="font-semibold text-base text-slate-900 mb-1.5">
          {module.title}
        </h4>
        <p className="text-xs text-slate-700/80 leading-relaxed">
          {module.short_description}
        </p>
      </div>

      <button
        type="button"
        onClick={handleNavigateToModule}
        className="
          mt-4 inline-flex items-center justify-center
          w-full rounded-full
          bg-[#B81457] hover:bg-[#9e123f]
          text-white text-xs font-medium
          px-4 py-2.5
          transition-colors
          group
        "
      >
        Prejsť do modulu
        <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </motion.div>
  );
};

const ModuleSection = ({ title, modules, startIndex }) => {
  if (!modules || modules.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="text-[10px] tracking-[0.28em] uppercase text-slate-50/70">
        {title}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {modules.map((module, idx) => (
          <ModuleCard
            key={module.code}
            module={module}
            index={startIndex + idx}
          />
        ))}
      </div>
    </section>
  );
};

const ModuleSelector = ({ modules }) => {
  if (!modules || modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-panel p-6 mt-8"
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

  // Rozdelenie modulov – tu pokojne prispôsob kódy vašim reálnym
  const salesModules = modules.filter((m) =>
    ['OR01', 'TP01'].includes(m.code)
  );
  const leadershipModules = modules.filter((m) =>
    ['IR01', 'KC01'].includes(m.code)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-8 space-y-8"
    >
      <h3 className="text-lg font-semibold text-slate-50">
        Dostupné moduly
      </h3>

      <ModuleSection
        title="SALES"
        modules={salesModules}
        startIndex={0}
      />

      <ModuleSection
        title="LEADERSHIP"
        modules={leadershipModules}
        startIndex={salesModules.length}
      />
    </motion.div>
  );
};

export default ModuleSelector;
