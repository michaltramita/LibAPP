const { createUserSupabaseClient, getSupabaseEnvError } = require('./lib/supabaseClient');
const { createLLMClient } = require('./lib/llmClient');
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
const SALES_SCENARIOS = require('../shared/salesScenarios.json');

const STAGES = ['intro', 'discovery', 'presentation', 'closing'];
const DISC_TYPES = ['D', 'I', 'S', 'C'];
const CLIENT_TYPES = ['new', 'repeat'];

const DEFAULT_SCENARIO =
  (Array.isArray(SALES_SCENARIOS) && SALES_SCENARIOS[0]) || {
    id: 'default',
    title: 'Všeobecný obchodný scenár',
    description: 'Všeobecný tréningový scenár bez špecifikácie.',
    constraints: [],
  };

const BASE_BY_STAGE = {
  intro: {
    goal: 'Rýchlo kvalifikovať a pochopiť základ',
    maxQuestions: 1,
    forbiddenTopics: ['price', 'implementation'],
    defaultReaction: 'Rozumiem.',
  },
  discovery: {
    goal: 'Odkryť potreby a motivácie bez návrhu riešenia',
    maxQuestions: 2,
    forbiddenTopics: ['commitment', 'pricing'],
    defaultReaction: 'Chápem.',
  },
  presentation: {
    goal: 'Otestovať hodnotu a diferenciáciu',
    maxQuestions: 1,
    forbiddenTopics: ['closing'],
    defaultReaction: 'Znie to zaujímavo.',
  },
  closing: {
    goal: 'Dohodnúť ďalší krok alebo bezpečne odložiť',
    maxQuestions: 1,
    forbiddenTopics: [],
    defaultReaction: 'Ďakujem za zhrnutie.',
  },
};

const NEW_BY_STAGE = {
  intro: {
    tone: 'calm',
    questionPools: [
      'Povedzte mi jednou vetou, čo presne ponúkate a pre koho?',
      'Aký problém to rieši a prečo je to dôležité teraz?',
    ],
    constraints: ['Zatiaľ len stručne, bez detailov o riešení.'],
  },
  discovery: {
    tone: 'friendly',
    questionPools: [
      'Aký je dnes váš hlavný cieľ v tejto oblasti?',
      'Čo sa stane, ak to necháte tak?',
      'Podľa čoho budete hodnotiť úspech?',
    ],
    constraints: ['Najprv potrebujem pochopiť kontext.'],
  },
  presentation: {
    tone: 'analytical',
    questionPools: [
      'V čom je vaše riešenie iné a aký to má dopad na výsledok?',
      'Aké sú konkrétne parametre alebo dôkazy, ktoré to potvrdzujú?',
    ],
    constraints: ['Bez jasných dôkazov nepôjdem ďalej.'],
  },
  closing: {
    tone: 'direct',
    questionPools: [
      'Čo navrhujete ako ďalší krok a kedy?',
      'Kto ešte musí byť pri rozhodnutí a dokedy to viete posunúť?',
    ],
    constraints: ['Potrebujem jasný ďalší krok.'],
  },
};

