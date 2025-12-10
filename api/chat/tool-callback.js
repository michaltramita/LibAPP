module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { tool, result, sessionId } = req.body || {};
  console.log('[libo-tool-callback]', JSON.stringify({ tool, sessionId, at: new Date().toISOString() }));
  res.status(200).json({ ok: true, result });
};
