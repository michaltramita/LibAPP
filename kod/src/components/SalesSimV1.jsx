import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Target, User } from 'lucide-react';

const SALES_SESSION_STORAGE_KEY = 'sales_session_id';
const SALES_VOICE_SESSION_STORAGE_KEY = 'sales_voice_session_id';

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

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const badgeVariants = {
  difficulty:
    'from-sky-50/80 via-white/70 to-white/50 text-slate-700',
  client:
    'from-emerald-50/80 via-white/70 to-white/50 text-emerald-800',
  disc:
    'from-white/80 via-white/70 to-white/50 text-slate-700',
};

const discToneStyles = {
  D: {
    badge: 'from-rose-50/80 via-white/70 to-white/50 text-rose-700',
    dot: 'bg-rose-500',
  },
  I: {
    badge: 'from-violet-50/80 via-white/70 to-white/50 text-violet-700',
    dot: 'bg-violet-500',
  },
  S: {
    badge: 'from-sky-50/80 via-white/70 to-white/50 text-sky-700',
    dot: 'bg-sky-500',
  },
  C: {
    badge: 'from-amber-50/80 via-white/70 to-white/50 text-amber-700',
    dot: 'bg-amber-500',
  },
};

const SimBadge = ({ label, icon: Icon, variant, dot, dotClassName = '', className = '' }) => (
  <div
    className={`inline-flex items-center gap-2 rounded-full border border-white/40 bg-gradient-to-r px-3 py-1 text-sm font-medium shadow-md transition hover:shadow-lg ${badgeVariants[variant] || badgeVariants.difficulty} ${className} backdrop-blur-sm`}
  >
    {dot ? (
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${dotClassName}`}
      >
        {dot}
      </span>
    ) : null}
    {Icon ? <Icon className="h-4 w-4" /> : null}
    <span>{label}</span>
  </div>
);

const SalesSimV1 = ({ config, sessionId, accessToken }) => {
  const { sessionId: routeSessionId } = useParams();
  const [appSessionId, setAppSessionId] = useState(
    () => routeSessionId || sessionId || readStoredSessionId()
  );
  const [voiceSessionId, setVoiceSessionId] = useState(() => readStoredVoiceSessionId());
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const initInFlightRef = useRef(false);
  const lastInitForRef = useRef(null);

  useEffect(() => {
    if (routeSessionId && routeSessionId !== appSessionId) {
      setAppSessionId(routeSessionId);
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

  const initializeVoiceSession = useCallback(async () => {
    if (!accessToken || !appSessionId) return;
    if (voiceSessionId) return;
    if (initInFlightRef.current) return;
    if (lastInitForRef.current === appSessionId) return;

    initInFlightRef.current = true;
    lastInitForRef.current = appSessionId;
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithTimeout('/api/sales/session', {
        method: 'POST',
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
        }),
      });

      if (!response.ok) {
        throw new Error('Nepodarilo sa inicializovať hlasovú reláciu.');
      }

      const data = await response.json();
      const createdSessionId = data?.session_id || data?.sessionId || data?.id;

      if (!createdSessionId) {
        throw new Error('Chýba identifikátor hlasovej relácie.');
      }

      setVoiceSessionId(createdSessionId);
      storeVoiceSessionId(createdSessionId);
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'Nepodarilo sa inicializovať reláciu.');
    } finally {
      initInFlightRef.current = false;
      setIsInitializing(false);
    }
  }, [accessToken, appSessionId, voiceSessionId, config]);

  useEffect(() => {
    initializeVoiceSession();
  }, [initializeVoiceSession]);

  const handleSend = async () => {
    if (!voiceSessionId || !accessToken || !inputValue.trim() || isSending) return;

    const nextContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setErrorMessage(null);

    setMessages((prev) => [
      ...prev,
      { role: 'salesman', content: nextContent },
    ]);

    try {
      const response = await fetchWithTimeout('/api/sales/message', {
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

      if (!response.ok) {
        throw new Error('Nepodarilo sa odoslať správu.');
      }

      const data = await response.json();
      if (data?.client_message) {
        setMessages((prev) => [
          ...prev,
          { role: 'client', content: data.client_message },
        ]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.message || 'Nepodarilo sa odoslať správu.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    storeVoiceSessionId(null);
    setVoiceSessionId(null);
    setErrorMessage(null);
    lastInitForRef.current = null;
    initInFlightRef.current = false;
  };

  const canSend = Boolean(
    accessToken &&
      voiceSessionId &&
      inputValue.trim().length > 0 &&
      !isSending
  );

  const difficultyLabelMap = {
    beginner: 'Začiatočník',
    intermediate: 'Pokročilý',
    expert: 'Expert',
  };

  const clientTypeLabelMap = {
    new: 'Nový klient',
    existing: 'Existujúci klient',
  };

  const difficultyLabel =
    difficultyLabelMap[config?.difficulty] || config?.difficulty || 'Neurčené';
  const clientTypeLabel =
    clientTypeLabelMap[config?.clientType] || config?.clientType || 'Neurčené';
  const discLetter = (config?.clientDiscType || '').toUpperCase();
  const discTone = discToneStyles[discLetter] || discToneStyles.D;

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Obchodná simulácia</h1>
                <p className="text-sm text-slate-500">CRM</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Ukončiť / hodnotiť
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SimBadge
                label={difficultyLabel}
                icon={Award}
                variant="difficulty"
              />
              <SimBadge
                label={clientTypeLabel}
                icon={User}
                variant="client"
              />
              <SimBadge
                label={`DISC: ${discLetter || 'D'}`}
                icon={Target}
                variant="disc"
                dot={discLetter || 'D'}
                dotClassName={discTone.dot}
                className={discTone.badge}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-4 pb-28 sm:px-6">
            {errorMessage && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4">
              {isInitializing && (
                <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  Inicializujem hlasovú reláciu…
                </div>
              )}

              {messages.length === 0 && !isInitializing && (
                <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
                  Zatiaľ žiadne správy.
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === 'salesman'
                      ? 'ml-auto w-fit max-w-[85%] rounded-lg bg-[#B81547] px-3 py-2 text-sm text-white sm:max-w-[70%]'
                      : 'mr-auto w-fit max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm sm:max-w-[70%]'
                  }
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                    {message.role === 'salesman' ? 'Predajca' : 'Klient'}
                  </p>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            <div className="flex items-end gap-3">
              <textarea
                className="min-h-[64px] flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#B81547] focus:outline-none"
                placeholder="Napíšte správu klientovi..."
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                  canSend ? 'bg-[#B81547] hover:bg-[#a0123c]' : 'cursor-not-allowed bg-slate-300'
                }`}
              >
                {isSending ? 'Odosielam...' : 'Send'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SalesSimV1;
