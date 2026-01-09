import React, { useCallback, useEffect, useRef, useState } from 'react';

const SALES_VOICE_SESSION_STORAGE_KEY = 'sales_voice_session_id';
const voiceKey = (appSessionId) =>
  appSessionId ? `${SALES_VOICE_SESSION_STORAGE_KEY}:${appSessionId}` : SALES_VOICE_SESSION_STORAGE_KEY;

const readStoredVoiceSessionId = (appSessionId) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(voiceKey(appSessionId));
};

const storeVoiceSessionId = (appSessionId, value) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(voiceKey(appSessionId));
    return;
  }
  window.localStorage.setItem(voiceKey(appSessionId), value);
};

const DIFFICULTY_LABELS = {
  beginner: 'Začiatočník',
  advanced: 'Pokročilý',
  expert: 'Expert',
};

const CLIENT_TYPE_LABELS = {
  new: 'Nový klient',
  repeat: 'Opakovaný predaj',
};

const DISC_LABELS = {
  D: 'Dominantný',
  I: 'Iniciatívny',
  S: 'Stabilný',
  C: 'Svedomitý',
};

const DISC_COLORS = {
  D: 'bg-red-500',
  I: 'bg-yellow-400',
  S: 'bg-green-500',
  C: 'bg-blue-500',
};

