// src/components/LiboChat.jsx
import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const LiboAvatar = ({ size = 32 }) => (
  <img
    src="/Libo.png"
    alt="Libo maskot"
    className="rounded-full object-cover bg-slate-200"
    style={{ width: size, height: size }}
    onError={(e) => {
      // fallback, ak obrázok neexistuje
      e.currentTarget.style.display = 'none';
    }}
  />
);

const LiboChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'libo',
      text: 'Ahoj, som Libo. Som tvoj sprievodca v LibApp. Môžeš sa ma spýtať na moduly, simulácie alebo výsledky.',
    },
  ]);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      // zatiaľ len jednoduchá odpoveď – neskôr sa sem doplní API
      const replyText =
        'Som v testovacej verzii. Napíš mi, či riešiš login, modul, simuláciu alebo vyhodnotenie a skúsim ťa nasmerovať.';

      const liboMessage = { role: 'libo', text: replyText };
      setMessages((prev) => [...prev, liboMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'libo',
          text: 'Niečo sa pokazilo. Skús to prosím o chvíľu znova.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating tlačidlo */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={toggleOpen}
            className="flex items-center gap-2 rounded-full bg-[#B81547] px-4 py-3 text-white shadow-lg hover:bg-[#9e123d] transition-colors"
          >
            <LiboAvatar size={24} />
            <span>Libo</span>
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-full max-w-sm">
          <div className="flex flex-col rounded-2xl bg-white/80 backdrop-blur border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.20)] h-[420px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <LiboAvatar size={32} />
                <div>
                  <div className="font-semibold text-slate-900">
                    Libo – podpora
                  </div>
                  <div className="text-xs text-slate-500">
                    Pomáham ti s LibApp, modulmi a simuláciami
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleOpen}
                className="rounded-full p-1 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Správy */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm bg-slate-50/70">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={
                      isUser
                        ? 'flex justify-end'
                        : 'flex justify-start items-end gap-2'
                    }
                  >
                    {!isUser && (
                      <div className="flex-shrink-0">
                        <LiboAvatar size={24} />
                      </div>
                    )}
                    <div
                      className={
                        isUser
                          ? 'max-w-[80%] rounded-2xl bg-[#B81547] text-white px-3 py-2'
                          : 'max-w-[80%] rounded-2xl bg-white border border-slate-200 text-slate-900 px-3 py-2'
                      }
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="border-t border-slate-200 px-3 py-2 bg-white/90 rounded-b-2xl"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Napíš otázku pre Liba..."
                  className="flex-1 text-sm border border-slate-200 rounded-full px-3 py-2 outline-none focus:ring-1 focus:ring-[#B81547] focus:border-[#B81547]"
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="rounded-full bg-[#B81547] text-white p-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LiboChat;