const REPEAT_BY_DISC_STAGE = {
  D: {
    intro: {
      tone: 'direct',
      questionPools: [
        'Povedzte stručne, čo presne ponúkate a komu.',
        'Aký konkrétny problém riešite teraz?',
      ],
      constraints: ['Bez omáčok, poďme na podstatu.'],
      challengeStyle: 'concise',
    },
    discovery: {
      tone: 'direct',
      questionPools: [
        'Aký je hlavný cieľ a do kedy?',
        'Čo je dnes najväčší blokátor výsledku?',
      ],
      constraints: ['Chcem jasné priority a čas.'],
      challengeStyle: 'pressure',
    },
    presentation: {
      tone: 'direct',
      questionPools: [
        'V čom ste merateľne lepší a aký to má dopad?',
        'Aké čísla to dokazujú?',
      ],
      constraints: ['Potrebujem merateľný dopad.'],
      challengeStyle: 'results',
    },
    closing: {
      tone: 'direct',
      questionPools: [
        'Aký je ďalší krok a kedy to vieme uzavrieť?',
        'Kto rozhoduje a do kedy?',
      ],
      constraints: ['Chcem termín a zodpovednosť.'],
      challengeStyle: 'decisive',
    },
  },
  I: {
    intro: {
      tone: 'friendly',
      questionPools: [
        'Povedzte mi jednou vetou, komu najviac pomáhate.',
        'Čo je na vašej ponuke najzaujímavejšie pre ľudí?',
      ],
      constraints: ['Krátko a zrozumiteľne.'],
      challengeStyle: 'social',
    },
    discovery: {
      tone: 'friendly',
      questionPools: [
        'Aký je váš hlavný cieľ a koho sa najviac týka?',
        'Ako by to pocítil váš tím alebo zákazníci?',
      ],
      constraints: ['Zaujíma ma vplyv na ľudí.'],
      challengeStyle: 'people',
    },
    presentation: {
      tone: 'friendly',
      questionPools: [
        'V čom je to pre ľudí lepšie a ako to uvidia?',
        'Aký konkrétny príklad výsledku viete uviesť?',
      ],
      constraints: ['Chcem príbeh a jasný výsledok.'],
      challengeStyle: 'story',
    },
    closing: {
      tone: 'friendly',
      questionPools: [
        'Čo navrhujete ako ďalší krok a kedy by sme to vedeli spraviť?',
        'Kto ešte by mal byť v diskusii a dokedy?',
      ],
      constraints: ['Dohodnime jasný ďalší krok.'],
      challengeStyle: 'relationship',
    },
  },
  S: {
    intro: {
      tone: 'calm',
      questionPools: [
        'Povedzte pokojne, čo presne ponúkate a komu.',
        'Aký problém to rieši a čo sa tým zlepší?',
      ],
      constraints: ['Zatiaľ len základné info.'],
      challengeStyle: 'reassure',
    },
    discovery: {
      tone: 'calm',
      questionPools: [
        'Aký je váš hlavný cieľ a čo by sa malo zlepšiť?',
        'Čoho sa obávate, ak to necháte tak?',
      ],
      constraints: ['Chcem rozumieť rizikám.'],
      challengeStyle: 'risk',
    },
    presentation: {
      tone: 'calm',
      questionPools: [
        'V čom je vaše riešenie bezpečnejšie a stabilnejšie?',
        'Aké máte dôkazy, že to funguje bez rizika?',
      ],
      constraints: ['Potrebujem istotu a stabilitu.'],
      challengeStyle: 'safety',
    },
    closing: {
      tone: 'calm',
      questionPools: [
        'Aký bezpečný ďalší krok navrhujete a kedy?',
        'Kto ešte by mal byť v tom a dokedy to viete posunúť?',
      ],
      constraints: ['Preferujem jasný a bezpečný postup.'],
      challengeStyle: 'careful',
    },
  },
  C: {
    intro: {
      tone: 'analytical',
      questionPools: [
        'Zhrňte presne, čo ponúkate a pre koho.',
        'Aký problém riešite a aké sú predpoklady?',
      ],
      constraints: ['Chcem presnosť a fakty.'],
      challengeStyle: 'precision',
    },
    discovery: {
      tone: 'analytical',
      questionPools: [
        'Aký je hlavný cieľ a ako ho budete merať?',
        'Aké sú kľúčové premenné úspechu?',
      ],
      constraints: ['Potrebujem merateľné kritériá.'],
      challengeStyle: 'metrics',
    },
    presentation: {
      tone: 'analytical',
      questionPools: [
        'V čom je vaše riešenie merateľne lepšie?',
        'Aké konkrétne dôkazy a metodiku máte?',
      ],
      constraints: ['Žiadam dôkazy a predpoklady.'],
      challengeStyle: 'evidence',
    },
    closing: {
      tone: 'analytical',
      questionPools: [
        'Aký je ďalší krok, zodpovednosti a termín?',
        'Kto schvaľuje a aké sú podmienky?',
      ],
      constraints: ['Chcem jasné podmienky a termíny.'],
      challengeStyle: 'structure',
    },
  },
};

