// src/components/LiboChat.jsx
import React, { useEffect, useState } from 'react';
import { MessageCircle, X, Send, Loader2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { executeTool } from '@/utils/liboTools';

const LiboAvatar = ({ size = 32 }) => (
  <img src="/Libo.png" alt="Libo" className="rounded-full object-cover bg-slate-200" style={{ width: size, height: size }}
    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
);

const LiboChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([{ role: 'libo', text: 'Ahoj, som Libo. Som tvoj sprievodca v LibApp. Môžeš sa ma spýtať na moduly, simulácie alebo výsledky.' }]);
  const [actions, setActions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { if (isOpen) setInput(''); }, [isOpen]);

  const updateAssistantMessage = (text, isFinal) => setMessages((prev) => {
    const next = [...prev];
    const last = next[next.length - 1];
    if (last && last.role === 'libo' && !last.final) next[next.length - 1] = { ...last, text, final: isFinal };
    else next.push({ role: 'libo', text, final: isFinal });
    return next;
  });

  const handleTool = (tool) => {
    const result = executeTool({
      tool: tool.name,
      args: tool.arguments,
      navigate: (route) => { navigate(route); return route; },
      showGuide: (id) => { setActions((p) => [...p, { type: 'guide', id }]); return id; },
    });
    if (result) setActions((p) => [...p, { type: tool.name, detail: result }]);
  };

  const parseSseStream = async (reader) => {
    const decoder = new TextDecoder(); let partial = ''; let streamingText = '';
    setIsSending(true);
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      partial += decoder.decode(value, { stream: true });
      const events = partial.split('\n\n'); partial = events.pop();
      events.forEach((evt) => {
        const [eventLine, dataLine] = evt.split('\n').filter(Boolean);
        const type = eventLine?.replace('event: ', ''); const data = dataLine?.replace('data: ', '');
        if (!type || !data) return; const payload = JSON.parse(data);
        if (type === 'token') { streamingText += payload.content; updateAssistantMessage(streamingText, false); }
        if (type === 'tool') handleTool(payload);
        if (type === 'final') updateAssistantMessage(payload.content || streamingText, true);
      });
    }
    setIsSending(false);
  };

  const handleSend = async (e) => {
    e.preventDefault(); const trimmed = input.trim(); if (!trimmed || isSending) return;
    setMessages((p) => [...p, { role: 'user', text: trimmed }, { role: 'libo', text: '', final: false }]); setInput('');
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed }) });
      const reader = res.body?.getReader(); if (reader) await parseSseStream(reader);
    } catch (err) { console.error(err); updateAssistantMessage('Niečo sa pokazilo. Skús to prosím neskôr.', true); setIsSending(false); }
  };

  const undoAction = (index) => setActions((prev) => prev.filter((_, i) => i !== index));

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-40">
          <button type="button" onClick={() => setIsOpen(true)} className="flex items-center gap-2 rounded-full bg-[#B81547] px-4 py-3 text-white shadow-lg hover:bg-[#9e123d] transition-colors">
            <LiboAvatar size={24} /> <span>Libo</span> <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-full max-w-sm">
          <div className="flex flex-col rounded-2xl bg-white/80 backdrop-blur border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.20)] h-[420px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <LiboAvatar size={32} />
                <div>
                  <div className="font-semibold text-slate-900">Libo – podpora</div>
                  <div className="text-xs text-slate-500">Pomáham ti s LibApp, modulmi a simuláciami</div>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-slate-100 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm bg-slate-50/70">
              {isSending && (<div className="flex gap-2 items-center text-xs text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Libo premýšľa...</div>)}
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx} className={isUser ? 'flex justify-end' : 'flex justify-start items-end gap-2'}>
                    {!isUser && (<div className="flex-shrink-0"><LiboAvatar size={24} /></div>)}
                    <div className={isUser ? 'max-w-[80%] rounded-2xl bg-[#B81547] text-white px-3 py-2' : 'max-w-[80%] rounded-2xl bg-white border border-slate-200 text-slate-900 px-3 py-2'}>
                      {msg.text || <span className="text-slate-400">...</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {actions.length > 0 && (
              <div className="border-t border-slate-200 px-3 py-2 flex gap-2 flex-wrap text-xs bg-white">
                {actions.map((a, idx) => (
                  <span key={`${a.type}-${idx}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1">
                    {a.type} {a.detail?.result || a.detail || a.id}
                    <button type="button" onClick={() => undoAction(idx)} aria-label="Undo" className="text-slate-500"><RotateCcw className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="border-t border-slate-200 px-3 py-2 bg-white/90 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Napíš otázku pre Liba..." className="flex-1 text-sm border border-slate-200 rounded-full px-3 py-2 outline-none focus:ring-1 focus:ring-[#B81547] focus:border-[#B81547]" />
                <button type="submit" disabled={isSending || !input.trim()} className="rounded-full bg-[#B81547] text-white p-2 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
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
