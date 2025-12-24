const { createSupabaseUserClient } = require('../lib/supabaseUser');
const { getJsonBody, getClientIp } = require('../lib/requestUtils');
const { rateLimit } = require('../lib/rateLimit');

const MAX_ID_LENGTH = 128;
const ALLOWED_DIFFICULTIES = new Set(['beginner', 'advanced', 'expert']);
const ALLOWED_CLIENT_TYPES = new Set(['new', 'repeat']);
const ALLOWED_CLIENT_DISC_TYPES = new Set(['D', 'I', 'S', 'C']);
const ALLOWED_MODULES = new Set(['obchodny_rozhovor']);

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const expectedOrigin = req.headers.host
    ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
    : null;
  const allowOrigin =
    origin &&
    (allowedOrigins.length
      ? allowedOrigins.includes(origin)
      : expectedOrigin && origin === expectedOrigin)
      ? origin
      : '';

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  let supabaseUser;
  try {
    supabaseUser = createSupabaseUserClient(tokenMatch[1]);
  } catch (error) {
    console.error('[sales-api] failed to init supabase user client', error);
    res.status(500).json({ ok: false, error: 'supabase_client_failed' });
    return;
  }

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  const authUser = authData?.user;
  if (authError || !authUser) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const ip = getClientIp(req);
  const rate = rateLimit({ key: `sales-session:${ip}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }

  const body = getJsonBody(req, res);
  if (!body) return;
  const requestedSessionId =
    typeof body.session_id === 'string' && body.session_id.trim() ? body.session_id.trim() : null;
  const difficulty =
    typeof body.difficulty === 'string' && body.difficulty.trim()
      ? body.difficulty.trim()
      : 'beginner';
  const clientType =
    typeof body.client_type === 'string' && body.client_type.trim() ? body.client_type.trim() : 'new';
  const clientDiscType =
    typeof body.client_disc_type === 'string' && body.client_disc_type.trim()
      ? body.client_disc_type.trim()
      : null;
  const moduleValue =
    typeof body.module === 'string' && body.module.trim()
      ? body.module.trim()
      : 'obchodny_rozhovor';

  try {
    if (requestedSessionId && requestedSessionId.length > MAX_ID_LENGTH) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    if (!ALLOWED_CLIENT_TYPES.has(clientType)) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    if (clientDiscType && !ALLOWED_CLIENT_DISC_TYPES.has(clientDiscType)) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    if (!ALLOWED_MODULES.has(moduleValue)) {
      res.status(400).json({ ok: false, error: 'invalid_input' });
      return;
    }

    if (requestedSessionId) {
      const { data: existingSessions, error: existingSessionError } = await supabaseUser
        .from('sales_voice_sessions')
        .select('id')
        .eq('id', requestedSessionId)
        .limit(1);

      if (existingSessionError) {
        console.error('[sales-api] failed to check existing session', existingSessionError);
        res.status(500).json({ ok: false, error: 'supabase_query_failed' });
        return;
      }

      if (existingSessions && existingSessions.length) {
        res.status(200).json({ ok: true, session_id: existingSessions[0].id });
        return;
      }
    }

    const sessionInput = {
      module: moduleValue,
      difficulty,
      client_type: clientType,
      client_disc_type: clientDiscType,
      user_id: authUser.id,
    };

    if (requestedSessionId) {
      sessionInput.id = requestedSessionId;
    }

    const { data: sessionData, error: sessionError } = await supabaseUser
      .from('sales_voice_sessions')
      .insert([sessionInput])
      .select('id')
      .single();

    if (sessionError) {
      if (sessionError.code === '23505') {
        res.status(404).json({ ok: false, error: 'session_not_found' });
        return;
      }
      console.error('[sales-api] failed to insert session', sessionError);
      res.status(500).json({ ok: false, error: 'supabase_insert_failed' });
      return;
    }

    res.status(200).json({ ok: true, session_id: sessionData.id });
  } catch (err) {
    console.error('[sales-api] session handler error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
