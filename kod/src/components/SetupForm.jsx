import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Users, Target, Briefcase, Play } from 'lucide-react';

const SetupForm = ({ onStartMeeting }) => {
  const [salesmanLevel, setSalesmanLevel] = useState('beginner');
  const [clientType, setClientType] = useState('D');
  const [industry, setIndustry] = useState('technology');

  const salesmanLevels = [
    { value: 'beginner', label: 'Začiatočník', description: 'Nový v predaji, učí sa základy' },
    { value: 'advanced', label: 'Pokročilý', description: 'Skúsený s preukázateľnými výsledkami' },
    { value: 'expert', label: 'Expert', description: 'Majster predaja, rieši zložité obchody' }
  ];

  const clientTypes = [
    { 
      value: 'D', 
      label: 'Dominantný (D)', 
      description: 'Priamy, orientovaný na výsledky, rozhodný, súťaživý',
      traits: 'Rýchle tempo, zameraný na úlohy, cení si efektivitu'
    },
    { 
      value: 'I', 
      label: 'Ovplyvňujúci (I)', 
      description: 'Spoločenský, nadšený, optimistický, presvedčivý',
      traits: 'Rýchle tempo, zameraný na ľudí, cení si vzťahy'
    },
    { 
      value: 'S', 
      label: 'Stabilný (S)', 
      description: 'Trpezlivý, spoľahlivý, podporujúci, tímový hráč',
      traits: 'Mierne tempo, zameraný na ľudí, cení si stabilitu'
    },
    { 
      value: 'C', 
      label: 'Svedomitý (C)', 
      description: 'Analytický, presný, systematický, orientovaný na detaily',
      traits: 'Mierne tempo, zameraný na úlohy, cení si presnosť'
    }
  ];

  const industries = [
    { value: 'technology', label: 'Technológie a Softvér' },
    { value: 'healthcare', label: 'Zdravotníctvo a Medicína' },
    { value: 'finance', label: 'Financie a Bankovníctvo' },
    { value: 'manufacturing', label: 'Výroba a Priemysel' },
    { value: 'retail', label: 'Maloobchod a E-commerce' },
    { value: 'consulting', label: 'Poradenstvo a Služby' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onStartMeeting({
      salesmanLevel,
      clientType,
      industry
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-4xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-6 h-6 text-[#B81547]" />
            <h2 className="text-2xl font-bold text-slate-900">Konfigurácia stretnutia</h2>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Vaša úroveň skúseností v predaji
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {salesmanLevels.map((level) => (
                <motion.div
                  key={level.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSalesmanLevel(level.value)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    salesmanLevel === level.value
                      ? 'border-[#B81547] bg-red-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-red-200'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">{level.label}</div>
                  <div className="text-sm text-slate-600">{level.description}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Typ osobnosti klienta (DISC)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientTypes.map((type) => (
                <motion.div
                  key={type.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setClientType(type.value)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    clientType === type.value
                      ? 'border-[#B81547] bg-red-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-red-200'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">{type.label}</div>
                  <div className="text-sm text-slate-600 mb-2">{type.description}</div>
                  <div className="text-xs text-slate-500 italic">{type.traits}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Odvetvie / Téma
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {industries.map((ind) => (
                <motion.div
                  key={ind.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIndustry(ind.value)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                    industry === ind.value
                      ? 'border-[#B81547] bg-red-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-red-200'
                  }`}
                >
                  <span className="text-sm font-medium text-slate-900">{ind.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            type="submit"
            className="w-full py-6 text-lg font-semibold bg-[#B81547] hover:bg-[#9e123d] transition-all shadow-lg text-white"
          >
            <Play className="w-5 h-5 mr-2" />
            Spustiť obchodné stretnutie
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
};

export default SetupForm;