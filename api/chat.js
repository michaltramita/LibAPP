const { createLLMClient } = require('./lib/llmClient');
const { searchContext } = require('./lib/rag');
const { getJsonBody, getClientIp } = require('./lib/requestUtils');
const { rateLimit } = require('./lib/rateLimit');

const sensitivePattern = /(rodn[eé] [čc]íslo|social security|iban|adresa)/i;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_METADATA_BYTES = 2 * 1024;
const MAX_SESSION_ID_LENGTH = 128;
const ALLOWED_LOCALES = new Set(['sk', 'en']);
const CHAT_RATE_LIMITS = {
  unauth: { limit: 10, windowMs: 60_000 },
  auth: { limit: 60, windowMs: 60_000 },
  authIp: { limit: 120, windowMs: 60_000 },
};

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
  const authContext = await getAuthContext(req);

  const body = getJsonBody(req, res);
  if (!body) {
    logChatRequest({ isAuth: !!authContext, messageLength: 0, rateLimited: false });
    return;
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : undefined;
  const localeRaw = typeof body.locale === 'string' ? body.locale.trim() : 'sk';
  const locale = ALLOWED_LOCALES.has(localeRaw) ? localeRaw : 'sk';
  const metadata = sanitizeMetadata(body.metadata);
  const rate = applyChatRateLimit({ ip, userId: authContext?.userId });
  const rateLimited = !rate.allowed;

  logChatRequest({
    isAuth: !!authContext,
    messageLength: message.length,
    rateLimited,
  });

  if (rateLimited) {
    respondRateLimited(res);
    return;
  }

  if (!message) {
    res.status(400).json({ error: 'missing_message' });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: 'message_too_long' });
    return;
  }

  if (sessionId && sessionId.length > MAX_SESSION_ID_LENGTH) {
    res.status(400).json({ error: 'invalid_session_id' });
    return;
  }

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

function respondRateLimited(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(formatEvent('final', {
    content: 'Rate limit exceeded. Try again later.',
  }));
  res.end();
}

function logChatRequest({ isAuth, messageLength, rateLimited }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.log('[libo-chat]', JSON.stringify({
    auth: isAuth,
    messageLength,
    rateLimited,
  }));
}

async function getAuthContext(req) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const { createUserSupabaseClient } = require('./lib/supabaseClient');
  const supabase = createUserSupabaseClient(token);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (authError || !userId) return null;
  return { userId };
}

function applyChatRateLimit({ ip, userId }) {
  if (userId) {
    const userRate = rateLimit({ key: `chat:user:${userId}`, ...CHAT_RATE_LIMITS.auth });
    const ipRate = rateLimit({ key: `chat:ip:${ip}`, ...CHAT_RATE_LIMITS.authIp });
    return { allowed: userRate.allowed && ipRate.allowed };
  }
  const ipRate = rateLimit({ key: `chat:ip:${ip}`, ...CHAT_RATE_LIMITS.unauth });
  return { allowed: ipRate.allowed };
}

function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || typeof key !== 'string') continue;
    if (isPrimitive(value)) {
      sanitized[key] = value;
    }
  }
  return enforceMetadataLimit(sanitized);
}

function enforceMetadataLimit(metadata) {
  const limited = {};
  for (const [key, value] of Object.entries(metadata)) {
    limited[key] = value;
    if (JSON.stringify(limited).length > MAX_METADATA_BYTES) {
      delete limited[key];
      break;
    }
  }
  return limited;
}

function isPrimitive(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}