const DIFFICULTY_MODIFIERS = {
  beginner: {
    addSkepticism: false,
    requireEvidence: false,
    simplifyLanguage: true,
  },
  advanced: {
    addSkepticism: true,
    requireEvidence: true,
    simplifyLanguage: false,
  },
  expert: {
    addSkepticism: true,
    requireEvidence: true,
    simplifyLanguage: false,
  },
};

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
  const scenarioId =
    typeof body.scenario_id === 'string' && body.scenario_id.trim()
      ? body.scenario_id.trim()
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
      scenario_id: scenarioId,
      user_id: userId,
    };

    if (!scenarioId) {
      delete sessionInput.scenario_id;
    }

    if (requestedSessionId) {
      sessionInput.id = requestedSessionId;
    }

    let { data: sessionData, error: sessionError } = await supabase
      .from('sales_voice_sessions')
      .insert([sessionInput])
      .select('id');

    if (sessionError && scenarioId && isMissingColumnError(sessionError, 'scenario_id')) {
      const fallbackInput = { ...sessionInput };
      delete fallbackInput.scenario_id;
      ({ data: sessionData, error: sessionError } = await supabase
        .from('sales_voice_sessions')
        .insert([fallbackInput])
        .select('id'));
    }

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

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703') return true;
  const message = `${error.message || ''}`.toLowerCase();
  return message.includes('column') && message.includes(columnName.toLowerCase());
}

function resolveScenarioById(scenarioId) {
  const normalized = typeof scenarioId === 'string' ? scenarioId.trim() : '';
  if (!normalized) return null;
  return SALES_SCENARIOS.find((scenario) => scenario.id === normalized) || null;
}

function deriveScenarioConstraints(scenario) {
  if (!scenario || typeof scenario !== 'object') return [];
  const explicit = Array.isArray(scenario.constraints)
    ? scenario.constraints.map((constraint) => `${constraint}`.trim()).filter(Boolean)
    : [];
  if (explicit.length) return explicit;

  const description = typeof scenario.description === 'string' ? scenario.description.trim() : '';
  if (!description) return [];

  const sentences = description
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences
    .slice(0, 3)
    .map((sentence) => sentence.replace(/[.!?]+$/, '').trim())
    .filter(Boolean);
}

