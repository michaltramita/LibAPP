// src/components/ModuleSelector.jsx
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
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl
                 border border-white/18 bg-white/6
                 backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.70)]"
    >
      {/* jemný gradient overlay aby karta pôsobila „sklenejšie“ */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/16 via-white/4 to-slate-900/10" />

      <div className="relative z-10 p-5 pb-4">
        <h4 className="font-semibold text-base md:text-lg text-slate-50 mb-2">
          {module.title}
        </h4>
        <p className="text-xs md:text-sm text-slate-100/80 leading-relaxed">
          {module.short_description}
        </p>
      </div>

      <div className="relative z-10 px-5 pb-5 pt-1">
        <Button
          onClick={handleNavigateToModule}
          className="w-full group rounded-full bg-white/90 text-[#B81547]
                     hover:bg-white hover:text-[#8f0f3b] border border-white/80"
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
        className="rounded-2xl border border-white/18 bg-white/6
                   backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.70)]
                   p-6"
      >
        <h3 className="text-lg md:text-xl font-semibold text-slate-50 mb-3">
          Dostupné moduly
        </h3>
        <p className="text-sm text-slate-100/80">
          Momentálne nie sú dostupné žiadne tréningové moduly.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-lg md:text-xl font-semibold text-slate-50 mb-4">
        Dostupné moduly
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
        {modules.map((module, index) => (
          <ModuleCard key={module.code} module={module} index={index} />
        ))}
      </div>
    </motion.div>
  );
};

export default ModuleSelector;
