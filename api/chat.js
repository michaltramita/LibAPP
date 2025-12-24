const { createLLMClient } = require('./lib/llmClient');
const { searchContext } = require('./lib/rag');
const { getJsonBody, getClientIp } = require('./lib/requestUtils');
const { rateLimit } = require('./lib/rateLimit');

const sensitivePattern = /(rodn[eé] [čc]íslo|social security|iban|adresa)/i;
const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_LOCALES = new Set(['sk', 'en']);

module.exports = async function handler(req, res) {
  const pathname = (req.url || '').split('?')[0];
  if (pathname.endsWith('/chat/tool-callback')) {
    await handleToolCallback(req, res);
    return;
  }

  await handleChat(req, res);
};

async function handleChat(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  const rate = rateLimit({ key: `chat:${ip}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const body = getJsonBody(req, res);
  if (!body) return;

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : undefined;
  const localeRaw = typeof body.locale === 'string' ? body.locale.trim() : 'sk';
  const locale = ALLOWED_LOCALES.has(localeRaw) ? localeRaw : 'sk';
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  if (!message) {
    res.status(400).json({ error: 'missing_message' });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: 'message_too_long' });
    return;
  }

  if (sessionId && sessionId.length > 128) {
    res.status(400).json({ error: 'invalid_session_id' });
    return;
  }

  logTelemetry({ sessionId, locale, metadata });

  if (sensitivePattern.test(message)) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(formatEvent('final', {
      content: 'Žiadosť obsahuje citlivé údaje. Pre tvoju bezpečnosť ju nemôžem spracovať.',
    }));
    res.end();
    return;
  }

  const contexts = searchContext(message, 2);
  const contextText = contexts.map((c) => `# ${c.title}\n${c.content}`).join('\n\n');

  const llm = createLLMClient();
  const messages = [
    { role: 'system', content: llm.systemPrompt },
    { role: 'developer', content: `Doplnkový kontext:\n${contextText}` },
    { role: 'user', content: message },
  ];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let buffer = '';
  for await (const chunk of llm.streamChat({ messages })) {
    if (chunk.type === 'token' && chunk.content) {
      buffer += chunk.content;
      res.write(formatEvent('token', { content: chunk.content }));
    }
    if (chunk.type === 'tool_call') {
      res.write(formatEvent('tool', chunk));
    }
    if (chunk.type === 'final') {
      const content = chunk.content || buffer;
      res.write(formatEvent('final', { content }));
      res.end();
    }
  }
}

async function handleToolCallback(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = getJsonBody(req, res);
  if (!body) return;

  const tool = typeof body.tool === 'string' ? body.tool.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const result = body.result;
  const allowedTools = new Set(['navigate', 'searchFeature', 'showGuide', 'openSettings']);

  if (!tool || !allowedTools.has(tool)) {
    res.status(400).json({ ok: false, error: 'invalid_tool' });
    return;
  }

  if (sessionId && sessionId.length > 128) {
    res.status(400).json({ ok: false, error: 'invalid_session_id' });
    return;
  }

  console.log(
    '[libo-tool-callback]',
    JSON.stringify({ tool, sessionId, at: new Date().toISOString() })
  );
  res.status(200).json({ ok: true, result });
}

function formatEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function logTelemetry(payload) {
  const minimal = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  console.log('[libo-telemetry]', JSON.stringify(minimal));
}