function buildScenarioContext(scenarioId) {
  const scenario = resolveScenarioById(scenarioId) || DEFAULT_SCENARIO;
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    constraints: deriveScenarioConstraints(scenario),
  };
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

    let { data: existingSessions, error: sessionQueryError } = await supabase
      .from('sales_voice_sessions')
      .select('id,user_id,difficulty,client_type,client_disc_type,scenario_id')
      .eq('id', sessionIdValue)
      .eq('user_id', userId)
      .limit(1);

    if (sessionQueryError && isMissingColumnError(sessionQueryError, 'scenario_id')) {
      ({ data: existingSessions, error: sessionQueryError } = await supabase
        .from('sales_voice_sessions')
        .select('id,user_id,difficulty,client_type,client_disc_type')
        .eq('id', sessionIdValue)
        .eq('user_id', userId)
        .limit(1));
    }

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

    const stage = resolveStage(salesmanCount);

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[sales] reply stage=${stage} disc=${session.client_disc_type || 'unknown'} salesmanCount=${salesmanCount}`
      );
    }

    const scenarioContext = buildScenarioContext(session.scenario_id);

    const clientReplyText = await generateClientReply({
      latestMessage: contentValue,
      stage,
      difficulty: session.difficulty,
      clientType: session.client_type,
      clientDiscType: session.client_disc_type,
      salesmanCount,
      scenarioContext,
    });

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

function resolveStage(salesmanCount) {
  if (salesmanCount === 1) return 'intro';
  if (salesmanCount <= 3) return 'discovery';
  if (salesmanCount <= 5) return 'presentation';
  return 'closing';
}

async function generateClientReply({
  latestMessage,
  stage,
  difficulty,
  clientType,
  clientDiscType,
  salesmanCount,
  scenarioContext,
}) {
  const resolvedScenarioContext = scenarioContext || buildScenarioContext();
  const inputType = classifySalesmanInput(latestMessage);
  const replyMode = resolveReplyMode({
    inputType,
    stage,
    difficulty,
    discType: clientDiscType,
    clientType,
  });
  const maxQuestions = resolveMaxQuestions({ replyMode });

  const triggers = detectTriggers(latestMessage, stage);
  const plan = buildReplyPlan({
    latestMessage,
    stage,
    difficulty,
    clientType,
    clientDiscType,
    salesmanCount,
    triggers,
    maxQuestions,
    inputType,
    scenarioContext: resolvedScenarioContext,
  });
  plan.replyMode = replyMode;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[sales-api] reply plan', {
      stage: plan.stage,
      clientType: plan.clientType,
      discUsed: plan.discUsed,
      tone: plan.tone,
      scenario: plan.scenarioContext?.id || 'unknown',
      questions: plan.questions.length,
      triggers,
      inputType,
      replyMode,
      maxQuestions,
    });
  }

  const rendered = await renderPlanWithLLM(plan, latestMessage, maxQuestions, replyMode);
  if (rendered) {
    return enforceMaxLength(rendered, 400);
  }
  return enforceMaxLength(renderPlanFallback(plan, replyMode), 400);
}

function normalizeDifficulty(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'intermediate') return 'advanced';
  if (ALLOWED_DIFFICULTIES.has(normalized)) return normalized;
  return 'beginner';
}

function normalizeClientType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (ALLOWED_CLIENT_TYPES.has(normalized)) return normalized;
  return 'new';
}

function normalizeDisc(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (ALLOWED_CLIENT_DISC_TYPES.has(normalized)) return normalized;
  return 'D';
}

function classifySalesmanInput(text) {
  const message = typeof text === 'string' ? text.trim() : '';
  const lower = message.toLowerCase();
  if (!lower) return 'other_statement';
  const questionWordPattern = /^(kto|čo|co|kedy|kde|prečo|preco|ako|koľko|kolko)\b/i;
  if (message.includes('?') || questionWordPattern.test(lower)) {
    return 'question';
  }

  const greetings = [
    'ahoj',
    'dobrý deň',
    'dobry den',
    'dobré ráno',
    'dobre rano',
    'dobrý večer',
    'tesi ma',
    'teší ma',
  ];
  const thanks = ['ďakujem', 'dakujem', 'vďaka', 'vdaka'];
  const howAreYou = [
    'ako sa máte',
    'ako sa mas',
    'ako sa máš',
    'ako sa dari',
    'ako sa darí',
    'ako ide',
    'ako to ide',
  ];
  const pleasantries = ['super', 'fajn', 'ok', 'dobre', 'výborne', 'pekne'];

  const isGreetingMatch =
    greetings.some((greeting) => lower.includes(greeting)) ||
    /(dobry|dobrý)\s+de[nň]/.test(lower) ||
    /(dobre|dobré)\s+r[aá]no/.test(lower);
  const isThanksMatch = thanks.some((thanksItem) => lower.includes(thanksItem));
  const isHowAreYouMatch = howAreYou.some((item) => lower.includes(item));
  const isPleasantryMatch = pleasantries.some((item) => lower.includes(item));

  if (isGreetingMatch || isThanksMatch || isHowAreYouMatch || isPleasantryMatch) {
    return 'greeting_smalltalk';
  }

  const agendaPattern =
    /(chcem sa porozpr[aá]vať|chcel by som sa porozpr[aá]vať|chcela by som sa porozpr[aá]vať|r[aá]d by som prebral|rad by som prebral|r[aá]d by sme prebrali|dnes by som chcel|dnes by som chcela|dnes by sme chceli|chcem prebrať|chcel by som prebrať|chcela by som prebrať)/i;
  if (agendaPattern.test(lower)) {
    return 'agenda_statement';
  }

  const closingPattern =
    /(ďalší krok|dalsi krok|navrhujem|dohodnime|stretnutie|m[oô]žeme sa stretn[uú]ť|uzavrime|uzavrieme|podp[ií]sme|term[ií]n|kedy m[oô]žeme|kedy by v[aá]m vyhovovalo)/i;
  if (closingPattern.test(lower)) {
    return 'closing_statement';
  }

  const pitchPattern =
    /(naše riešenie|pon[úu]kame|produkt|slu[zž]ba|platforma|funkcia|bal[ií]k|cenn[ií]k|cena|implement[aá]cia|v[ií]hoda|benefit|feature|modul)/i;
  if (pitchPattern.test(lower)) {
    return 'pitch_statement';
  }

  return 'other_statement';
}

function resolveReplyMode({ inputType, stage, difficulty, discType, clientType }) {
  const normalizedStage = STAGES.includes(stage) ? stage : 'intro';
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const normalizedDisc = normalizeDisc(discType);
  const normalizedClientType = normalizeClientType(clientType);

  let replyMode = 'statement_then_question';

  if (inputType === 'question') {
    replyMode = 'statement_only';
    if (
      normalizedStage === 'discovery' &&
      normalizedDifficulty === 'expert' &&
      normalizedDisc === 'C'
    ) {
      replyMode = 'statement_then_question';
    }
  } else if (inputType === 'greeting_smalltalk') {
    replyMode = 'statement_then_question';
  } else if (inputType === 'agenda_statement') {
    replyMode = 'statement_only';
  } else if (inputType === 'pitch_statement') {
    if (normalizedStage === 'intro' || normalizedStage === 'discovery') {
      replyMode = 'statement_then_question';
    } else {
      replyMode = 'statement_only';
    }
  } else if (inputType === 'closing_statement') {
    replyMode = 'statement_only';
  } else {
    replyMode = normalizedStage === 'intro' || normalizedStage === 'discovery'
      ? 'statement_then_question'
      : 'statement_only';
  }

  if (normalizedDisc === 'D' && normalizedDifficulty === 'expert') {
    if (replyMode === 'question_only') {
      replyMode = 'statement_only';
    }
    if (replyMode === 'statement_then_question' && normalizedStage !== 'discovery') {
      replyMode = 'statement_only';
    }
  }

  if (normalizedClientType === 'repeat' && replyMode === 'statement_then_question') {
    if (normalizedStage === 'presentation') {
      replyMode = 'statement_only';
    }
  }

  return replyMode;
}

function resolveMaxQuestions({ replyMode }) {
  if (replyMode === 'statement_only') return 0;
  if (replyMode === 'statement_then_question') return 1;
  return 1;
}

function buildSmallTalkPlan({ stage, salesmanCount }) {
  const normalizedStage = STAGES.includes(stage) ? stage : 'intro';
  const templates = {
    intro: [
      'Dobre, ďakujem. Môžeme prejsť k vašej potrebe?',
      'Ďakujem, mám sa dobre. Čo dnes riešime?',
      'Teší ma. Povedzte stručne, s čím prichádzate.',
    ],
    discovery: [
      'Dobre, ďakujem. Môžeme prejsť k vašej potrebe?',
      'Ďakujem, mám sa dobre. Čo je teraz najdôležitejšie?',
      'Teší ma. Povedzte stručne, s čím prichádzate.',
    ],
    presentation: [
      'Mám sa dobre. Čo presne ponúkate a v čom je prínos?',
      'Ďakujem, mám sa dobre. V čom je to pre mňa výhodné?',
      'Dobre, ďakujem. Čo je najväčší prínos vášho riešenia?',
    ],
    closing: [
      'Ďakujem, mám sa dobre. Aký je ďalší krok?',
      'Dobre, ďakujem. Ako by sme to uzavreli?',
      'Teší ma. Čo navrhujete ako ďalší krok?',
    ],
  };

  const pool = templates[normalizedStage] || templates.intro;
  const index = Math.abs(salesmanCount || 0) % pool.length;
  const template = pool[index];
  const match = template.match(/^(.*?)([^?]*\?)\s*$/);
  if (match) {
    return {
      reaction: match[1].trim() || 'Ďakujem.',
      questions: [match[2].trim()],
    };
  }
  return {
    reaction: template.trim(),
    questions: [],
  };
}

/**
 * @typedef {Object} ReplyPlan
 * @property {"sk"} language
 * @property {"intro"|"discovery"|"presentation"|"closing"} stage
 * @property {"new"|"repeat"} clientType
 * @property {"neutral"|"D"|"I"|"S"|"C"} discUsed
 * @property {"direct"|"friendly"|"calm"|"analytical"} tone
 * @property {string} goal
 * @property {string[]} constraints
 * @property {string[]} questions
 * @property {string} reaction
 * @property {"agree"|"postpone"|"decline"} [nextStepType]
 * @property {{id: string, title: string, description: string, constraints: string[]}} scenarioContext
 */

function buildReplyPlan({
  latestMessage,
  stage,
  difficulty,
  clientType,
  clientDiscType,
  salesmanCount,
  triggers,
  maxQuestions,
  inputType,
  scenarioContext,
}) {
  const normalizedStage = STAGES.includes(stage) ? stage : 'intro';
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const normalizedClientType = normalizeClientType(clientType);
  const base = BASE_BY_STAGE[normalizedStage];
  const resolvedTriggers = triggers || detectTriggers(latestMessage, normalizedStage);
  const difficultyModifiers = DIFFICULTY_MODIFIERS[normalizedDifficulty];

  if (inputType === 'greeting_smalltalk') {
    const smallTalk = buildSmallTalkPlan({ stage: normalizedStage, salesmanCount });
    const reaction = smallTalk.reaction || base.defaultReaction;
    return {
      language: 'sk',
      stage: normalizedStage,
      clientType: normalizedClientType,
      discUsed: 'neutral',
      tone: 'friendly',
      goal: base.goal,
      constraints: [],
      scenarioContext,
      questions: smallTalk.questions.slice(0, maxQuestions),
      reaction,
    };
  }

  let ruleSet;
  let discUsed = 'neutral';
  if (normalizedClientType === 'new') {
    ruleSet = NEW_BY_STAGE[normalizedStage];
  } else {
    let resolvedDisc = normalizeDisc(clientDiscType);
    if (!clientDiscType && process.env.NODE_ENV !== 'production') {
      console.log('[sales-api] missing disc type, defaulting to D');
    }
    if (!DISC_TYPES.includes(resolvedDisc)) {
      resolvedDisc = 'D';
    }
    discUsed = resolvedDisc;
    ruleSet = REPEAT_BY_DISC_STAGE[resolvedDisc][normalizedStage];
  }

  const questions = selectQuestions({
    stage: normalizedStage,
    difficulty: normalizedDifficulty,
    questionPool: ruleSet.questionPools,
    salesmanCount,
    maxQuestions,
  });

  const constraints = [...ruleSet.constraints];
  if (difficultyModifiers.requireEvidence && normalizedStage === 'presentation') {
    constraints.push('Bez konkrétnych metrík to nepovažujem za overené.');
  }
  if (difficultyModifiers.addSkepticism && normalizedStage === 'discovery') {
    constraints.push('Potrebujem to podložiť konkrétnymi faktami.');
  }

  let plan = {
    language: 'sk',
    stage: normalizedStage,
    clientType: normalizedClientType,
    discUsed,
    tone: ruleSet.tone,
    goal: base.goal,
    constraints,
    scenarioContext,
    questions,
    reaction: base.defaultReaction,
  };

  plan = applyTriggers(plan, resolvedTriggers);

  if (plan.stage === 'intro') {
    plan.constraints = [];
  }

  if (plan.stage === 'closing') {
    plan.nextStepType = resolveNextStepType(resolvedTriggers);
  }

  const resolvedMaxQuestions = typeof maxQuestions === 'number' ? maxQuestions : base.maxQuestions;
  plan.questions = plan.questions.slice(0, resolvedMaxQuestions);
  return plan;
}

function selectQuestions({ stage, difficulty, questionPool, salesmanCount, maxQuestions }) {
  const fallbackMax = BASE_BY_STAGE[stage]?.maxQuestions ?? 1;
  const resolvedMaxQuestions = typeof maxQuestions === 'number' ? maxQuestions : fallbackMax;
  const pickIndex = Math.abs(salesmanCount || 0) % questionPool.length;
  const primary = questionPool[pickIndex];

  if (stage === 'discovery') {
    if (difficulty === 'beginner') {
      return [primary];
    }
    const secondary = questionPool[(pickIndex + 1) % questionPool.length];
    return [primary, secondary].slice(0, resolvedMaxQuestions);
  }

  return [primary].slice(0, resolvedMaxQuestions);
}

function detectTriggers(latestMessage, stage) {
  const message = typeof latestMessage === 'string' ? latestMessage.trim() : '';
  const lower = message.toLowerCase();
  const hasNumbers = /\d/.test(message);
  const hasExample = lower.includes('príklad') || lower.includes('napr') || lower.includes('napríklad');
  const tooVague = message.length < 60 || (!hasNumbers && !hasExample);
  const askedGoodQuestion =
    /(\bčo\b|\bako\b|\bprečo\b|\bkoľko\b|\bkedy\b)/i.test(lower) && message.endsWith('?');
  const proposedNextStep = /(navrhujem|ďalší krok|kedy môžeme|dohodnime|stretnutie)/i.test(lower);
  const jumpedToPitch =
    (stage === 'intro' || stage === 'discovery') &&
    /(naše riešenie|platforma|implementácia|funkcia|balík|cenník|cena|pitch)/i.test(lower);

  return {
    tooVague,
    askedGoodQuestion,
    proposedNextStep,
    jumpedToPitch,
  };
}

function applyTriggers(plan, triggers) {
  const nextPlan = { ...plan };
  const constraintSet = new Set(nextPlan.constraints);

  if (triggers.tooVague) {
    constraintSet.add('Potrebujem konkrétnejšie údaje, nie všeobecné tvrdenia.');
  }
  if (triggers.jumpedToPitch) {
    constraintSet.add('Zatiaľ sa držme potrieb, nie riešenia.');
  }
  if (triggers.askedGoodQuestion) {
    nextPlan.reaction = 'Dobrá otázka, vďaka.';
  }

  nextPlan.constraints = Array.from(constraintSet);
  return nextPlan;
}

function resolveNextStepType(triggers) {
  if (triggers.proposedNextStep) return 'agree';
  if (triggers.tooVague || triggers.jumpedToPitch) return 'postpone';
  return 'agree';
}

async function renderPlanWithLLM(plan, latestMessage, maxQuestions) {
  try {
    const llm = createLLMClient();
    const systemPrompt = `Si biznis klient v obchodnom rozhovore. Tvojou úlohou je len zrenderovať ReplyPlan do prirodzenej, stručnej slovenčiny. Nepridávaj nové body.`;
    const scenarioContext = plan?.scenarioContext;
    const scenarioTitle = scenarioContext?.title || DEFAULT_SCENARIO.title;
    const scenarioConstraints = Array.isArray(scenarioContext?.constraints)
      ? scenarioContext.constraints.filter(Boolean)
      : [];
    const scenarioConstraintLines = scenarioConstraints.length
      ? scenarioConstraints.map((constraint) => `- ${constraint}`)
      : ['- -'];
    const scenarioBlock = `Scenario context:
