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
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"
    >
      <div>
        <h4 className="font-bold text-lg text-slate-900 mb-2">
          {module.title}
        </h4>
        <p className="text-sm text-slate-600 mb-6">
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-4">
          Dostupné moduly
        </h3>
        <p className="text-slate-500">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  // definícia názvov pre skupiny
  const SALES_TITLES = ['Obchodný rozhovor', 'Tvorba ponúk na mieru'];
  const LEADERSHIP_TITLES = ['Individuálny rozhovor', 'Koučing'];

  const salesModules = modules.filter((m) =>
    SALES_TITLES.includes(m.title)
  );
  const leadershipModules = modules.filter((m) =>
    LEADERSHIP_TITLES.includes(m.title)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-8"
    >
      <h3 className="text-xl font-bold text-slate-900 mb-2">
        Dostupné moduly
      </h3>

      {/* SALES */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Sales
          </h4>
        </div>
        {salesModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {salesModules.map((module, index) => (
              <ModuleCard
                key={module.code}
                module={module}
                index={index}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Zatiaľ nie sú dostupné žiadne moduly v oblasti Sales.
          </p>
        )}
      </section>

      {/* LEADERSHIP */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Leadership
          </h4>
        </div>
        {leadershipModules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {leadershipModules.map((module, index) => (
              <ModuleCard
                key={module.code}
                module={module}
                index={index}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Zatiaľ nie sú dostupné žiadne moduly v oblasti Leadership.
          </p>
        )}
      </section>
    </motion.div>
  );
};

export default ModuleSelector;
