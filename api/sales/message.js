const { createSupabaseUserClient } = require('../lib/supabaseUser');
const { getJsonBody, getClientIp } = require('../lib/requestUtils');
const { rateLimit } = require('../lib/rateLimit');

const MAX_CONTENT_LENGTH = 1000;
const MAX_ID_LENGTH = 128;

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
  const rate = rateLimit({ key: `sales-message:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }

  const body = getJsonBody(req, res);
  if (!body) return;
  const { session_id, role, content } = body;

  const missingFields = [];
  const sessionIdValue = typeof session_id === 'string' ? session_id.trim() : '';
  const roleValue = typeof role === 'string' ? role.trim() : '';
  const contentValue = typeof content === 'string' ? content.trim() : '';

  if (!sessionIdValue) missingFields.push('session_id');
  if (!roleValue) missingFields.push('role');
  if (!contentValue) missingFields.push('content');

  if (missingFields.length) {
    const details = `Missing or invalid fields: ${missingFields.join(', ')}`;
    console.warn(`[sales] message validation failed: ${details}`);
    res.status(400).json({ ok: false, error: 'invalid_input', details });
    return;
  }

  const allowedRoles = ['salesman', 'client', 'system'];
  if (!allowedRoles.includes(roleValue)) {
    const details = `Invalid role: ${roleValue}`;
    console.warn(`[sales] message validation failed: ${details}`);
    res.status(400).json({ ok: false, error: 'invalid_input', details });
    return;
  }

  if (sessionIdValue.length > MAX_ID_LENGTH) {
    res.status(400).json({ ok: false, error: 'invalid_input' });
    return;
  }

  if (contentValue.length > MAX_CONTENT_LENGTH) {
    res.status(400).json({ ok: false, error: 'invalid_input' });
    return;
  }

  try {
    const { data: existingSessions, error: sessionQueryError } = await supabaseUser
      .from('sales_voice_sessions')
      .select('id')
      .eq('id', sessionIdValue)
      .limit(1);

    if (sessionQueryError) {
      console.error('[sales-api] failed to verify session', sessionQueryError);
      res.status(500).json({ ok: false, error: 'supabase_query_failed' });
      return;
    }

    if (!existingSessions || !existingSessions.length) {
      console.warn(`[sales] message rejected: session_not_found ${sessionIdValue}`);
      res.status(404).json({ ok: false, error: 'session_not_found' });
      return;
    }

    const { error: messageError } = await supabaseUser
      .from('sales_voice_messages')
      .insert([
        {
          session_id: sessionIdValue,
          role: roleValue,
          content: contentValue,
          user_id: authUser.id,
        },
      ]);

    if (messageError) {
      console.error('[sales-api] failed to insert message', messageError);
      res.status(500).json({ ok: false, error: 'supabase_insert_failed' });
      return;
    }

    const { error: salesmanCountError, count: salesmanCount } = await supabaseUser
      .from('sales_voice_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionIdValue)
      .eq('role', 'salesman');

    if (salesmanCountError) {
      console.error('[sales-api] failed to count salesman messages', salesmanCountError);
      res.status(500).json({
        ok: false,
        error: 'salesman_count_failed',
        details: salesmanCountError.message || 'Unable to read salesman messages count',
      });
      return;
    }

    let clientReplyText = 'Rozumiem. Povedzte mi o tom viac.';
    let stage = 'intro';

    if (salesmanCount === 1) {
      clientReplyText = 'Dobrý deň. Povedzte mi stručne, čo ponúkate a komu.';
      stage = 'intro';
    } else if (salesmanCount <= 3) {
      clientReplyText = 'Rozumiem. Aké sú pre vás najdôležitejšie potreby alebo ciele, ktoré chcete týmto riešiť?';
      stage = 'discovery';
    } else if (salesmanCount <= 5) {
      clientReplyText = 'OK. V čom je vaša ponuka iná než bežné riešenia a aký to má dopad na výsledky?';
      stage = 'presentation';
    } else if (salesmanCount >= 6) {
      clientReplyText = 'Dobre. Aký je ďalší konkrétny krok, ktorý navrhujete?';
      stage = 'closing';
    }

    console.log(`[sales] reply stage=${stage} salesmanCount=${salesmanCount}`);

    const { error: clientMessageError } = await supabaseUser
      .from('sales_voice_messages')
      .insert([
        {
          session_id: sessionIdValue,
          role: 'client',
          content: clientReplyText,
          user_id: authUser.id,
        },
      ]);

    if (clientMessageError) {
      console.error('[sales-api] failed to insert client reply', clientMessageError);
      res.status(500).json({ ok: false, error: 'client_reply_insert_failed' });
      return;
    }

    res.status(200).json({ ok: true, client_message: clientReplyText, stage });
  } catch (err) {
    console.error('[sales-api] handler error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