TITLE: ${scenarioTitle}
CONSTRAINTS:
${scenarioConstraintLines.join('\n')}`;

    const developerPrompt = `ReplyPlan (JSON): ${JSON.stringify(plan)}
${scenarioBlock}
Reply mode: ${plan.replyMode}
Max počet otázok: ${maxQuestions}
Pravidlá:
- Odpoveď musí byť po slovensky.
- Drž sa otázok, reakcie, constraints a nextStepType.
- Obsah odpovede musí byť vecne viazaný na Scenario context.
- Žiadne školenie obchodníka ani meta poznámky.
- Odpoveď má mať max 60 slov.
- Použi presne tento formát, každý riadok na nový riadok:
REAKCIA: <1-2 krátke vety>
OTÁZKA: <0-${maxQuestions} otázky; ak 0, napíš "-">
- Ak replyMode = statement_only: OTÁZKA musí byť "-".
- Ak replyMode = statement_then_question: OTÁZKA môže byť 1 otázka alebo "-".
- Ak replyMode = question_only: OTÁZKA musí byť presne 1 otázka; REAKCIA môže byť krátka alebo "-".
- Ak sú 2 otázky, oddeľ ich " | ".
- Nikdy neprekroč maxQuestions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'developer', content: developerPrompt },
      { role: 'user', content: latestMessage },
    ];

    let buffer = '';
    let chunks = 0;
    const maxChunks = 200;
    for await (const chunk of llm.streamChat({ messages })) {
      chunks += 1;
      if (chunk.type === 'token' && chunk.content) {
        buffer += chunk.content;
      }
      if (chunk.type === 'final') {
        buffer = chunk.content || buffer;
        break;
      }
      if (chunks >= maxChunks) {
        break;
      }
    }

    const finalReply = typeof buffer === 'string' ? buffer.trim() : '';
    if (!finalReply) return null;
    const normalized = normalizeClientReply(finalReply, { replyMode: plan.replyMode, maxQuestions });
    return normalized || null;
  } catch (error) {
    console.error('[sales-api] llm render failed', error);
    return null;
  }
}

