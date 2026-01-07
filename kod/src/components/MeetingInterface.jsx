import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Send, Mic, MicOff, User, Bot, Flag, Volume2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateClientReply, getInitialMetrics, getInitialIntroFlags } from '@/utils/salesSimulator';
import { cn } from '@/lib/utils';

const SALES_SESSION_STORAGE_KEY = 'sales_session_id';
const SALES_VOICE_SESSION_STORAGE_KEY = 'sales_voice_session_id';
const SALES_DEBUG_STORAGE_KEY = 'sales_debug';

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

const readStoredVoiceSessionId = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SALES_VOICE_SESSION_STORAGE_KEY);
};

const storeVoiceSessionId = (value) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(SALES_VOICE_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SALES_VOICE_SESSION_STORAGE_KEY, value);
};

const isSalesDebugEnabled = () => {
  if (import.meta.env?.DEV) return true;
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') return true;

  return window.localStorage.getItem(SALES_DEBUG_STORAGE_KEY) === '1';
};

const MeetingInterface = ({ config, onEndMeeting, sessionId, accessToken }) => {
  // Debugging log as requested
  console.log("sessionConfig received in MeetingInterface:", config);
  const { sessionId: routeSessionId } = useParams();

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
  const [creatingVoiceSession, setCreatingVoiceSession] = useState(false);
  const [appSessionId, setAppSessionId] = useState(
    () => routeSessionId || sessionId || readStoredSessionId()
  );
  const [voiceSessionId, setVoiceSessionId] = useState(() => readStoredVoiceSessionId());
  const [isSessionReady, setIsSessionReady] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastInitTargetRef = useRef(null);
  const previousRouteSessionIdRef = useRef(routeSessionId);
  const previousAppSessionIdRef = useRef(appSessionId);
  const { toast } = useToast();

  const clientType = config?.clientType || 'new';
  const clientDiscType = config?.clientDiscType || null;
  const difficulty = config?.difficulty || 'beginner';

  useEffect(() => {
    const routeChanged = previousRouteSessionIdRef.current !== routeSessionId;
    if (routeChanged) {
      previousRouteSessionIdRef.current = routeSessionId;
    }

    if (routeSessionId) {
      if (routeSessionId !== appSessionId) {
        setAppSessionId(routeSessionId);
      }
      storeSessionId(routeSessionId);
      return;
    }

    if (!appSessionId && sessionId) {
      setAppSessionId(sessionId);
      storeSessionId(sessionId);
    }
  }, [routeSessionId, sessionId, appSessionId]);

  useEffect(() => {
    if (appSessionId) {
      storeSessionId(appSessionId);
    }
  }, [appSessionId]);

  useEffect(() => {
    if (!appSessionId) {
      const stored = readStoredSessionId();
      if (stored) {
        setAppSessionId(stored);
      }
    }
  }, [appSessionId]);

  useEffect(() => {
    if (previousAppSessionIdRef.current !== appSessionId) {
      previousAppSessionIdRef.current = appSessionId;
      setVoiceSessionId(null);
      storeVoiceSessionId(null);
      setIsSessionReady(false);
      lastInitTargetRef.current = null;
    }
  }, [appSessionId]);

  useEffect(() => {
    if (voiceSessionId) {
      setIsSessionReady(true);
    }
  }, [voiceSessionId]);

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

  useEffect(() => {
    if (isSalesDebugEnabled()) {
      console.info('[sales-ui] debug enabled');
    }

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
      if (voiceSessionId) return;
      if (!appSessionId || creatingVoiceSession || isSessionReady) return;
      if (lastInitTargetRef.current === appSessionId) return;
      if (!accessToken) {
        toast({
          title: "Prihlásenie potrebné",
          description: "Prihlás sa, aby si mohol spustiť simuláciu.",
          variant: "destructive",
        });
        return;
      }
      lastInitTargetRef.current = appSessionId;
      setCreatingVoiceSession(true);
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);
        const response = await fetch('/api/sales/session', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            session_id: appSessionId,
            module: 'obchodny_rozhovor',
            difficulty,
            client_type: clientType,
            client_disc_type: clientDiscType,
            scenario_key: config?.scenarioKey,
          }),
        }).finally(() => {
          window.clearTimeout(timeoutId);
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
        const message = err?.name === 'AbortError' ? 'session init timeout' : err?.message;
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
        setCreatingVoiceSession(false);
      }
    };

    const ensureVoiceSession = async () => {
      const newVoiceSessionId = await initializeSalesSession();
      if (newVoiceSessionId && isMounted) {
        setVoiceSessionId(newVoiceSessionId);
        storeVoiceSessionId(newVoiceSessionId);
        // Backend can return the same session_id for reuse; treat it as ready to avoid UI deadlocks.
        setIsSessionReady(true);
      }
    };

    ensureVoiceSession();

    return () => {
      isMounted = false;
    };
  }, [
    appSessionId,
    voiceSessionId,
    clientType,
    clientDiscType,
    difficulty,
    isSessionReady,
    creatingVoiceSession,
    accessToken,
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
    const effectiveSessionId = voiceSessionId || appSessionId;
    if (!effectiveSessionId || !isSessionReady) {
      if (import.meta.env?.DEV) {
        console.warn('[sales-ui] missing session id', {
          appSessionId,
          voiceSessionId,
          routeSessionId,
          storedVoiceSessionId: readStoredVoiceSessionId(),
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
      session_id: effectiveSessionId,
      role: 'salesman',
      content: trimmed,
    };

    if (import.meta.env?.DEV) {
      console.log('[sales-ui] sending message', {
        sessionId: effectiveSessionId,
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

  const getLevelLabel = (val) => ({'beginner': 'Začiatočník', 'intermediate': 'Pokročilý', 'expert': 'Expert'})[val] || val;

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <div className="flex w-full items-center justify-center p-4 sm:p-6">
        <div className="flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-slate-50 shadow-xl">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-800">Obchodná simulácia</h1>
                {(config.scenarioTitle || config.topic) && (
                  <p className="text-xs text-slate-500">
                    {config.scenarioTitle || config.topic}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
                onClick={() => handleEndMeeting()}
              >
                <Flag className="mr-1 h-3.5 w-3.5" /> Ukončiť
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-200 px-2.5 py-1 font-medium text-slate-700">
                {getLevelLabel(config.difficulty)}
              </span>
              {config.clientType && (
                <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                  {config.clientType}
                </span>
              )}
              {config.clientDiscType && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                  {config.clientDiscType}
                </span>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3 items-end", message.type === 'salesman' ? 'justify-end' : 'justify-start')}
                >
                  {message.type === 'client' && (
                    <div className="w-9 h-9 rounded-full bg-orange-400 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}
                  <div className={cn("max-w-[78%]", message.type === 'salesman' && 'flex flex-col items-end')}>
                    <span className="text-[11px] text-slate-400 mb-1 px-1">{message.type === 'salesman' ? 'Obchodník' : 'Klient'}</span>
                    <div className={cn("p-3 rounded-2xl relative group shadow-sm",
                      message.type === 'salesman'
                        ? 'bg-[#B81547] text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
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
                    <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-end justify-start">
                  <div className="w-9 h-9 rounded-full bg-orange-400 text-white flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 mb-1 px-1">Klient</span>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
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

          <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="relative rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
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
                className="w-full pl-2 pr-24 py-2 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none text-sm"
                disabled={isTyping || isSending}
                rows={1}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button
                  onClick={toggleListening}
                  variant="ghost"
                  size="icon"
                  className={cn("rounded-full w-9 h-9", isListening ? 'bg-red-100 text-red-600' : 'text-slate-500 hover:bg-slate-100')}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className="rounded-full w-9 h-9 bg-slate-800 hover:bg-slate-900 text-white shadow"
                  disabled={!voiceSessionId || !isSessionReady || creatingVoiceSession || !inputValue.trim() || isTyping || isSending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Enter pre odoslanie, Shift+Enter pre nový riadok</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default MeetingInterface;
