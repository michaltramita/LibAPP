const { supabaseAdmin } = require('../lib/supabaseAdmin');

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

  const body = req.body || {};
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

    if (requestedSessionId) {
      const { data: existingSessions, error: existingSessionError } = await supabaseAdmin
        .from('sales_voice_sessions')
        .select('id,user_id')
        .eq('id', requestedSessionId)
        .limit(1);

      if (existingSessionError) {
        console.error('[sales-api] failed to check existing session', existingSessionError);
        res.status(500).json({ ok: false, error: 'supabase_query_failed' });
        return;
      }

      if (existingSessions && existingSessions.length) {
        const existingSession = existingSessions[0];
        if (existingSession.user_id && existingSession.user_id !== userId) {
          res.status(403).json({ ok: false, error: 'forbidden' });
          return;
        }

        if (!existingSession.user_id) {
          const { error: ownershipError } = await supabaseAdmin
            .from('sales_voice_sessions')
            .update({ user_id: userId })
            .eq('id', existingSession.id);

          if (ownershipError) {
            console.error('[sales-api] failed to claim session ownership', ownershipError);
            res.status(500).json({ ok: false, error: 'supabase_update_failed' });
            return;
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[sales-api] session reuse user=${userId.slice(0, 8)} session=${existingSession.id}`
          );
        }

        res.status(200).json({ ok: true, session_id: existingSession.id });
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

    sessionInput.user_id = userId;

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

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[sales-api] session created user=${userId.slice(0, 8)} session=${sessionData.id}`
      );
    }

    res.status(200).json({ ok: true, session_id: sessionData.id });
  } catch (err) {
    console.error('[sales-api] session handler error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};