function normalizeClientReply(rawReply, { replyMode, maxQuestions }) {
  const lines = rawReply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const reactionLine = lines.find((line) => line.toUpperCase().startsWith('REAKCIA:'));
  const questionLine = lines.find((line) => line.toUpperCase().startsWith('OTÁZKA:'));

  if (!reactionLine || !questionLine) {
    return null;
  }

  const reaction = reactionLine.split(':').slice(1).join(':').trim();
  const questionContent = questionLine.split(':').slice(1).join(':').trim();
  const rebuiltQuestions = rebuildQuestions(questionContent, { replyMode, maxQuestions });
  if (!rebuiltQuestions) {
    return null;
  }

  const normalizedReaction = normalizeReaction(reaction, replyMode);
  if (replyMode === 'question_only' && rebuiltQuestions === '-') {
    return null;
  }

  return `REAKCIA: ${normalizedReaction}\nOTÁZKA: ${rebuiltQuestions}`;
}

function normalizeReaction(reaction, replyMode) {
  const trimmed = typeof reaction === 'string' ? reaction.trim() : '';
  if (replyMode === 'question_only') {
    return trimmed && trimmed !== '-' ? trimmed : '-';
  }
  return trimmed || '-';
}

function rebuildQuestions(questionContent, { replyMode, maxQuestions }) {
  if (replyMode === 'statement_only' || maxQuestions === 0) {
    return '-';
  }

  if (questionContent === '-') {
    return replyMode === 'question_only' ? null : '-';
  }

  const questionMatches = questionContent.match(/[^?]+\?/g);
  let questions = [];
  if (questionMatches && questionMatches.length) {
    questions = questionMatches.map((question) => question.trim());
  } else if (questionContent) {
    const rawSegments = questionContent.split('|').map((segment) => segment.trim());
    questions = rawSegments.filter(Boolean).map((segment) =>
      segment.endsWith('?') ? segment : `${segment}?`
    );
  }

  const limit = replyMode === 'statement_then_question' ? 1 : Math.max(1, maxQuestions);
  const limited = questions.slice(0, limit);
  if (!limited.length) {
    return replyMode === 'question_only' ? null : '-';
  }

  return limited.join(' | ');
}

