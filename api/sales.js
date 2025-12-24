const { createUserSupabaseClient, getSupabaseEnvError } = require('./lib/supabaseClient');
const { getJsonBody, getClientIp } = require('./lib/requestUtils');
const { rateLimit } = require('./lib/rateLimit');

const MAX_CONTENT_LENGTH = 1000;
const MAX_ID_LENGTH = 128;
const ALLOWED_DIFFICULTIES = new Set(['beginner', 'advanced', 'expert']);
const ALLOWED_CLIENT_TYPES = new Set(['new', 'repeat']);
const ALLOWED_CLIENT_DISC_TYPES = new Set(['D', 'I', 'S', 'C']);
const ALLOWED_MODULES = new Set(['obchodny_rozhovor']);
const SESSION_OWNER_COLUMN = 'user_id';
let missingSupabaseEnvLogged = false;

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  const pathname = (req.url || '').split('?')[0];
  const isSessionRoute = pathname.endsWith('/sales/session');
  const sessionDetailMatch = pathname.match(/\/sales\/session\/([^/]+)$/);
  const isMessageRoute = pathname.endsWith('/sales/message');

  if (!isSessionRoute && !isMessageRoute && !sessionDetailMatch) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    if (!sessionDetailMatch) {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    await handleGetSession(req, res, sessionDetailMatch[1]);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (isSessionRoute) {
    await handleSession(req, res);
    return;
  }

  await handleMessage(req, res);
};

function setCorsHeaders(req, res) {
  const origin = resolveAllowedOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function resolveAllowedOrigin(req) {
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // TODO: set APP_ORIGIN in production to avoid wildcard CORS.
  return req.headers.origin || '*';
}

async function getAuthenticatedClient(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const hasAuth = Boolean(token);

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[sales-api] auth context', { hasAuth, hasUserId: false });
    }
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }

  if (!ensureSupabaseEnv(res)) {
    return null;
  }

  let supabase;
  try {
    supabase = createUserSupabaseClient(token);
  } catch (error) {
    if (error?.code === 'missing_env') {
      if (!missingSupabaseEnvLogged) {
        console.error('[sales-api] missing SUPABASE_URL or SUPABASE_ANON_KEY');
        missingSupabaseEnvLogged = true;
      }
      res.status(500).json({ error: 'missing_env' });
      return null;
    }
    throw error;
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  const hasUserId = Boolean(userId);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[sales-api] auth context', { hasAuth, hasUserId });
  }

  if (authError || !userId) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }

  return { supabase, userId };
}

function ensureSupabaseEnv(res) {
  const envError = getSupabaseEnvError();
  if (!envError) return true;
  if (!missingSupabaseEnvLogged) {
    console.error('[sales-api] missing SUPABASE_URL or SUPABASE_ANON_KEY');
    missingSupabaseEnvLogged = true;
  }
  res.status(500).json({ error: 'missing_env' });
  return false;
}

function handleSupabaseFailure(res, error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  const status = error?.status;
  const code = error?.code;
  const lowerMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const isForbidden =
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('permission denied');

  if (isForbidden) {
    res.status(403).json({ ok: false, error: 'forbidden', details: message });
    return;
  }

  res.status(400).json({ ok: false, error: 'supabase_error', details: message });
}

