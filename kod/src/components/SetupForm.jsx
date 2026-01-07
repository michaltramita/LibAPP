import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Target, Briefcase, Play } from 'lucide-react';
import { resolveScenarioById, SALES_SCENARIOS } from '@/utils/salesScenarios';

const SetupForm = ({ onStartMeeting }) => {
  const [difficulty, setDifficulty] = useState('beginner');
  const [clientType, setClientType] = useState('new');
  const [clientDiscType, setClientDiscType] = useState(null);
  const [scenarioKey, setScenarioKey] = useState('');
  const selectedScenario = resolveScenarioById(scenarioKey);

  const getScenarioDescriptionPreview = (description, maxLength = 150) => {
    if (!description) return '';
    const normalized = description.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trim()}…`;
  };

  const salesmanLevels = [
    { value: 'beginner', label: 'Začiatočník', description: 'Nový v predaji, učí sa základy' },
    { value: 'advanced', label: 'Pokročilý', description: 'Skúsený s preukázateľnými výsledkami' },
    { value: 'expert', label: 'Expert', description: 'Majster predaja, rieši zložité obchody' }
  ];

  const clientCategories = [
    { value: 'new', label: 'Nový klient', description: 'Prvé stretnutie s novým zákazníkom' },
    { value: 'repeat', label: 'Opakovaný predaj', description: 'Pokračovanie spolupráce s existujúcim klientom' }
  ];

  const discClientTypes = [
    {
      value: 'D',
      label: 'Dominantný (D)',
      description: 'Priamy, orientovaný na výsledky, rozhodný, súťaživý',
      traits: 'Rýchle tempo, zameraný na úlohy, cení si efektivitu'
    },
    {
      value: 'I',
      label: 'Iniciatívny (I)',
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) {
      return;
    }
    const scenario = resolveScenarioById(scenarioKey);
    if (!scenario) return;
    onStartMeeting({
      difficulty,
      clientType,
      clientDiscType: clientType === 'repeat' ? clientDiscType : null,
      scenarioKey: scenario.id,
      scenarioTitle: scenario.title,
    });
  };

  const isFormValid =
    difficulty &&
    clientType &&
    scenarioKey &&
    (clientType === 'new' || (clientType === 'repeat' && clientDiscType));

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
                  onClick={() => setDifficulty(level.value)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    difficulty === level.value
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
              Typ klienta
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientCategories.map((category) => (
                <motion.div
                  key={category.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setClientType(category.value);
                    if (category.value === 'new') {
                      setClientDiscType(null);
                    }
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    clientType === category.value
                      ? 'border-[#B81547] bg-red-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-red-200'
                  }`}
                >
                  <div className="font-semibold text-slate-900 mb-1">{category.label}</div>
                  <div className="text-sm text-slate-600">{category.description}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {clientType === 'repeat' && (
            <div className="space-y-4">
              <Label className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Typ osobnosti klienta (DISC)
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discClientTypes.map((type) => (
                  <motion.div
                    key={type.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setClientDiscType(type.value)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      clientDiscType === type.value
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
          )}

          <div className="space-y-4">
            <Label className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Tréningová situácia
            </Label>
            <Select value={scenarioKey} onValueChange={setScenarioKey}>
              <SelectTrigger className="h-auto items-start rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left">
                {selectedScenario ? (
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {selectedScenario.title}
                    </span>
                    <span className="text-xs text-slate-500 leading-4">
                      {getScenarioDescriptionPreview(selectedScenario.description)}
                    </span>
                  </div>
                ) : (
                  <SelectValue placeholder="Vyberte scenár" />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {SALES_SCENARIOS.map((scenario) => (
                  <SelectItem
                    key={scenario.id}
                    value={scenario.id}
                    className="cursor-pointer rounded-xl border border-transparent px-4 py-3 pl-9 text-left focus:bg-slate-50 hover:bg-slate-50 data-[state=checked]:border-[#B81547] data-[state=checked]:bg-red-50"
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {scenario.title}
                      </span>
                      <span className="text-xs text-slate-500 leading-5 max-h-10 overflow-hidden">
                        {getScenarioDescriptionPreview(scenario.description, 160)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              Vyberte si scenár, na ktorom chcete trénovať.
            </p>
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            type="submit"
            disabled={!isFormValid}
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