function renderPlanFallback(plan, replyMode) {
  const reactionParts = [];
  if (plan.reaction) {
    reactionParts.push(plan.reaction);
  }
  if (plan.constraints.length) {
    reactionParts.push(plan.constraints[0]);
  }

  if (plan.stage === 'closing') {
    reactionParts.push(resolveClosingEnding(plan));
  }

  const reaction = reactionParts.join(' ').trim() || '-';
  let question = '-';
  if (replyMode !== 'statement_only' && plan.questions.length) {
    question = plan.questions[0];
  }

  return `REAKCIA: ${normalizeReaction(reaction, replyMode)}\nOTÁZKA: ${question || '-'}`;
}

function resolveClosingEnding(plan) {
  const endings = {
    agree: 'Navrhujem ďalší krok: krátke potvrdenie a termín do 7 dní.',
    postpone: 'Zatiaľ to nechajme otvorené, pošlite mi doplnenia a vráťme sa k tomu do 2 týždňov.',
    decline: 'Momentálne do toho nepôjdem, ďakujem za čas.',
  };
  return endings[plan.nextStepType] || endings.agree;
}

function enforceMaxLength(text, limit) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const sliced = trimmed.slice(0, limit);
  const lastStop = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('!'), sliced.lastIndexOf('?'));
  if (lastStop > 50) {
    return sliced.slice(0, lastStop + 1).trim();
  }
  return sliced.trim();
}