async function handleSession(req, res) {
  const ip = getClientIp(req);
  const rate = rateLimit({ key: `sales-session:${ip}`, limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    res.status(429).json({ ok: false, error: 'rate_limited' });
    return;
  }

  const body = getJsonBody(req, res);
  if (!body) return;
  stripOwnershipFields(body);
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
    const authContext = await getAuthenticatedClient(req, res);
    if (!authContext) return;
    const { supabase, userId } = authContext;

    if (requestedSessionId) {
      const { data: existingSessions, error: existingSessionError } = await supabase
        .from('sales_voice_sessions')
        .select('id,user_id')
        .eq('id', requestedSessionId)
        .eq('user_id', userId)
        .limit(1);

      if (existingSessionError) {
        console.error('[sales-api] failed to check existing session', existingSessionError);
        handleSupabaseFailure(
          res,
          existingSessionError,
          'Unable to check for an existing session'
        );
        return;
      }

      if (existingSessions && existingSessions.length) {
        const existingSession = existingSessions[0];

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
      user_id: userId,
    };

    if (requestedSessionId) {
      sessionInput.id = requestedSessionId;
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('sales_voice_sessions')
      .insert([sessionInput])
      .select('id');

    if (sessionError) {
      console.error('[sales-api] failed to insert session', sessionError);
      handleSupabaseFailure(res, sessionError, 'Unable to create session');
      return;
    }

    const sessionId = resolveSessionId(sessionData, requestedSessionId);

    if (!sessionId) {
      console.error('[sales-api] session created but missing id', { sessionData });
      res.status(500).json({ ok: false, error: 'missing_session_id' });
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sales-api] session created user=${userId.slice(0, 8)} session=${sessionId}`);
    }

    res.status(200).json({ ok: true, session_id: sessionId });
  } catch (err) {
    console.error('[sales-api] session handler error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

function resolveSessionId(sessionData, requestedSessionId) {
  if (Array.isArray(sessionData)) {
    return sessionData[0]?.id || requestedSessionId || null;
  }

  if (sessionData && typeof sessionData === 'object') {
    return sessionData.id || requestedSessionId || null;
  }

  return requestedSessionId || null;
}

async function handleMessage(req, res) {
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
    const authContext = await getAuthenticatedClient(req, res);
    if (!authContext) return;
    const { supabase, userId } = authContext;

    const { data: existingSessions, error: sessionQueryError } = await supabase
      .from('sales_voice_sessions')
      .select('id,user_id')
      .eq('id', sessionIdValue)
      .eq('user_id', userId)
      .limit(1);

    if (sessionQueryError) {
      console.error('[sales-api] failed to verify session', sessionQueryError);
      handleSupabaseFailure(res, sessionQueryError, 'Unable to verify session');
      return;
    }

    if (!existingSessions || !existingSessions.length) {
      console.warn(`[sales] message rejected: session_not_found ${sessionIdValue}`);
      res.status(404).json({ ok: false, error: 'session_not_found' });
      return;
    }

    const session = existingSessions[0];

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sales-api] message user=${userId.slice(0, 8)} session=${session.id}`);
    }

    const { error: messageError } = await supabase
      .from('sales_voice_messages')
      .insert([{ session_id: sessionIdValue, role: roleValue, content: contentValue }]);

    if (messageError) {
      console.error('[sales-api] failed to insert message', messageError);
      handleSupabaseFailure(res, messageError, 'Unable to insert message');
      return;
    }

    const { error: salesmanCountError, count: salesmanCount } = await supabase
      .from('sales_voice_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionIdValue)
      .eq('role', 'salesman');

    if (salesmanCountError) {
      console.error('[sales-api] failed to count salesman messages', salesmanCountError);
      handleSupabaseFailure(
        res,
        salesmanCountError,
        salesmanCountError.message || 'Unable to read salesman messages count'
      );
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

    const { error: clientMessageError } = await supabase
      .from('sales_voice_messages')
      .insert([{ session_id: sessionIdValue, role: 'client', content: clientReplyText }]);

    if (clientMessageError) {
      console.error('[sales-api] failed to insert client reply', clientMessageError);
      handleSupabaseFailure(res, clientMessageError, 'Unable to insert client reply');
      return;
    }

    res.status(200).json({ ok: true, client_message: clientReplyText, stage });
  } catch (err) {
    console.error('[sales-api] handler error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

async function handleGetSession(req, res, sessionId) {
  if (!sessionId || sessionId.length > MAX_ID_LENGTH) {
    res.status(400).json({ ok: false, error: 'invalid_session_id' });
    return;
  }

  try {
    const authContext = await getAuthenticatedClient(req, res);
    if (!authContext) return;
    const { supabase, userId } = authContext;

    const { data: session, error: sessionError } = await supabase
      .from('sales_voice_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError) {
      handleSupabaseFailure(res, sessionError, 'Unable to fetch session');
      return;
    }

    if (!session) {
      res.status(404).json({ ok: false, error: 'session_not_found' });
      return;
    }

    const { data: messages, error: messagesError } = await supabase
      .from('sales_voice_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[sales-api] failed to fetch session messages', messagesError);
      handleSupabaseFailure(res, messagesError, 'Unable to fetch session messages');
      return;
    }

    res.status(200).json({ ok: true, session, messages: messages || [] });
  } catch (err) {
    console.error('[sales-api] session fetch error', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

function stripOwnershipFields(body) {
  if (!body || typeof body !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(body, 'user_id')) {
    delete body.user_id;
  }
  if (SESSION_OWNER_COLUMN !== 'user_id' && Object.prototype.hasOwnProperty.call(body, SESSION_OWNER_COLUMN)) {
    delete body[SESSION_OWNER_COLUMN];
  }
}
