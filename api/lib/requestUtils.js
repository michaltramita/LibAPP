function getJsonBody(req, res) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      res.status(400).json({ error: 'invalid_json' });
      return null;
    }
  }
  if (typeof req.body === 'object') return req.body;
  res.status(400).json({ error: 'invalid_body' });
  return null;
}

function getClientIp(req) {
  const headers = req.headers || {};
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

module.exports = { getJsonBody, getClientIp };
