const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { getJsonBody, getClientIp } = require('../lib/requestUtils');
const { rateLimit } = require('../lib/rateLimit');

const MAX_CONTENT_LENGTH = 1000;
const MAX_ID_LENGTH = 128;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    res.status(400).json({ ok: false, error: 'missing_fields', details });
    return;
  }

  const allowedRoles = ['salesman', 'client', 'system'];
  if (!allowedRoles.includes(roleValue)) {
    const details = `Invalid role: ${roleValue}`;
    console.warn(`[sales] message validation failed: ${details}`);
    res.status(400).json({ ok: false, error: 'invalid_role', details });
    return;
  }

  if (sessionIdValue.length > MAX_ID_LENGTH) {
    res.status(400).json({ ok: false, error: 'invalid_session_id' });
    return;
  }

  if (contentValue.length > MAX_CONTENT_LENGTH) {
    res.status(400).json({ ok: false, error: 'content_too_long' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const userId = authData?.user?.id;

    if (authError || !userId) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const { data: existingSessions, error: sessionQueryError } = await supabaseAdmin
      .from('sales_voice_sessions')
      .select('id,user_id')
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

    const session = existingSessions[0];
    if (session.user_id && session.user_id !== userId) {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return;
    }

    if (!session.user_id) {
      const { error: ownershipError } = await supabaseAdmin
        .from('sales_voice_sessions')
        .update({ user_id: userId })
        .eq('id', session.id);

      if (ownershipError) {
        console.error('[sales-api] failed to claim session ownership', ownershipError);
        res.status(500).json({ ok: false, error: 'supabase_update_failed' });
        return;
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sales-api] message user=${userId.slice(0, 8)} session=${session.id}`);
    }

    const { error: messageError } = await supabaseAdmin
      .from('sales_voice_messages')
      .insert([{ session_id: sessionIdValue, role: roleValue, content: contentValue }]);

    if (messageError) {
      console.error('[sales-api] failed to insert message', messageError);
      res.status(500).json({ ok: false, error: 'supabase_insert_failed' });
      return;
    }

    const { error: salesmanCountError, count: salesmanCount } = await supabaseAdmin
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

    const { error: clientMessageError } = await supabaseAdmin
      .from('sales_voice_messages')
      .insert([{ session_id: sessionIdValue, role: 'client', content: clientReplyText }]);

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