const SalesSimulationUI = ({ config, onEndMeeting, sessionId, accessToken }) => {
  const [appSessionId, setAppSessionId] = useState(sessionId || null);
  const [voiceSessionId, setVoiceSessionId] = useState(() =>
    readStoredVoiceSessionId(sessionId || null)
  );
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [endType, setEndType] = useState(null);
  const [endSummary, setEndSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const initStartedRef = useRef({});
  const initialMessageAppliedRef = useRef({});
  const endTriggeredRef = useRef({});
  const messagesRef = useRef(messages);
  const listEndRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (sessionId && sessionId !== appSessionId) {
      setAppSessionId(sessionId);
    }
  }, [sessionId, appSessionId]);

  useEffect(() => {
    if (!appSessionId) return;
    const storedVoiceId = readStoredVoiceSessionId(appSessionId);
    setVoiceSessionId(storedVoiceId);
    setMessages([]);
    setErrorMessage(null);
    setInputValue('');
    setIsInitializing(false);
    setIsSending(false);
    setIsEnded(false);
    setEndType(null);
    setEndSummary(null);
    endTriggeredRef.current = {};
  }, [appSessionId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeVoiceSession = useCallback(async () => {
    if (!accessToken || !appSessionId) return;
    if (voiceSessionId) return;
    if (initStartedRef.current[appSessionId]) return;

    initStartedRef.current[appSessionId] = true;
    setIsInitializing(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
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
          difficulty: config?.difficulty,
          client_type: config?.clientType,
          client_disc_type: config?.clientDiscType,
          scenario_key: config?.scenarioKey,
          topic: config?.topic,
          industry: config?.industry,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Nepodarilo sa inicializovať reláciu.');
      }

      const createdSessionId = data?.session_id || data?.sessionId || data?.id;
      if (!createdSessionId) {
        throw new Error('Chýba identifikátor hlasovej relácie.');
      }

      setVoiceSessionId(createdSessionId);
      storeVoiceSessionId(appSessionId, createdSessionId);

      const shouldApplyInitialMessage =
        data?.initial_message?.content &&
        data?.initial_message?.role &&
        !initialMessageAppliedRef.current[appSessionId] &&
        messagesRef.current.length === 0;

      if (shouldApplyInitialMessage) {
        initialMessageAppliedRef.current[appSessionId] = true;
        const initialRole = data.initial_message.role;
        setMessages((prev) => [
          ...prev,
          {
            type: initialRole,
            text: data.initial_message.content,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'Nepodarilo sa inicializovať reláciu.');
    } finally {
      window.clearTimeout(timeoutId);
      setIsInitializing(false);
    }
  }, [accessToken, appSessionId, config, voiceSessionId]);

  useEffect(() => {
    initializeVoiceSession();
  }, [initializeVoiceSession]);

  const canSend = Boolean(
    accessToken &&
      voiceSessionId &&
      inputValue.trim().length > 0 &&
      !isSending &&
      !isInitializing &&
      !isEnded
  );

  const handleSend = async () => {
    if (!canSend) return;

    const nextContent = inputValue.trim();
    const timestamp = new Date().toISOString();
    const typingId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setInputValue('');
    setIsSending(true);
    setErrorMessage(null);

    setMessages((prev) => [
      ...prev,
      { type: 'salesman', text: nextContent, timestamp },
      {
        type: 'client',
        text: 'AI píše…',
        timestamp: new Date().toISOString(),
        isTyping: true,
        typingId,
      },
    ]);

    try {
      const response = await fetch('/api/sales/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          session_id: voiceSessionId,
          role: 'salesman',
          content: nextContent,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Nepodarilo sa odoslať správu.');
      }

      const reply = data?.client_message || data?.reply || data?.message;
      const didEnd = Boolean(data?.simulation_end);
      const receivedEndType = data?.end_type || null;
      const receivedSummary = data?.end_summary || null;
      let nextMessages = null;
      setMessages((prev) => {
        const withoutTyping = prev.filter(
          (message) => !(message.isTyping && message.typingId === typingId)
        );
        if (!reply) {
          return withoutTyping;
        }
        const updated = [
          ...withoutTyping,
          { type: 'client', text: reply, timestamp: new Date().toISOString() },
        ];
        if (didEnd) {
          const labelMap = {
            agree: 'Dohoda dosiahnutá',
            postpone: 'Bezpečný odklad',
            decline: 'Ukončené bez dohody',
          };
          const endLabel = labelMap[receivedEndType] || 'Simulácia ukončená';
          const summarySuffix = receivedSummary ? ` — ${receivedSummary}` : '';
          updated.push({
            type: 'system',
            text: `Simulácia ukončená: ${endLabel}${summarySuffix}`,
            timestamp: new Date().toISOString(),
          });
        }
        nextMessages = updated;
        return updated;
      });
      if (didEnd) {
        setIsEnded(true);
        setEndType(receivedEndType);
        setEndSummary(receivedSummary);
        const endKey = voiceSessionId || appSessionId || 'default';
        if (!endTriggeredRef.current[endKey] && onEndMeeting && nextMessages) {
          endTriggeredRef.current[endKey] = true;
          onEndMeeting(
            { currentState: 'finished', metrics: { endType: receivedEndType } },
            nextMessages
          );
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.filter((message) => !(message.isTyping && message.typingId === typingId))
      );
      setErrorMessage(error?.message || 'Nepodarilo sa odoslať správu.');
    } finally {
      setIsSending(false);
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleResetSession = () => {
    storeVoiceSessionId(appSessionId, null);
    if (appSessionId) {
      delete initialMessageAppliedRef.current[appSessionId];
    }
    setVoiceSessionId(null);
    setMessages([]);
    setErrorMessage(null);
    setIsInitializing(false);
    setIsEnded(false);
    setEndType(null);
    setEndSummary(null);
    if (appSessionId) {
      delete initStartedRef.current[appSessionId];
    }
    endTriggeredRef.current = {};
  };

  const handleEndMeeting = () => {
    if (onEndMeeting) {
      onEndMeeting({ currentState: 'finished', metrics: {} }, messagesRef.current);
    }
  };

  const discValue = (config?.clientDiscType || '').toString().toUpperCase();
  const discColor = DISC_COLORS[discValue] || 'bg-slate-400';
  const difficultyLabel = DIFFICULTY_LABELS[config?.difficulty] || config?.difficulty || '—';
  const clientTypeLabel = CLIENT_TYPE_LABELS[config?.clientType] || config?.clientType || '—';
  const discLabel = DISC_LABELS[discValue];
  const isRepeatClient = config?.clientType === 'repeat';

  return (
    <div className="w-full bg-slate-100">
      {/* Full-screen layout (mobile safe) */}
      <div className="h-[100dvh] w-full">
        {/* Container: full width, optional comfortable padding on desktop */}
        <div className="mx-auto flex h-full w-full max-w-none flex-col bg-white shadow-none sm:max-w-5xl sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-xl">
          {/* Header sticky */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">Obchodná simulácia</h1>
                  <p className="text-sm text-slate-500">
                    {config?.scenarioTitle || config?.topic || 'Téma nie je zadaná'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEndMeeting}
                  className="rounded-full bg-[#B81547] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a0123d]"
                >
                  Ukončiť / hodnotiť
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {difficultyLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {clientTypeLabel}
                </span>
                {isRepeatClient && (
                  <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-white ${discColor}`}>
                    <span className="inline-block h-2 w-2 rounded-full bg-white/90" />
                    {discValue ? `${discValue}${discLabel ? ` – ${discLabel}` : ''}` : 'DISC: —'}
                  </span>
                )}
                {isInitializing && (
                  <span className="text-xs font-medium text-slate-500">Initializing…</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetSession}
                className="mt-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
              >
                Reset session
              </button>
            </div>

            {errorMessage && (
              <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 sm:px-6">
                {errorMessage}
              </div>
            )}
          </header>

          {/* Chat */}
          <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {messages.length === 0 && (
              <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                Správy sa zobrazia tu po prvom odoslaní.
              </div>
            )}

            <div className="mx-auto w-full max-w-3xl space-y-3">
              {messages.map((message, index) => {
                const isSalesman = message.type === 'salesman';
                const isSystem = message.type === 'system';
                return (
                  <div
                    key={`${message.timestamp}-${index}`}
                    className={`flex ${
                      isSystem ? 'justify-center' : isSalesman ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                        isSystem
                          ? 'border border-slate-200 bg-slate-50 text-xs italic text-slate-500'
                          : isSalesman
                            ? 'bg-[#B81547] text-white'
                            : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {message.isTyping ? (
                        <span className="italic text-slate-500">
                          AI píše
                          <span className="inline-flex gap-0.5 pl-1 text-slate-400">
                            <span className="animate-pulse">.</span>
                            <span className="animate-pulse [animation-delay:150ms]">.</span>
                            <span className="animate-pulse [animation-delay:300ms]">.</span>
                          </span>
                        </span>
                      ) : (
                        message.text
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
          </main>

          {/* Input sticky bottom */}
          <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
            <div className="px-4 py-3 sm:px-6">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={2}
                  placeholder="Napíšte správu..."
                  disabled={!canSend && isEnded}
                  className="flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-[#B81547] focus:outline-none focus:ring-1 focus:ring-[#B81547] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className="rounded-2xl bg-[#B81547] px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSending ? 'Odosielam…' : 'Odoslať'}
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Enter odošle, Shift+Enter nový riadok
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default SalesSimulationUI;
