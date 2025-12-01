import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const glassCardClasses =
  'bg-white/70 backdrop-blur border border-slate-200/80 rounded-2xl shadow-[0_18px_45px_rgba(15,23,42,0.08)]';

const ModuleCard = ({ module, index }) => {
  const navigate = useNavigate();

  const handleNavigateToModule = () => {
    navigate(`/modules/${module.code}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className={`${glassCardClasses} p-5 flex flex-col justify-between`}
    >
      <div>
        <h4 className="font-semibold text-base text-slate-900 mb-1">
          {module.title}
        </h4>
        <p className="text-sm text-slate-600 mb-4">
          {module.short_description}
        </p>
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
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Dostupné moduly
        </h3>
        <p className="text-slate-500 text-sm">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  const normalize = (text) => (text || '').toLowerCase();

  // Rozdelenie podľa názvu
  const salesModules = modules.filter((m) => {
    const t = normalize(m.title);
    return (
      t.includes('obchodný rozhovor') ||
      t.includes('tvorba ponúk')
    );
  });

  const leadershipModules = modules.filter((m) => {
    const t = normalize(m.title);
    return (
      t.includes('individuálny rozhovor') ||
      t.includes('koučing')
    );
  });

  // Fallback – ak sa nič nezaradilo, zobraz všetko ako predtým
  const groupedCount = salesModules.length + leadershipModules.length;
  const useSimpleGrid = groupedCount === 0;

  if (useSimpleGrid) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="space-y-4"
      >
        <h3 className="text-lg font-bold text-slate-900">
          Dostupné moduly
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module, index) => (
            <ModuleCard key={module.code || module.title} module={module} index={index} />
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
      <h3 className="text-lg font-bold text-slate-900">
        Dostupné moduly
      </h3>

      {/* SALES */}
      {salesModules.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Sales
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {salesModules.map((module, index) => (
              <ModuleCard
                key={module.code || module.title}
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
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Leadership
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leadershipModules.map((module, index) => (
              <ModuleCard
                key={module.code || module.title}
                module={module}
                index={salesModules.length + index}
              />
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default ModuleSelector;
