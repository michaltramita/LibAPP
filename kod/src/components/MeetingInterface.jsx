import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Send, Mic, MicOff, User, Bot, PlayCircle, Search, Lightbulb, ThumbsDown, Award, Flag, CheckCircle, Volume2, BarChart2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateClientReply, getInitialMetrics, getInitialIntroFlags, getStartingMoodLevel } from '@/utils/salesSimulator';
import { cn } from '@/lib/utils';

const SALES_SESSION_STORAGE_KEY = 'sales_session_id';

const readStoredSessionId = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SALES_SESSION_STORAGE_KEY);
};

const storeSessionId = (value) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(SALES_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SALES_SESSION_STORAGE_KEY, value);
};


const MetricsDashboard = ({ metrics }) => {
    const metricItems = [
        { label: 'Položené otázky', value: metrics.questionsAsked, target: 5 },
        { label: 'Otvorené otázky', value: metrics.openQuestions, target: 3 },
        { label: 'Identifikované potreby', value: metrics.needsIdentified, target: 2 },
        { label: 'Hodnotové tvrdenia', value: metrics.valueStatements, target: 3 },
        { label: 'Zvládanie námietok', value: `${metrics.objectionsHandledWell}/${metrics.objectionHandlingAttempts}`, isRatio: true },
        { label: 'Pokusy o uzatvorenie', value: metrics.closingAttempts, target: 1 },
        { label: 'Prispôsobenie (DISC)', value: metrics.adaptationToDISC, target: 3 },
    ];

    return (
        <motion.div 
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-72 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-4 shadow-lg"
        >
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#B81547]" />
                Metriky v reálnom čase
            </h3>
            <div className="space-y-3">
                {metricItems.map(item => (
                    <div key={item.label}>
                        <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-medium text-slate-600">{item.label}</span>
                            <span className="font-bold text-slate-800">{item.isRatio ? item.value : `${item.value} / ${item.target}`}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                             <motion.div
                                className={cn(
                                    "h-1.5 rounded-full",
                                    item.isRatio 
                                      ? (metrics.objectionsHandledWell > 0 && metrics.objectionsHandledWell === metrics.objectionHandlingAttempts ? 'bg-green-500' : 'bg-yellow-500')
                                      : (item.value >= item.target ? 'bg-green-500' : 'bg-yellow-500')
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: item.isRatio ? `${(metrics.objectionsHandledWell / (metrics.objectionHandlingAttempts || 1)) * 100}%` : `${Math.min(100, (item.value / item.target) * 100)}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};


const MeetingInterface = ({ config, onEndMeeting, sessionId, accessToken }) => {
  // Debugging log as requested
  console.log("sessionConfig received in MeetingInterface:", config);
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();

  const [sessionState, setSessionState] = useState({
    currentState: 'intro',
    metrics: getInitialMetrics(),
    clientDiscType: config.clientDiscType,
    clientType: config.clientType || 'new',
    introFlags: getInitialIntroFlags(),
    difficulty: config.difficulty,
    industry: config.industry,
    clientMood: 'neutral',
    clientMoodReason: 'Čaká na viac informácií',
    moodScore: 0,
    moodReasons: [],
  });
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [creatingVoiceSession, setCreatingVoiceSession] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(
    () => sessionId || routeSessionId || readStoredSessionId()
  );
  const [isSessionReady, setIsSessionReady] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { toast } = useToast();

  const clientType = config?.clientType || 'new';
  const clientDiscType = config?.clientDiscType || null;
  const difficulty = config?.difficulty || 'beginner';

  useEffect(() => {
    const candidate = sessionId || routeSessionId;
    if (candidate && candidate !== activeSessionId) {
      setActiveSessionId(candidate);
      storeSessionId(candidate);
      setIsSessionReady(false);
    }
  }, [sessionId, routeSessionId, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      const stored = readStoredSessionId();
      if (stored) {
        setActiveSessionId(stored);
      }
    }
  }, [activeSessionId]);

  const mapBackendPhase = (phase) => {
    if (!phase) return null;
    const normalized = phase.toString().trim().toLowerCase();
    const phaseMap = {
      intro: 'intro',
      discovery: 'discovery',
      needs: 'discovery',
      offer: 'presentation',
      presentation: 'presentation',
      objections: 'objections',
      closing: 'closing',
      done: 'finished',
      finished: 'finished',
    };
    return phaseMap[normalized] || null;
  };

  const phaseConfig = {
    intro: { label: 'Úvod', icon: PlayCircle },
    discovery: { label: 'Potreby', icon: Search },
    presentation: { label: 'Ponuka', icon: Lightbulb },
    objections: { label: 'Námietky', icon: ThumbsDown },
    closing: { label: 'Uzatvorenie', icon: Award },
    finished: { label: 'Hotovo', icon: Flag }
  };
  const phases = Object.keys(phaseConfig);
  const activePhaseIndex = Math.max(phases.indexOf(sessionState.currentState), 0);

  useEffect(() => {
    // Speech Recognition Setup
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'sk-SK';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join('');
        setInputValue(transcript);
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        toast({ title: "Chyba mikrofónu", description: "Nepodarilo sa rozpoznať reč.", variant: "destructive" });
      };
    } else {
      console.warn("Web Speech API not supported");
    }

    // Initial message
    const initialReply = generateClientReply('intro', '', sessionState);
    const msgObj = { type: 'client', text: initialReply.clientMessage, timestamp: new Date() };
    setMessages([msgObj]);
    setSessionState((s) => ({
      ...s,
      ...initialReply.sessionState,
      clientMood: initialReply.clientMood,
      clientMoodReason: initialReply.clientMoodReason,
      moodLevel: initialReply.moodLevel ?? initialReply.sessionState?.moodLevel ?? s.moodLevel,
      lastMoodReason: initialReply.moodReason || initialReply.sessionState?.lastMoodReason || s.lastMoodReason,
    }));
    speakText(initialReply.clientMessage);
    
    return () => window.speechSynthesis.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeSalesSession = async () => {
      if (!activeSessionId || creatingVoiceSession || isSessionReady) return;
      if (!accessToken) {
        toast({
          title: "Prihlásenie potrebné",
          description: "Prihlás sa, aby si mohol spustiť simuláciu.",
          variant: "destructive",
        });
        return;
      }
      setCreatingVoiceSession(true);

      try {
        const response = await fetch('/api/sales/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            session_id: activeSessionId,
            module: 'obchodny_rozhovor',
            difficulty,
            client_type: clientType,
            client_disc_type: clientDiscType,
          }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            data?.details || data?.error || response.statusText || `HTTP ${response.status}`
          );
        }

        const newVoiceSessionId = data?.session_id ?? data?.sessionId ?? data?.id;
        if (!newVoiceSessionId) {
          if (import.meta.env?.DEV) {
            console.debug('Missing session_id in response', data);
          }
          throw new Error('Missing session_id in response');
        }

        return newVoiceSessionId;
      } catch (err) {
        console.error('Failed to initialize sales session', err);
        if (isMounted) {
          toast({
            title: "Chyba relácie",
            description: "Nepodarilo sa pripraviť simuláciu. Skúste obnoviť stránku.",
            variant: "destructive",
          });
        }
        return undefined;
      } finally {
        if (isMounted) {
          setCreatingVoiceSession(false);
        }
      }
    };

    const ensureVoiceSession = async () => {
      const newVoiceSessionId = await initializeSalesSession();
      if (newVoiceSessionId && isMounted) {
        setActiveSessionId(newVoiceSessionId);
        storeSessionId(newVoiceSessionId);
        setIsSessionReady(true);
        if (routeSessionId && newVoiceSessionId !== routeSessionId) {
          navigate(`/session/${newVoiceSessionId}`, { replace: true });
        }
      }
    };

    ensureVoiceSession();

    return () => {
      isMounted = false;
    };
  }, [
    activeSessionId,
    clientType,
    clientDiscType,
    difficulty,
    isSessionReady,
    creatingVoiceSession,
    accessToken,
    navigate,
    routeSessionId,
    toast,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sk-SK';
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({ title: "Nepodporované", description: "Váš prehliadač nepodporuje prevod reči na text.", variant: "destructive" });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      setInputValue('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending || isTyping) return;
    if (!activeSessionId || !isSessionReady) {
      if (import.meta.env?.DEV) {
        console.warn('[sales-ui] missing session id', {
          activeSessionId,
          routeSessionId,
          storedSessionId: readStoredSessionId(),
          sessionState,
          path: window.location.pathname,
        });
      }
      toast({ title: "Chýba relácia", description: "Relácia nie je k dispozícii. Skúste obnoviť stránku.", variant: "destructive" });
      return;
    }
    if (!accessToken) {
      toast({
        title: "Prihlásenie vypršalo",
        description: "Prihláste sa znova a skúste to ešte raz.",
        variant: "destructive",
      });
      return;
    }

    const salesmanMessage = { type: 'salesman', text: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, salesmanMessage]);
    setInputValue('');
    setIsTyping(true);
    setIsSending(true);
    window.speechSynthesis.cancel();

    const messageEndpoint = '/api/sales/message';
    const payload = {
      session_id: activeSessionId,
      role: 'salesman',
      content: trimmed,
    };

    if (import.meta.env?.DEV) {
      console.log('[sales-ui] sending message', {
        sessionId: activeSessionId,
        payload,
        endpoint: messageEndpoint,
      });
    }

    try {
      const response = await fetch(messageEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (import.meta.env?.DEV) {
        console.log('[sales-ui] message response', {
          status: response.status,
          data,
        });
      }
      if (!response.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
      }

      const {
        newState,
        clientMessage,
        clientMood,
        clientMoodReason,
        updatedMetrics,
        introFlags,
        shouldEnd,
        moodScore,
        moodReasons,
        offerProgress,
        phaseGate,
      } = generateClientReply(
        sessionState.currentState,
        salesmanMessage.text,
        sessionState
      );

      const backendPhase = data.state || data.stage || data.current_state || data.phase;
      const clientReplyText = data.client_message || data.reply || data.message || clientMessage;

      if (import.meta.env?.DEV) {
        console.log('[phase]', backendPhase);
      }

      const nextState =
        mapBackendPhase(backendPhase) ||
        mapBackendPhase(newState) ||
        sessionState.currentState;
      const newSessionState = {
        ...sessionState,
        currentState: nextState,
        metrics: updatedMetrics,
        introFlags,
        clientMood,
        clientMoodReason,
        moodScore,
        moodReasons,
        offerProgress: offerProgress ?? sessionState.offerProgress,
        phaseGate: phaseGate ?? sessionState.phaseGate,
      };
      setSessionState(newSessionState);

      const clientMessageObj = { type: 'client', text: clientReplyText, timestamp: new Date() };
      setMessages(prev => [...prev, clientMessageObj]);
      
      setIsTyping(false);
      speakText(clientReplyText);

      if (shouldEnd || nextState === 'finished') {
        setTimeout(() => handleEndMeeting(newSessionState), 2000);
      }
    } catch (err) {
      console.error('Failed to send sales message', err);
      toast({
        title: "Chyba",
        description: err?.message || "Správu sa nepodarilo odoslať. Skúste to znova.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  };

  const handleEndMeeting = (finalState) => {
    window.speechSynthesis.cancel();
    const currentState = finalState || sessionState;
    setSessionState(s => ({ ...s, currentState: 'finished' }));
    onEndMeeting(currentState, messages);
  };
  
  const getMoodConfig = (mood) => {
    const map = {
      positive: { label: 'Pozitívna', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, iconColor: 'text-green-500' },
      neutral: { label: 'Neutrálna', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: User, iconColor: 'text-slate-500' },
      negative: { label: 'Negatívna', color: 'bg-red-100 text-red-800 border-red-200', icon: ThumbsDown, iconColor: 'text-red-500' },
      interested: { label: 'Zaujatá', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Lightbulb, iconColor: 'text-blue-500' },
      skeptical: { label: 'Skeptická', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Search, iconColor: 'text-orange-500' }
    };
    return map[mood] || map['neutral'];
  };

  const getLevelLabel = (val) => ({'beginner': 'Začiatočník', 'intermediate': 'Pokročilý', 'expert': 'Expert'})[val] || val;
  const moodConfig = getMoodConfig(sessionState.clientMood);

  return (
    <div className="flex h-screen bg-slate-50/50 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 z-10 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Obchodná simulácia</h1>
                        <p className="text-slate-500">{config.topic}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium bg-slate-200 text-slate-700 px-3 py-1 rounded-full">{getLevelLabel(config.difficulty)}</span>
                        <span className="text-sm font-medium bg-red-100 text-red-800 px-3 py-1 rounded-full">{config.clientDiscType}</span>
                    </div>
                </div>
            </header>

            {/* Phase Tabs */}
            <div className="flex items-center gap-2 mb-6 z-10">
                {phases.map((p, index) => {
                    const Icon = phaseConfig[p].icon;
                    const isActive = activePhaseIndex === index;
                    const isPassed = activePhaseIndex > index;
                    return (
                        <div key={p} className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-default",
                            isActive ? "bg-[#B81547] text-white shadow-md" : 
                            isPassed ? "bg-white text-green-600 border border-green-200" :
                            "bg-white text-slate-400 border border-slate-200"
                        )}>
                            <Icon className={cn("w-4 h-4", isPassed && !isActive && "text-green-500")} />
                            {phaseConfig[p].label}
                        </div>
                    );
                })}
            </div>
            
            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto pr-4 -mr-4 pb-48 z-10">
                <div className="space-y-6 max-w-4xl mx-auto">
                    {messages.map((message, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn("flex gap-4 items-start", message.type === 'salesman' ? 'justify-end' : 'justify-start')}
                        >
                            {message.type === 'client' && (
                                <div className="w-10 h-10 rounded-full bg-orange-400 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                                    <Bot className="w-6 h-6" />
                                </div>
                            )}
                            <div className={cn("max-w-[70%]", message.type === 'salesman' && 'flex flex-col items-end')}>
                                <span className="text-xs text-slate-500 mb-1 px-1">{message.type === 'salesman' ? 'Obchodník' : 'Klient'}</span>
                                <div className={cn("p-4 rounded-2xl relative group",
                                    message.type === 'salesman'
                                        ? 'bg-[#B81547] text-white rounded-tr-none'
                                        : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-none'
                                )}>
                                    <p className="leading-relaxed text-sm">{message.text}</p>
                                    {message.type === 'client' && (
                                        <button onClick={() => speakText(message.text)} className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Volume2 className="w-3 h-3 text-slate-500" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {message.type === 'salesman' && (
                                <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                                    <User className="w-6 h-6" />
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {isTyping && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 items-start justify-start">
                            <div className="w-10 h-10 rounded-full bg-orange-400 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                                <Bot className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-xs text-slate-500 mb-1 px-1">Klient</span>
                                <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>
            
            {import.meta.env.DEV && (
              <div className="mb-3 p-3 text-xs bg-black/80 text-white rounded-lg font-mono">
                <div>activeSessionId: {String(!!activeSessionId)}</div>
                <div>isSessionReady: {String(isSessionReady)}</div>
                <div>creatingVoiceSession: {String(creatingVoiceSession)}</div>
                <div>isTyping: {String(isTyping)}</div>
                <div>isSending: {String(isSending)}</div>
                <div>inputValue.length: {inputValue.length}</div>
                <div>inputValue.trim.length: {inputValue.trim().length}</div>
                <div>hasAccessToken: {String(!!accessToken)}</div>
              </div>
            )}

            {/* Input Area */}
            <footer className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8 bg-transparent z-30">
                <div className="max-w-4xl mx-auto">
                    <div className="relative bg-white rounded-xl shadow-lg border border-slate-200">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder={isListening ? "Počúvam, hovorte..." : "Napíšte alebo nahrajte svoju odpoveď..."}
                            className="w-full pl-6 pr-28 py-4 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none"
                            disabled={isTyping || isSending}
                            rows={1}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <Button
                                onClick={toggleListening}
                                variant="ghost"
                                size="icon"
                                className={cn("rounded-full w-10 h-10", isListening ? 'bg-red-100 text-red-600' : 'text-slate-500 hover:bg-slate-100')}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </Button>
                            <Button
                                onClick={handleSendMessage}
                                size="icon"
                                className="rounded-full w-10 h-10 bg-slate-800 hover:bg-slate-900 text-white shadow"
                                disabled={!activeSessionId || !isSessionReady || creatingVoiceSession || !inputValue.trim() || isTyping || isSending}
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 px-2">
                        <p className="text-xs text-slate-400">Enter pre odoslanie, Shift+Enter pre nový riadok</p>
                        <Button variant="link" size="sm" className="text-slate-500 text-xs" onClick={() => handleEndMeeting()}>
                            <Flag className="w-3 h-3 mr-1.5" /> Ukončiť a hodnotiť
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
        
        {/* Right Sidebar */}
        <div className="relative p-4 sm:p-6 lg:p-8 flex-shrink-0 z-20">
            <AnimatePresence>
                {showMetrics ? (
                    <div className="flex flex-col gap-6">
                        <motion.div 
                            layout 
                            className={cn("w-72 p-3 rounded-2xl shadow-lg border", moodConfig.color)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", moodConfig.iconColor, moodConfig.color.replace('bg-','bg-opacity-50 '))} >
                                   <moodConfig.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{moodConfig.label}</p>
                                    <p className="text-xs">{sessionState.clientMoodReason}</p>
                                </div>
                            </div>
                        </motion.div>

                        <MetricsDashboard metrics={sessionState.metrics} />
                    </div>
                ) : (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                         <Button variant="outline" size="icon" onClick={() => setShowMetrics(true)} className="bg-white/80 backdrop-blur-sm">
                            <BarChart2 className="w-5 h-5" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </div>
  );
};

export default MeetingInterface;
