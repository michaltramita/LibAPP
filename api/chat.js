const { createLLMClient } = require('./lib/llmClient');
const { searchContext } = require('./lib/rag');

const sensitivePattern = /(rodn[eé] [čc]íslo|social security|iban|adresa)/i;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message = '', sessionId, locale = 'sk', metadata = {} } = req.body || {};
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
};

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
