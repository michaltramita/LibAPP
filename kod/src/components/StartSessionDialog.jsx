import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Target, Users, Briefcase, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveScenarioById, SALES_SCENARIOS } from '@/utils/salesScenarios';

export const StartSessionDialog = ({ moduleCode, open, onOpenChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [experienceLevel, setExperienceLevel] = useState(null);
  const [clientCategory, setClientCategory] = useState(null);
  const [clientType, setClientType] = useState(null);
  const [scenarioKey, setScenarioKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const selectedScenario = resolveScenarioById(scenarioKey);

  const getScenarioDescriptionPreview = (description, maxLength = 150) => {
    if (!description) return '';
    const normalized = description.trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength).trim()}…`;
  };

  const normalizeDifficulty = (raw) => {
    const normalized = raw?.toString().trim().toLowerCase();
    if (normalized === 'intermediate') return 'advanced';
    if (normalized === 'advanced' || normalized === 'expert') return normalized;
    return 'beginner';
  };

  const normalizeClientType = (raw) => {
    const normalized = raw?.toString().trim().toLowerCase();
    if (normalized === 'existing') return 'repeat';
    if (normalized === 'repeat') return 'repeat';
    return 'new';
  };

  const normalizeDisc = (raw, normalizedClientType) => {
    if (normalizedClientType !== 'repeat') return null;
    const normalized = raw?.toString().trim().toUpperCase();
    return ['D', 'I', 'S', 'C'].includes(normalized) ? normalized : null;
  };

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setExperienceLevel(
        normalizeDifficulty(user?.user_metadata?.experience_level || null)
      );
      setClientCategory(null);
      setClientType(null);
      setScenarioKey('');
      setIsLoading(false);
    }
  }, [open, user]);

  useEffect(() => {
    if (clientCategory !== 'repeat' && clientType) {
      setClientType(null);
    }
  }, [clientCategory, clientType]);

  const handleStartSession = async () => {
    const normalizedClientCategory = normalizeClientType(clientCategory);
    const normalizedDifficulty = normalizeDifficulty(experienceLevel);
    const normalizedDisc = normalizeDisc(clientType, normalizedClientCategory);
    const selectedScenario = resolveScenarioById(scenarioKey) || null;

    if (
      !experienceLevel ||
      !clientCategory ||
      !scenarioKey ||
      (normalizedClientCategory === 'repeat' && !normalizedDisc)
    ) {
      toast({
        title: "Chýbajúce informácie",
        description: "Prosím, vyplňte všetky parametre simulácie.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedScenario) {
      toast({
        title: "Chýbajúce informácie",
        description: "Prosím, vyberte tréningovú situáciu.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    const sessionId = uuidv4();

    const sessionData = {
      id: sessionId,
      user_id: user.id,
      module_code: moduleCode,
      status: 'started',
      started_at: new Date().toISOString(),
      topic: selectedScenario.id,
      client_type: normalizedClientCategory,
      client_disc_type: normalizedDisc,
      difficulty: normalizedDifficulty,
      industry: selectedScenario.title,
    };

    try {
      const { error } = await supabase.from('sessions').insert([sessionData]);
      if (error) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const isMissingScenarioColumn =
          error?.code === '42703' ||
          (errorMessage.includes('scenario_id') && errorMessage.includes('column'));
        if (!isMissingScenarioColumn) {
          throw error;
        }

        const fallbackSessionData = {
          ...sessionData,
          topic: selectedScenario.id,
          industry: selectedScenario.id,
        };
        delete fallbackSessionData.scenario_id;

        const { error: fallbackError } = await supabase
          .from('sessions')
          .insert([fallbackSessionData]);
        if (fallbackError) {
          throw fallbackError;
        }
      }
      
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Chyba",
        description: `Nepodarilo sa začať novú simuláciu: ${error.message}`,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };
  
  const isFormValid =
    experienceLevel &&
    clientCategory &&
    scenarioKey &&
    (clientCategory === 'new' || (clientCategory === 'repeat' && clientType));

  const experienceLevels = [
    { value: 'beginner', label: 'Začiatočník', description: 'Jednoduché námietky, nápovedy' },
    { value: 'advanced', label: 'Pokročilý', description: 'Realistické scenáre, ROI argumentácia' },
    { value: 'expert', label: 'Expert', description: 'Náročný klient, tvrdé vyjednávanie' }
  ];

  const clientCategories = [
    { value: 'new', label: 'Nový klient', description: 'Prvé stretnutie s novým zákazníkom' },
    { value: 'repeat', label: 'Opakovaný predaj', description: 'Pokračovanie spolupráce s existujúcim klientom' }
  ];

  const discClientTypes = [
    { value: 'D', label: 'Dominantný (D)', description: 'Rýchly, priamy, orientovaný na výsledky', color: 'bg-red-500' },
    { value: 'I', label: 'Iniciatívny (I)', description: 'Komunikatívny, emocionálny, priateľský', color: 'bg-yellow-500' },
    { value: 'S', label: 'Stabilný (S)', description: 'Pokojný, lojálny, hľadá istotu', color: 'bg-green-500' },
    { value: 'C', label: 'Svedomitý (C)', description: 'Precízny, logický, detailista', color: 'bg-blue-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 bg-[#B81547] flex flex-col h-full sm:h-auto sm:max-h-[90vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex-shrink-0 p-6 sm:p-10 pb-4 sm:pb-8 bg-[#B81547] rounded-t-lg"> {/* Header */}
          <DialogHeader className="text-center">
            <DialogTitle className="text-3xl font-bold text-white">Nová obchodná simulácia</DialogTitle>
            <DialogDescription className="text-white text-base opacity-90 mt-2">
              Nastav parametre tréningu a spusti realistickú simuláciu stretnutia s klientom
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-grow overflow-y-auto px-6 sm:px-10 bg-[#B81547]"> {/* Scrollable content area */}
           <div className="space-y-6 sm:space-y-8">
            {/* Úroveň obchodníka */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
                <Target className="w-5 h-5 text-white opacity-80" />
                Náročnosť obchodného rozhovoru
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {experienceLevels.map((level) => (
                  <motion.div
                    key={level.value}
                    onClick={() => setExperienceLevel(level.value)}
                    className={cn(
                      'p-4 sm:p-6 rounded-2xl border-2 text-center cursor-pointer transition-all duration-200',
                      experienceLevel === level.value
                        ? 'border-white bg-white text-slate-900 shadow-lg'
                        : 'border-white/50 bg-white/10 hover:bg-white/20 text-white'
                    )}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="font-bold text-lg">{level.label}</p>
                    <p className="text-sm mt-1">{level.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Typ klienta */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
                <Users className="w-5 h-5 text-white opacity-80" />
                Typ klienta
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clientCategories.map((category) => (
                  <motion.div
                    key={category.value}
                    onClick={() => {
                      setClientCategory(category.value);
                      setClientType(null);
                    }}
                    className={cn(
                      'p-4 sm:p-6 rounded-2xl border-2 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-start',
                      clientCategory === category.value
                        ? 'border-white bg-white text-slate-900 shadow-lg'
                        : 'border-white/50 bg-white/10 hover:bg-white/20 text-white'
                    )}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="font-bold text-lg">{category.label}</p>
                    <p className="text-sm mt-1 flex-grow">{category.description}</p>
                  </motion.div>
                ))}
              </div>

              <AnimatePresence>
                {clientCategory === 'repeat' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="pt-2"
                  >
                    <p className="text-sm text-white/80 mb-3">Vyberte typ klienta podľa metodiky DISC:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {discClientTypes.map((type) => (
                        <motion.div
                          key={type.value}
                          onClick={() => setClientType(type.value)}
                          className={cn(
                            'p-4 sm:p-6 rounded-2xl border-2 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-start',
                             clientType === type.value
                              ? 'border-white bg-white text-slate-900 shadow-lg'
                              : 'border-white/50 bg-white/10 hover:bg-white/20 text-white'
                          )}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl mb-3', type.color)}>
                            {type.value}
                          </div>
                          <p className="font-bold text-lg">{type.label}</p>
                          <p className="text-sm mt-1 flex-grow">{type.description}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Odvetvie a téma stretnutia */}
            <div className="space-y-4 pb-4">
              <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
                <Briefcase className="w-5 h-5 text-white opacity-80" />
                Tréningová situácia
              </h3>
              <Select value={scenarioKey} onValueChange={setScenarioKey}>
                <SelectTrigger className="h-auto items-start rounded-2xl border-white/50 bg-white/10 px-4 py-3 text-left text-white focus:ring-white">
                  {selectedScenario ? (
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="text-sm font-semibold text-white truncate">
                        {selectedScenario.title}
                      </span>
                      <span className="text-xs text-white/80 leading-4">
                        {getScenarioDescriptionPreview(selectedScenario.description)}
                      </span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Vyberte scenár" className="text-white/70" />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {SALES_SCENARIOS.map((scenario) => (
                    <SelectItem
                      key={scenario.id}
                      value={scenario.id}
                      className="cursor-pointer rounded-xl border border-transparent px-4 py-3 pl-9 text-left focus:bg-slate-50 hover:bg-slate-50 data-[state=checked]:border-[#B81547] data-[state=checked]:bg-[#B81547]/10"
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
              <p className="text-sm text-white px-2 opacity-90">
                Vyberte si scenár, na ktorom chcete trénovať.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 p-4 sm:p-6 bg-slate-50 border-t border-slate-200 rounded-b-lg"> {/* Footer area */}
            <Button
              type="button"
              onClick={handleStartSession}
              disabled={!isFormValid || isLoading}
              className="w-full text-lg font-semibold py-6 sm:py-7 rounded-2xl bg-[#B81547] text-white hover:bg-[#A31341] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isLoading ? 'loading' : 'ready'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-5 w-5" />
                  )}
                  {isLoading ? 'Spúšťa sa...' : 'Spustiť simuláciu'}
                </motion.span>
              </AnimatePresence>
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StartSessionDialog;
