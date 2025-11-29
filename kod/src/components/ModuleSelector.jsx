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
        <h4 className="font-bold text-lg text-slate-900 mb-2">{module.title}</h4>
        <p className="text-sm text-slate-600 mb-6">{module.short_description}</p>
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
            <h3 className="text-xl font-bold text-slate-900 mb-4">Dostupné moduly</h3>
            <p className="text-slate-500">Momentálne nie sú dostupné žiadne tréningové moduly.</p>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-xl font-bold text-slate-900 mb-4">Dostupné moduly</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modules.map((module, index) => (
          <ModuleCard key={module.code} module={module} index={index} />
        ))}
      </div>
    </motion.div>
  );
};

export default ModuleSelector;