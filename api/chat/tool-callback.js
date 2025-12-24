const { getJsonBody } = require('../lib/requestUtils');

module.exports = async function handler(req, res) {
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

  console.log('[libo-tool-callback]', JSON.stringify({ tool, sessionId, at: new Date().toISOString() }));
  res.status(200).json({ ok: true, result });
};
