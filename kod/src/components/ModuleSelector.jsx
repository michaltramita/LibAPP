// src/components/ModuleSelector.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import GlassPanel from '@/components/GlassPanel';

const ModuleCard = ({ module, index }) => {
  const navigate = useNavigate();

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <GlassPanel className="h-full flex flex-col justify-between bg-white/16 border-white/35">
        <div>
          <h4 className="font-semibold text-base text-white mb-2">
            {module.title}
          </h4>
          <p className="text-xs text-white/80 mb-5">
            {module.short_description}
          </p>
        </div>
        <Button
          onClick={handleNavigateToModule}
          className="w-full group bg-white/90 hover:bg-white text-[#B81457] font-semibold text-xs border border-white/40"
        >
          Prejsť do modulu
          <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </GlassPanel>
    </motion.div>
  );
};

const ModuleSection = ({ title, modules }) => {
  if (!modules || modules.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
        {title}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modules.map((module, index) => (
          <ModuleCard key={module.code} module={module} index={index} />
        ))}
      </div>
    </div>
  );
};

const ModuleSelector = ({ modules }) => {
  if (!modules || modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-4"
      >
        <p className="text-sm font-semibold text-white mb-1">
          Dostupné moduly
        </p>
        <GlassPanel className="p-4 bg-white/8 border-white/25">
          <p className="text-sm text-white/80">
            Momentálne nie sú dostupné žiadne tréningové moduly.
          </p>
        </GlassPanel>
      </motion.div>
    );
  }

  // Rozdelenie modulov (podľa názvu – tak, ako si chcel)
  const salesModules = modules.filter((m) =>
    ['Obchodný rozhovor', 'Tvorba ponúk na mieru'].includes(m.title)
  );

  const leadershipModules = modules.filter((m) =>
    ['Individuálny rozhovor', 'Koučing'].includes(m.title)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="space-y-6 mt-4"
    >
      <h3 className="text-sm font-semibold text-white mb-2">
        Dostupné moduly
      </h3>

      <ModuleSection title="Sales" modules={salesModules} />
      <ModuleSection title="Leadership" modules={leadershipModules} />
    </motion.div>
  );
};

export default ModuleSelector;
