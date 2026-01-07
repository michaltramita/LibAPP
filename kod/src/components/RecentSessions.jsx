import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, Clock, User, BarChart, Award, Check, X, AlertTriangle, Package, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';
import SessionDetailModal from '@/components/SessionDetailModal';
import { resolveScenarioForSession } from '@/utils/salesScenarios';

// New component for truncating text
const TruncatedText = ({ text, wordLimit, isExpanded, onToggle }) => {
  const words = text.split(' ');
  const isTruncatable = words.length > wordLimit;
  
  const truncated = isTruncatable ? words.slice(0, wordLimit).join(' ') + '...' : text;

  return (
    <div>
      {/* Desktop view: always show full text */}
      <p className="hidden md:block font-semibold text-base text-slate-800">
        Téma: {text}
      </p>
      
      {/* Mobile view: handle truncation */}
      <div className="md:hidden">
        <AnimatePresence initial={false} mode="wait">
          <motion.p
            key={isExpanded ? 'full' : 'truncated'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="font-semibold text-sm text-slate-800"
          >
            Téma: {isExpanded ? text : truncated}
          </motion.p>
        </AnimatePresence>

        {isTruncatable && !isExpanded && (
          <button onClick={onToggle} className="text-xs text-[#B81547] font-semibold mt-1 hover:underline">
            Zobraziť viac
          </button>
        )}
      </div>
    </div>
  );
};


const RecentSessions = ({ sessions }) => {
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState(null);

  const toggleTopicExpansion = (sessionId) => {
    setExpandedTopics(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const visibleSessions = showAll ? sessions : sessions.slice(0, 3);

  const getDifficultyLabel = (val) => {
    const map = { 
      'beginner': 'Začiatočník', 
      'intermediate': 'Pokročilý',
      'expert': 'Expert' 
    };
    return map[val] || val;
  };

  const getDiscLabel = (discType) => {
    const map = {
      'D': 'Dominantný',
      'I': 'Vplyvný',
      'S': 'Stabilný',
      'C': 'Svedomitý',
    };
    return map[discType] || discType;
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-500 bg-slate-100';
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };
  
  const getOutcomeComponent = (outcome) => {
    switch(outcome) {
      case 'successful':
        return (
          <div className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
            <Check className="w-4 h-4 bg-green-200 text-green-700 rounded-full p-0.5"/>
            Úspešný
          </div>
        );
      case 'unsuccessful':
        return (
          <div className="flex items-center gap-1.5 text-red-600 font-medium text-sm">
            <X className="w-4 h-4 bg-red-200 text-red-700 rounded-full p-0.5"/>
            Neúspešný
          </div>
        );
      default:
        return (
            <div className="flex items-center gap-1.5 text-yellow-600 font-medium text-sm">
                <AlertTriangle className="w-4 h-4 bg-yellow-200 text-yellow-700 rounded-full p-0.5"/>
                Nekompletné
            </div>
        );
    }
  };

  const getModuleName = (code) => {
    const moduleMap = {
      'OR01': 'Obchodný rozhovor',
    };
    return moduleMap[code] || code;
  };
  
  const handleShowDetails = async (sessionId) => {
    setLoadingDetails(true);
    setLoadingSessionId(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke('get-session-details', {
        body: { session_id: sessionId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (!data.feedback || !data.transcript) {
        toast({
          variant: 'destructive',
          title: 'Nekompletné dáta',
          description: 'Pre túto reláciu neboli nájdené kompletné dáta spätnej väzby.',
        });
        return;
      }

      setSelectedSessionDetails(data);
      setModalOpen(true);
    } catch (err) {
      console.error('Error fetching session details:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba pri načítaní detailov',
        description: 'Nepodarilo sa načítať detaily relácie. Skúste to prosím znova.',
      });
    } finally {
      setLoadingDetails(false);
      setLoadingSessionId(null);
    }
  };


  if (!sessions || sessions.length === 0) {
    return (
       <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-4">Posledné rozhovory</h3>
        <p className="text-slate-500">Zatiaľ neboli zaznamenané žiadne tréningy.</p>
       </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
      >
        <h3 className="text-xl font-bold text-slate-900 mb-4">Posledné rozhovory</h3>
        <div className="space-y-3">
          <AnimatePresence>
            {visibleSessions.map((session, index) => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 w-full">
                  <div className="flex items-start gap-2 mb-2">
                    <BarChart className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0"/>
                    <TruncatedText 
                        text={resolveScenarioForSession(session).title || 'Nezadaná téma'} 
                        wordLimit={3}
                        isExpanded={!!expandedTopics[session.id]}
                        onToggle={() => toggleTopicExpansion(session.id)}
                      />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1 pl-6">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3"/>{new Date(session.started_at).toLocaleDateString('sk-SK')}</span>
                      <span className="flex items-center gap-1.5"><User className="w-3 h-3"/>DISC typ: {getDiscLabel(session.client_disc_type || session.client_type)}</span>
                      <span className="flex items-center gap-1.5"><Award className="w-3 h-3"/>Úroveň: {getDifficultyLabel(session.difficulty)}</span>
                      {session.module_code && (
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3 h-3"/>
                          Modul: {getModuleName(session.module_code)}
                        </span>
                      )}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="flex items-center gap-4">
                      <div className={`font-bold text-lg px-3 py-1 rounded-md ${getScoreColor(session.score)}`}>
                          {session.score === null || session.score === undefined ? 'N/A' : `${session.score}/10`}
                      </div>
                      {getOutcomeComponent(session.outcome)}
                    </div>
                  
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="ml-4 text-slate-500 hover:text-[#B81547] hover:bg-slate-100" 
                        onClick={() => handleShowDetails(session.id)}
                        disabled={loadingDetails && loadingSessionId === session.id}
                    >
                        {loadingDetails && loadingSessionId === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Detail
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </>
                        )}
                    </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {sessions.length > 3 && !showAll && (
          <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setShowAll(true)} className="bg-slate-50 hover:bg-slate-100 text-slate-600">
                  Zobraziť viac
                  <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
          </div>
        )}
      </motion.div>
      <SessionDetailModal 
        open={isModalOpen} 
        onOpenChange={setModalOpen}
        sessionDetails={selectedSessionDetails}
      />
    </>
  );
};

export default RecentSessions;
