import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import GlassPanel from '@/components/GlassPanel';

const salesTitles = [
  'Obchodný rozhovor',
  'Tvorba ponúk na mieru',
];

const leadershipTitles = [
  'Individuálny rozhovor',
  'Koučing',
];

const ModuleCard = ({ module, index }) => {
  const navigate = useNavigate();

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="h-full"
    >
      <GlassPanel className="h-full flex flex-col justify-between p-5">
        <div>
          <h4 className="font-bold text-base text-slate-900 mb-2">
            {module.title}
          </h4>
          <p className="text-sm text-slate-600 mb-5">
            {module.short_description}
          </p>
        </div>
        <Button
          onClick={handleNavigateToModule}
          className="w-full group bg-[#B81457] hover:bg-[#9e123d] text-white"
        >
          Prejsť do modulu
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      </GlassPanel>
    </motion.div>
  );
};

const ModuleSection = ({ title, modules }) => {
  if (!modules || modules.length === 0) return null;

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold tracking-[0.22em] text-white/70 uppercase">
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modules.map((module, index) => (
          <ModuleCard key={module.code} module={module} index={index} />
        ))}
      </div>
    </section>
  );
};

const ModuleSelector = ({ modules }) => {
  if (!modules || modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <GlassPanel className="p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            Dostupné moduly
          </h3>
          <p className="text-slate-600">
            Momentálne nie sú dostupné žiadne tréningové moduly.
          </p>
        </GlassPanel>
      </motion.div>
    );
  }

  const salesModules = modules.filter((m) =>
    salesTitles.includes(m.title),
  );
  const leadershipModules = modules.filter((m) =>
    leadershipTitles.includes(m.title),
  );
  const otherModules = modules.filter(
    (m) =>
      !salesTitles.includes(m.title) &&
      !leadershipTitles.includes(m.title),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="space-y-8"
    >
      <h3 className="text-xl font-bold text-white mb-2">
        Dostupné moduly
      </h3>

      <ModuleSection title="SALES" modules={salesModules} />
      <ModuleSection title="LEADERSHIP" modules={leadershipModules} />
      <ModuleSection title="OSTATNÉ MODULY" modules={otherModules} />
    </motion.div>
  );
};

export default ModuleSelector;
