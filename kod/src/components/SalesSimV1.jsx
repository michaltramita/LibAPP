import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

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

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Sales Simulation (V1)</h1>
            <p className="text-sm text-slate-500">Minimal stabilný režim na testovanie.</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Reset V1 session
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-hidden px-6 py-4">
        <div className="flex-1 space-y-4 overflow-y-auto rounded-md border border-slate-200 bg-white p-4">
          {isInitializing && (
            <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Inicializujem hlasovú reláciu…
            </div>
          )}

          {messages.length === 0 && !isInitializing && (
            <div className="text-sm text-slate-400">Zatiaľ žiadne správy.</div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === 'salesman'
                  ? 'ml-auto w-fit max-w-[80%] rounded-lg bg-[#B81547] px-3 py-2 text-sm text-white'
                  : 'mr-auto w-fit max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700'
              }
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                {message.role === 'salesman' ? 'Predajca' : 'Klient'}
              </p>
              <p>{message.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <textarea
            className="min-h-[64px] flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-[#B81547] focus:outline-none"
            placeholder="Napíšte správu klientovi..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
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
      </main>
    </div>
  );
};

export default SalesSimV1;
