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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 flex flex-col justify-between"
    >
      <div className="p-5 pb-4">
        <h4 className="font-semibold text-base text-slate-50 mb-2">
          {module.title}
        </h4>
        <p className="text-xs text-slate-200/80 mb-4">
          {module.short_description}
        </p>
      </div>
      <div className="px-5 pb-5">
        <Button
          onClick={handleNavigateToModule}
          className="w-full group bg-[#B81547]/90 hover:bg-[#B81547] text-white border border-white/10 backdrop-blur"
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
        className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-6"
      >
        <h3 className="text-xl font-bold text-slate-50 mb-4">
          Dostupné moduly
        </h3>
        <p className="text-slate-200/80">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  // Rozdelenie modulov podľa kódu do SALES / LEADERSHIP
  const salesModules = modules.filter((m) =>
    ['OR01', 'TP01'].includes(m.code)
  );
  const leadershipModules = modules.filter((m) =>
    ['IR01', 'KO01'].includes(m.code)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-8"
    >
      <h3 className="text-xl font-bold text-slate-50 mb-2">
        Dostupné moduly
      </h3>

      {/* SALES */}
      {salesModules.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-slate-300 uppercase">
            Sales
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {salesModules.map((module, index) => (
              <ModuleCard
                key={module.code}
                module={module}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {/* LEADERSHIP */}
      {leadershipModules.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-slate-300 uppercase">
            Leadership
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {leadershipModules.map((module, index) => (
              <ModuleCard
                key={module.code}
                module={module}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default ModuleSelector;
