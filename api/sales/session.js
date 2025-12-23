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
  const requestedSessionId =
    typeof body.session_id === 'string' && body.session_id.trim() ? body.session_id.trim() : null;
  const userId = typeof body.user_id === 'string' && body.user_id.trim() ? body.user_id.trim() : null;
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
    if (requestedSessionId) {
      const { data: existingSessions, error: existingSessionError } = await supabaseAdmin
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
    };

    if (requestedSessionId) {
      sessionInput.id = requestedSessionId;
    }

    if (userId) {
      sessionInput.user_id = userId;
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('sales_voice_sessions')
      .insert([sessionInput])
      .select('id')
      .single();

    if (sessionError) {
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
