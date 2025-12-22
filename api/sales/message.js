const { supabaseAdmin } = require('../lib/supabaseAdmin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
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

  try {
    const { data: existingSessions, error: sessionQueryError } = await supabaseAdmin
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

    const { error: messageError } = await supabaseAdmin
      .from('sales_voice_messages')
      .insert([{ session_id: sessionIdValue, role: roleValue, content }]);

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
