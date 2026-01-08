const { createUserSupabaseClient, getSupabaseEnvError } = require('./lib/supabaseClient');
const { createLLMClient } = require('./lib/llmClient');
const { getJsonBody, getClientIp } = require('./lib/requestUtils');
const { rateLimit } = require('./lib/rateLimit');

const MAX_CONTENT_LENGTH = 1000;
const MAX_ID_LENGTH = 128;
const MAX_SCENARIO_KEY_LENGTH = 128;
const HISTORY_LIMIT = 12;
const SCENARIO_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_DIFFICULTIES = new Set(['beginner', 'advanced', 'expert']);
const ALLOWED_CLIENT_TYPES = new Set(['new', 'repeat']);
const ALLOWED_CLIENT_DISC_TYPES = new Set(['D', 'I', 'S', 'C']);
const ALLOWED_MODULES = new Set(['obchodny_rozhovor']);
const SESSION_OWNER_COLUMN = 'user_id';
let missingSupabaseEnvLogged = false;
const STAGES = ['intro', 'discovery', 'presentation', 'closing'];
const DISC_TYPES = ['D', 'I', 'S', 'C'];
const CLIENT_TYPES = ['new', 'repeat'];
const HISTORY_MESSAGE_LIMIT = 600;

const SCENARIOS = {
  crm_small_business_first_buy: {
    title: 'CRM pre malé firmy — prvý nákup',
    summary: 'Majiteľ malej firmy chce zjednodušiť evidenciu a vidieť rýchlu návratnosť.',
    details:
      'Stretnutie s majiteľom malej firmy, ktorý eviduje zákazníkov v tabuľkách. Zaujíma ho jednoduché zavedenie a rýchly prínos pre obchodný tím. Rozpočet je obmedzený a chce vidieť jasnú návratnosť. Má obavy z migrácie dát a času na zaškolenie.',
    constraints: [
      'Rozpočet je obmedzený.',
      'Chce rýchle nasadenie do 4 týždňov.',
      'Obáva sa migrácie dát a školenia.',
    ],
  },
  crm_repeat_sale_expansion: {
    title: 'CRM rozšírenie — opakovaný predaj',
    summary: 'Spokojný klient chce rozšíriť licencie a nové moduly, ale očakáva merateľné prínosy.',
    details:
      'Klient používa CRM už rok a teraz rieši rozšírenie o marketingovú automatizáciu. Je spokojný s podporou, ale potrebuje preukázateľné zvýšenie konverzií. Do rozhodovania vstupuje finančný riaditeľ a tlačí na KPI. Očakáva jasný plán rolloutov bez výpadkov.',
    constraints: [
      'Kľúčové sú merateľné KPI a konverzie.',
      'Rozhodovanie ovplyvňuje finančný riaditeľ.',
      'Rozšírenie nesmie spôsobiť výpadky.',
    ],
  },
  pricing_pushback_procurement: {
    title: 'Nákupné oddelenie — tlak na cenu',
    summary: 'Nákup je citlivý na cenu, vyžaduje porovnanie a tvrdé vyjednávanie.',
    details:
      'Na stretnutí je zástupca nákupu, ktorý tlačí na zľavy a porovnanie s konkurenciou. Potrebujú jasnú hodnotu, SLA a transparentné podmienky. V hre je viac dodávateľov, rozhodovanie môže trvať. Očakávajú prísne dodržanie procesu schvaľovania.',
    constraints: [
      'Zľavy musia byť odôvodnené hodnotou.',
      'Vyžadujú SLA a transparentné podmienky.',
      'Rozhodnutie ide cez formálne schvaľovanie.',
    ],
  },
};

const DEFAULT_SCENARIO_KEY = 'crm_small_business_first_buy';
const DEFAULT_SCENARIO = SCENARIOS[DEFAULT_SCENARIO_KEY];

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

const ANSWER_SEEDS = {
  crm_small_business_first_buy: {
    byStage: {
      intro: {
        new: 'Zatiaľ len hľadám spôsob, ako prestať evidovať klientov v tabuľkách a mať rýchly prehľad.',
        repeat: 'Už máme základnú evidenciu, ale potrebujem rýchlejší prehľad bez manuálu.',
        default: 'Chceme mať jednoduchší prehľad o klientoch a menej ručnej práce.',
      },
      discovery: {
        new: 'Najviac nás brzdí, že sa strácajú leady a obchodníci reagujú neskoro.',
        repeat: 'Pri súčasnom procese máme výpadky vo follow-upe a chcem to zjednodušiť.',
        default: 'Potrebujeme zlepšiť follow-up a nechať zmiznúť manuálne kroky.',
      },
      presentation: {
        new: 'Ak to viete nasadiť do 4 týždňov a pomôcť s migráciou, je to pre nás hodnotné.',
        repeat: 'Keď zachováte naše dáta a zaučíte tím bez výpadkov, viem si obhájiť rozpočet.',
        default: 'Potrebujem rýchle nasadenie a bezpečnú migráciu bez výpadkov.',
      },
      closing: {
        new: 'Ak dostanem jasný plán nasadenia a podporu pri migrácii, vieme ísť do ďalšieho kroku.',
        repeat: 'Keď máme potvrdený plán rolloutov a podporu, posuniem to k rozhodnutiu.',
        default: 'Ak si potvrdíme plán a podporu, viem to posunúť ďalej.',
      },
    },
    focus: {
      kpi: {
        byClient: {
          new: 'Chcel by som sledovať počet nových leadov, konverziu na obchod a čas reakcie obchodníka.',
          repeat: 'Sledujeme hlavne konverziu, čas reakcie tímu a objem uzavretých obchodov.',
        },
        byStage: {
          intro: 'Zatiaľ je to orientačný zoznam, nech máme jasný smer.',
          discovery: 'Podľa toho si nastavíme procesy a reporting.',
          presentation: 'Potrebujem to vidieť v konkrétnych číslach a reporte.',
          closing: 'Ak sa na tom zhodneme, vieme to dať do dohody.',
        },
      },
      budget: {
        byClient: {
          new: 'Rozpočet máme limitovaný, potrebujem jasne vidieť návratnosť.',
          repeat: 'Rozpočet je pevný, takže musím obhájiť každé euro navyše.',
        },
        byStage: {
          intro: 'Zatiaľ len mapujem, či to vôbec dáva finančný zmysel.',
          discovery: 'Potrebujem vedieť, kde ušetríme čas alebo zvýšime obrat.',
          presentation: 'Bez jasnej ROI do toho nepôjdeme.',
          closing: 'Ak to sedí v rozpočte, vieme ísť do schvaľovania.',
        },
      },
      implementation: {
        byClient: {
          new: 'Ideálne do 4 týždňov, s jasným plánom migrácie a školenia.',
          repeat: 'Chceme rollout bez výpadkov a rýchle zaškolenie tímu.',
        },
        byStage: {
          intro: 'Potrebujem vedieť, či je to reálne stihnuteľné.',
          discovery: 'Čas nasadenia je pre nás kľúčový.',
          presentation: 'Očakávam konkrétny harmonogram a zodpovednosti.',
          closing: 'Ak to viete garantovať, vieme dohodnúť termín.',
        },
      },
      risk: {
        byClient: {
          new: 'Najviac sa obávam migrácie dát a času na zaškolenie.',
          repeat: 'Rizikom je pre nás výpadok a strata kvality dát.',
        },
        byStage: {
          intro: 'Potrebujem uistiť, že to bude bez chaosu.',
          discovery: 'Chcem mať istotu, že riziká sú ošetrené.',
          presentation: 'Potrebujem vidieť, ako minimalizujete riziká.',
          closing: 'Ak máte jasný plán mitigácie, viem to posunúť ďalej.',
        },
      },
    },
  },
  crm_repeat_sale_expansion: {
    byStage: {
      intro: {
        new: 'Zatiaľ len zvažujeme rozšírenie CRM o marketing a chcem vidieť potenciál konverzií.',
        repeat: 'CRM používame rok a teraz riešime rozšírenie o marketingovú automatizáciu.',
        default: 'Zvažujeme rozšírenie CRM o marketing s jasným prínosom.',
      },
      discovery: {
        new: 'Potrebujem vidieť, ako to zvýši konverzie a zapojí tím.',
        repeat: 'Očakávame merateľný nárast konverzií a jasný plán rolloutov bez výpadkov.',
        default: 'Potrebujeme merateľný nárast konverzií a bezpečný rollout.',
      },
      presentation: {
        new: 'Ak viete ukázať čísla z podobných nasadení, bude to pre nás zaujímavé.',
        repeat: 'Finančný riaditeľ chce KPI a ja potrebujem dôkaz, že konverzie pôjdu hore.',
        default: 'Potrebujem dôkazy o dopade na konverzie.',
      },
      closing: {
        new: 'Ak dohodneme KPI a harmonogram bez výpadkov, posuniem to ďalej.',
        repeat: 'Keď dostaneme záväzný plán rolloutov a KPI reporting, viem to obhájiť aj u CFO.',
        default: 'Ak si zafixujeme KPI a plán, viem to posunúť ďalej.',
      },
    },
    focus: {
      kpi: {
        byClient: {
          new: 'Chcem sledovať nárast konverzií z leadu na obchod, ROI kampaní a adopciu tímu.',
          repeat: 'Sledujeme konverzie, ROI kampaní a mieru využívania nových modulov.',
        },
        byStage: {
          intro: 'Zatiaľ si to len rámcovo nastavujeme.',
          discovery: 'Podľa toho budeme hodnotiť úspech.',
          presentation: 'Potrebujem k tomu konkrétne čísla a benchmark.',
          closing: 'Ak na tom bude reporting, viem to uzavrieť.',
        },
      },
      budget: {
        byClient: {
          new: 'Rozpočet musí byť krytý návratnosťou, inak to neprejde.',
          repeat: 'Bez jasnej ROI to finančný riaditeľ neschváli.',
        },
        byStage: {
          intro: 'Potrebujem vedieť, či to vôbec zapadá do rozpočtu.',
          discovery: 'Chcem vidieť prínos oproti nákladom.',
          presentation: 'Potrebujem jasnú návratnosť v číslach.',
          closing: 'Ak to sedí, vieme ísť do schvaľovania.',
        },
      },
      implementation: {
        byClient: {
          new: 'Potrebujeme rollout bez výpadkov a jasný harmonogram.',
          repeat: 'Chceme to nasadiť bez výpadkov a bez chaosu pre tím.',
        },
        byStage: {
          intro: 'Zaujíma ma, či to viete zvládnuť bez výpadkov.',
          discovery: 'Čas a plynulosť rolloutov sú kľúčové.',
          presentation: 'Potrebujem konkrétny rollout plán.',
          closing: 'Ak to máte pokryté, vieme ísť ďalej.',
        },
      },
      risk: {
        byClient: {
          new: 'Najväčšie riziko je výpadok počas rolloutov.',
          repeat: 'Riziko vidím vo výpadkoch a v zhoršení konverzií.',
        },
        byStage: {
          intro: 'Potrebujem istotu, že to nebude brzdiť tím.',
          discovery: 'Chcem vedieť, ako riziká ošetríte.',
          presentation: 'Potrebujem jasný plán mitigácie.',
          closing: 'Ak to viete garantovať, posúvam to ďalej.',
        },
      },
    },
  },
  pricing_pushback_procurement: {
    byStage: {
      intro: {
        new: 'Sme z nákupu a teraz porovnávame viacerých dodávateľov, takže je pre nás dôležitá hodnota vs. cena.',
        repeat: 'Dodávateľa poznáme, ale teraz tlačíme na cenu a transparentné podmienky.',
        default: 'Porovnávame ponuky a tlačíme na hodnotu za cenu.',
      },
      discovery: {
        new: 'Potrebujem mať jasné SLA, porovnateľnú cenu a proces schvaľovania.',
        repeat: 'Nákup potrebuje transparentné podmienky a obhájiteľnú cenu v schvaľovaní.',
        default: 'Potrebujeme jasné SLA a obhájiteľnú cenu.',
      },
      presentation: {
        new: 'Ak viete ukázať hodnotu a SLA oproti konkurencii, môžeme pokračovať.',
        repeat: 'Bez jasných SLA a argumentov k hodnote zľavu neobhájim.',
        default: 'Potrebujem jasné SLA a hodnotu oproti konkurencii.',
      },
      closing: {
        new: 'Ak dodáte porovnateľnú ponuku a podmienky, spustíme formálne schválenie.',
        repeat: 'Keď dostaneme finálnu ponuku so SLA a cenou, posuniem to do schvaľovania.',
        default: 'Ak dostaneme finálnu ponuku, vieme ísť do schvaľovania.',
      },
    },
    focus: {
      kpi: {
        byClient: {
          new: 'Sledujeme hlavne celkovú cenu, SLA dostupnosť a čas plnenia služieb.',
          repeat: 'Kľúčové sú celkové náklady, SLA a splnenie procesných podmienok.',
        },
        byStage: {
          intro: 'Chcem mať jasné porovnateľné metriky.',
          discovery: 'Podľa toho vieme porovnávať dodávateľov.',
          presentation: 'Potrebujem presné čísla a SLA report.',
          closing: 'Ak to splníte, vieme to schváliť.',
        },
      },
      budget: {
        byClient: {
          new: 'Cena je pre nás citlivá a potrebujeme transparentnú štruktúru.',
          repeat: 'Rozhoduje cena a obhájiteľná hodnota.',
        },
        byStage: {
          intro: 'Potrebujem vedieť, či sme v cenovom rámci.',
          discovery: 'Chcem vidieť, čo presne za to dostaneme.',
          presentation: 'Bez jasnej hodnoty zľavu neobhájim.',
          closing: 'Ak to sedí v cene, posúvam to ďalej.',
        },
      },
      implementation: {
        byClient: {
          new: 'Potrebujeme jasný proces zavedenia a SLA bez výpadkov.',
          repeat: 'Proces musí byť transparentný a bez rizika výpadku.',
        },
        byStage: {
          intro: 'Chcem vedieť, či je proces zavedenia štandardný.',
          discovery: 'Dôležité je, aby to sedelo do nášho schvaľovania.',
          presentation: 'Potrebujem jasné kroky a zodpovednosti.',
          closing: 'Ak to máme v procese, vieme to schváliť.',
        },
      },
      risk: {
        byClient: {
          new: 'Rizikom je nedodržanie SLA alebo netransparentné podmienky.',
          repeat: 'Riziko vidím v nejasných podmienkach a SLA.',
        },
        byStage: {
          intro: 'Potrebujem istotu, že sú podmienky jasné.',
          discovery: 'Chcem vidieť, ako SLA garantujete.',
          presentation: 'Potrebujem zmluvné garancie.',
          closing: 'Ak to potvrdíte, vieme to uzavrieť.',
        },
      },
    },
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
  const scenarioKeyInput =
    typeof body.scenario_key === 'string'
      ? body.scenario_key
      : typeof body.scenarioKey === 'string'
        ? body.scenarioKey
        : typeof body.scenario_id === 'string'
          ? body.scenario_id
        : null;
  const scenarioKeyResult = normalizeScenarioKey(scenarioKeyInput);
  if (scenarioKeyResult.error) {
    res.status(400).json({ ok: false, error: 'invalid_scenario_key' });
    return;
  }
  const scenarioKey = scenarioKeyResult.value;
  const topic =
    typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null;
  const industry =
    typeof body.industry === 'string' && body.industry.trim() ? body.industry.trim() : null;
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
        .select('id,user_id,difficulty,client_type,client_disc_type,scenario_key')
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

        const { initialMessage, error: initialMessageError } = await ensureInitialClientMessage({
          supabase,
          sessionId: existingSession.id,
          scenarioKey: existingSession.scenario_key,
          difficulty: existingSession.difficulty,
          clientType: existingSession.client_type,
          clientDiscType: existingSession.client_disc_type,
          topic,
          industry,
        });

        if (initialMessageError) {
          console.error('[sales-api] failed to create initial message', initialMessageError);
          handleSupabaseFailure(
            res,
            initialMessageError,
            'Unable to create initial client message'
          );
          return;
        }

        res.status(200).json({
          ok: true,
          session_id: existingSession.id,
          ...(initialMessage ? { initial_message: initialMessage } : {}),
        });
        return;
      }
    }

    const sessionInput = {
      module: moduleValue,
      difficulty,
      client_type: clientType,
      client_disc_type: clientDiscType,
      scenario_key: scenarioKey,
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

    const { initialMessage, error: initialMessageError } = await ensureInitialClientMessage({
      supabase,
      sessionId,
      scenarioKey,
      difficulty,
      clientType,
      clientDiscType,
      topic,
      industry,
    });

    if (initialMessageError) {
      console.error('[sales-api] failed to create initial message', initialMessageError);
      handleSupabaseFailure(
        res,
        initialMessageError,
        'Unable to create initial client message'
      );
      return;
    }

    res.status(200).json({
      ok: true,
      session_id: sessionId,
      ...(initialMessage ? { initial_message: initialMessage } : {}),
    });
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

function resolveScenario(key) {
  const normalized = typeof key === 'string' ? key.trim() : '';
  if (normalized && SCENARIOS[normalized]) {
    return SCENARIOS[normalized];
  }
  return SCENARIOS[DEFAULT_SCENARIO_KEY];
}

function normalizeScenarioKey(value) {
  if (value === null || value === undefined) {
    return { value: null, error: null };
  }
  if (typeof value !== 'string') {
    return { value: null, error: 'invalid_type' };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null, error: null };
  }
  if (trimmed.length > MAX_SCENARIO_KEY_LENGTH) {
    return { value: null, error: 'too_long' };
  }
  return { value: trimmed, error: null };
}

function buildScenarioSystemMessage(scenario) {
  const resolvedScenario = scenario || SCENARIOS[DEFAULT_SCENARIO_KEY];
  const constraints = Array.isArray(resolvedScenario.constraints)
    ? resolvedScenario.constraints.map((constraint) => `${constraint}`.trim()).filter(Boolean)
    : [];
  const constraintLines = constraints.length ? constraints : ['-'];
  const content = `[SCENARIO_CONTEXT]
title: ${resolvedScenario.title}
summary: ${resolvedScenario.summary}
details: ${resolvedScenario.details}
constraints:
${constraintLines.map((line) => `- ${line}`).join('\n')}
[/SCENARIO_CONTEXT]`;

  return content.length > 1200 ? `${content.slice(0, 1190)}…` : content;
}

function resolveOpeningContext({ scenarioKey, topic, industry }) {
  const resolvedKey =
    typeof scenarioKey === 'string' && scenarioKey.trim() ? scenarioKey.trim() : null;
  const resolvedTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : null;
  const resolvedIndustry =
    typeof industry === 'string' && industry.trim() ? industry.trim() : null;

  if (resolvedKey) {
    return {
      scenarioKey: resolvedKey,
      scenario: resolveScenario(resolvedKey),
      topic: null,
      industry: null,
      source: 'scenario_key',
    };
  }

  if (resolvedTopic || resolvedIndustry) {
    return {
      scenarioKey: null,
      scenario: null,
      topic: resolvedTopic,
      industry: resolvedIndustry,
      source: 'topic_industry',
    };
  }

  return {
    scenarioKey: DEFAULT_SCENARIO_KEY,
    scenario: resolveScenario(DEFAULT_SCENARIO_KEY),
    topic: null,
    industry: null,
    source: 'default',
  };
}

function buildOpeningScenarioContext(context) {
  if (context?.scenario) {
    return buildScenarioSystemMessage(context.scenario);
  }

  const title = context?.topic || 'Neurčený kontext';
  const summaryParts = [];
  if (context?.topic) {
    summaryParts.push(`Téma: ${context.topic}.`);
  }
  if (context?.industry) {
    summaryParts.push(`Odvetvie: ${context.industry}.`);
  }
  const summary = summaryParts.join(' ') || '-';

  const content = `[SCENARIO_CONTEXT]
title: ${title}
summary: ${summary}
details: ${summary}
constraints:
- -
[/SCENARIO_CONTEXT]`;

  return content.length > 1200 ? `${content.slice(0, 1190)}…` : content;
}

function resolveOpeningTone({ clientType, clientDiscType }) {
  const normalizedClientType = normalizeClientType(clientType);
  if (normalizedClientType !== 'repeat') {
    return { tone: 'neutral', disc: 'neutral' };
  }
  const disc = normalizeDisc(clientDiscType);
  const toneByDisc = {
    D: 'direct',
    I: 'friendly',
    S: 'calm',
    C: 'analytical',
  };
  return { tone: toneByDisc[disc] || 'neutral', disc };
}

function buildOpeningFallbackMessage({ context, tone }) {
  const scenarioKey = context?.scenarioKey || DEFAULT_SCENARIO_KEY;
  const scenarioSentenceMap = {
    crm_small_business_first_buy:
      'Sme malá firma, stále evidujeme zákazníkov v tabuľkách a chceme to zjednodušiť.',
    crm_repeat_sale_expansion:
      'CRM už používame a teraz riešime rozšírenie o marketingovú automatizáciu, ale potrebujeme jasný prínos.',
    pricing_pushback_procurement:
      'Sme z nákupu a porovnávame viac dodávateľov, pritom sme citliví na cenu a podmienky.',
  };
  const topicSentence = context?.topic || context?.industry
    ? `Riešime ${context?.topic || 'túto oblasť'}${context?.industry ? ` v odvetví ${context.industry}` : ''}.`
    : null;
  const contextSentence =
    scenarioSentenceMap[scenarioKey] || topicSentence || scenarioSentenceMap[DEFAULT_SCENARIO_KEY];

  const openingByTone = {
    direct: 'Dobrý deň, potrebujem sa v tom posunúť rýchlo.',
    friendly: 'Dobrý deň, teším sa na stretnutie.',
    calm: 'Dobrý deň, chcem to prejsť pokojne.',
    analytical: 'Dobrý deň, rád by som si ujasnil situáciu.',
    neutral: 'Dobrý deň, rád by som to krátko prebral.',
  };
  const questionByTone = {
    direct: 'Môžete mi stručne povedať, ako k tomu pristupujete?',
    friendly: 'Som zvedavý, čo by ste nám navrhli.',
    calm: 'Môžete mi stručne povedať, ako k tomu pristupujete?',
    analytical: 'Aký postup by ste odporučili?',
    neutral: 'Môžete mi stručne povedať, ako k tomu pristupujete?',
  };
  const openingSentence = openingByTone[tone] || openingByTone.neutral;
  const questionSentence = questionByTone[tone] || questionByTone.neutral;

  return `${openingSentence} ${contextSentence} ${questionSentence}`.trim();
}

function isValidOpeningMessage(text) {
  const cleaned = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!cleaned) return false;
  if (/REAKCIA:|OTÁZKA:/i.test(cleaned)) return false;
  const questionCount = (cleaned.match(/\?/g) || []).length;
  if (questionCount > 1) return false;
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 1 || sentences.length > 3) return false;
  return true;
}

async function generateOpeningClientMessage({
  scenarioKey,
  topic,
  industry,
  difficulty,
  clientType,
  clientDiscType,
}) {
  const context = resolveOpeningContext({ scenarioKey, topic, industry });
  const scenarioContext = buildOpeningScenarioContext(context);
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const { tone, disc } = resolveOpeningTone({ clientType, clientDiscType });
  const scenarioKeyLabel =
    context.scenarioKey || (context.topic || context.industry ? 'topic_industry' : DEFAULT_SCENARIO_KEY);

  try {
    const llm = createLLMClient();
    const systemPrompt = 'Si reálny klient na začiatku obchodného stretnutia.';
    const developerPrompt = `Vytvor úvodnú klientsku správu pre začiatok stretnutia.
Požiadavky:
- Slovenčina.
- 1-3 krátke vety.
- Znieť ako skutočný klient na začiatku stretnutia.
- Bez označení typu "REAKCIA:" alebo "OTÁZKA:".
- Maximálne 1 otázka, žiadne zoznamy otázok.
- Prirodzene spomeň kontext a čo chcete dosiahnuť.
- Zakonči neutrálne alebo jednou jednoduchou otázkou.
Kontext:
- scenario_key: ${scenarioKeyLabel}
- klient: ${normalizeClientType(clientType)} (DISC: ${disc})
- náročnosť: ${normalizedDifficulty}
- tón: ${tone}`;

    const messages = [
      { role: 'system', content: scenarioContext },
      { role: 'system', content: systemPrompt },
      { role: 'developer', content: developerPrompt },
      { role: 'user', content: 'Začni rozhovor.' },
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
    const normalized = enforceMaxLength(finalReply, 300);
    if (isValidOpeningMessage(normalized)) {
      return normalized;
    }
  } catch (error) {
    console.error('[sales-api] opening message render failed', error);
  }

  return enforceMaxLength(buildOpeningFallbackMessage({ context, tone }), 300);
}

async function ensureInitialClientMessage({
  supabase,
  sessionId,
  scenarioKey,
  difficulty,
  clientType,
  clientDiscType,
  topic,
  industry,
}) {
  const { count, error: messageCountError } = await supabase
    .from('sales_voice_messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (messageCountError) {
    return { initialMessage: null, error: messageCountError };
  }

  if (count && count > 0) {
    return { initialMessage: null, error: null };
  }

  const openingMessage = await generateOpeningClientMessage({
    scenarioKey,
    topic,
    industry,
    difficulty,
    clientType,
    clientDiscType,
  });

  const { error: insertError } = await supabase
    .from('sales_voice_messages')
    .insert([{ session_id: sessionId, role: 'client', content: openingMessage }]);

  if (insertError) {
    return { initialMessage: null, error: insertError };
  }

  return {
    initialMessage: { role: 'client', content: openingMessage },
    error: null,
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

  const allowedRoles = ['salesman', 'client'];
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
      .select('id,user_id,difficulty,client_type,client_disc_type,scenario_key')
      .eq('id', sessionIdValue)
      .eq('user_id', userId)
      .limit(1);

    if (sessionQueryError) {
      if (isMissingColumnError(sessionQueryError, 'scenario_key')) {
        console.error(
          '[sales-api] missing scenario_key column on session query',
          sessionQueryError
        );
        res.status(500).json({ ok: false, error: 'missing_column', details: 'scenario_key' });
        return;
      }
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

    let llmHistory = [];
    const { data: historyRows, error: historyError } = await supabase
      .from('sales_voice_messages')
      .select('id,role,content,created_at')
      .eq('session_id', sessionIdValue)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (historyError) {
      console.error('[sales-api] failed to fetch history', historyError);
    } else {
      const chronologicalHistory = Array.isArray(historyRows) ? historyRows.slice().reverse() : [];
      llmHistory = buildLLMHistory(chronologicalHistory);
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

    const scenarioKey =
      typeof session.scenario_key === 'string' && session.scenario_key.trim()
        ? session.scenario_key.trim()
        : DEFAULT_SCENARIO_KEY;

    const scenarioContext = buildScenarioSystemMessage(resolveScenario(scenarioKey));

    const clientReplyText = await generateClientReply({
      latestMessage: contentValue,
      stage,
      difficulty: session.difficulty,
      clientType: session.client_type,
      clientDiscType: session.client_disc_type,
      salesmanCount,
      scenarioContext,
      scenarioKey,
      history: llmHistory,
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

function truncateForPrompt(text, limit = HISTORY_MESSAGE_LIMIT) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return '';
  if (value.length <= limit) return value;
  return value.slice(0, limit).trim();
}

function buildLLMHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') return null;
      const roleValue = typeof message.role === 'string' ? message.role.trim() : '';
      let mappedRole = null;
      if (roleValue === 'salesman') mappedRole = 'user';
      if (roleValue === 'client') mappedRole = 'assistant';
      if (roleValue === 'system') mappedRole = 'system';
      if (!mappedRole) return null;
      const content = truncateForPrompt(message.content);
      if (!content) return null;
      return { role: mappedRole, content };
    })
    .filter(Boolean);
}

async function generateClientReply({
  latestMessage,
  stage,
  difficulty,
  clientType,
  clientDiscType,
  salesmanCount,
  scenarioContext,
  scenarioKey,
  history,
}) {
  const resolvedScenarioContext =
    typeof scenarioContext === 'string' && scenarioContext.trim()
      ? scenarioContext.trim()
      : buildScenarioSystemMessage(resolveScenario());
  const resolvedScenarioKey =
    typeof scenarioKey === 'string' && scenarioKey.trim()
      ? scenarioKey.trim()
      : DEFAULT_SCENARIO_KEY;
  const resolvedScenario = resolveScenario(resolvedScenarioKey);
  const scenarioData = { ...resolvedScenario, key: resolvedScenarioKey };
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
    scenario: scenarioData,
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

  const rendered = await renderPlanWithLLM(
    plan,
    latestMessage,
    maxQuestions,
    resolvedScenarioContext,
    resolvedScenarioKey,
    history
  );
  if (rendered) {
    return enforceMaxLength(rendered, 400);
  }
  return enforceMaxLength(renderPlanFallback(plan, replyMode, maxQuestions), 400);
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

function resolveAnswerFocus(latestMessage) {
  const message = typeof latestMessage === 'string' ? latestMessage.trim() : '';
  const lower = message.toLowerCase();
  if (!lower) return null;

  if (/(kpi|metr|konverz|obrat|roi|úspech|uspech|merateľ|meratel)/i.test(lower)) {
    return 'kpi';
  }
  if (/(rozpočet|rozpocet|cena|cenn[íi]k|náklad|naklad|budget|zľav|zlava)/i.test(lower)) {
    return 'budget';
  }
  if (/(implement|nasaden|migr[aá]c|čas|cas|term[íi]n|kedy|rollout)/i.test(lower)) {
    return 'implementation';
  }
  if (/(rizik|obav|bezpeč|bezpec|výpad|vypad)/i.test(lower)) {
    return 'risk';
  }
  if (/(ďalší krok|dalsi krok|next step|kedy môžeme|kedy mozeme)/i.test(lower)) {
    return 'next_step';
  }

  return null;
}

function applyDiscTone(text, discType) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return '';
  const modifiers = {
    D: 'Stručne, ',
    I: 'Úprimne, ',
    S: 'Pokojne, ',
    C: 'Fakticky, ',
  };
  const prefix = modifiers[discType];
  if (!prefix) return trimmed;
  return `${prefix}${trimmed}`;
}

function buildAnswerSeed({ latestMessage, stage, scenario, clientType, discType }) {
  const normalizedStage = STAGES.includes(stage) ? stage : 'intro';
  const normalizedClientType = normalizeClientType(clientType);
  const normalizedDisc = normalizedClientType === 'repeat' ? normalizeDisc(discType) : 'neutral';
  const scenarioKey = scenario?.key || DEFAULT_SCENARIO_KEY;
  const scenarioSeeds = ANSWER_SEEDS[scenarioKey] || ANSWER_SEEDS[DEFAULT_SCENARIO_KEY];
  const focus = resolveAnswerFocus(latestMessage);
  const focusSeed = focus ? scenarioSeeds?.focus?.[focus] : null;

  const stageSeeds = scenarioSeeds?.byStage?.[normalizedStage] || {};
  const primary =
    focusSeed?.byClient?.[normalizedClientType] ||
    stageSeeds?.[normalizedClientType] ||
    stageSeeds?.default ||
    '';
  const stageAddition = focusSeed?.byStage?.[normalizedStage] || '';

  const sentences = [];
  if (primary) sentences.push(primary);
  if (stageAddition) sentences.push(stageAddition);
  const combined = sentences.join(' ').trim();
  return applyDiscTone(combined, normalizedDisc);
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
  scenario,
}) {
  const normalizedStage = STAGES.includes(stage) ? stage : 'intro';
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const normalizedClientType = normalizeClientType(clientType);
  const base = BASE_BY_STAGE[normalizedStage];
  const resolvedTriggers = triggers || detectTriggers(latestMessage, normalizedStage);
  const difficultyModifiers = DIFFICULTY_MODIFIERS[normalizedDifficulty];
  const answerSeed =
    inputType === 'question'
      ? buildAnswerSeed({
          latestMessage,
          stage: normalizedStage,
          scenario,
          clientType: normalizedClientType,
          discType: clientDiscType,
        })
      : base.defaultReaction;

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
      scenarioContext: scenario,
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
    scenarioContext: scenario,
    questions,
    reaction: answerSeed || base.defaultReaction,
  };

  plan = applyTriggers(plan, resolvedTriggers);
  if (inputType === 'question') {
    plan.reaction = answerSeed || base.defaultReaction;
  }

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

async function renderPlanWithLLM(
  plan,
  latestMessage,
  maxQuestions,
  scenarioContext,
  scenarioKey,
  history
) {
  try {
    const llm = createLLMClient();
    const scenarioSystemMessage = typeof scenarioContext === 'string' ? scenarioContext : '';
    const systemPrompt = `Si biznis klient v obchodnom rozhovore. Tvojou úlohou je len zrenderovať ReplyPlan do prirodzenej, stručnej slovenčiny. Nepridávaj nové body.`;
    const scenarioContextData = plan?.scenarioContext;
    const scenarioTitle = scenarioContextData?.title || DEFAULT_SCENARIO.title;
    const scenarioConstraints = Array.isArray(scenarioContextData?.constraints)
      ? scenarioContextData.constraints.filter(Boolean)
      : [];
    const scenarioConstraintLines = scenarioConstraints.length
      ? scenarioConstraints.map((constraint) => `- ${constraint}`)
      : ['- -'];
    const scenarioBlock = `Scenario context:
TITLE: ${scenarioTitle}
CONSTRAINTS:
${scenarioConstraintLines.join('\n')}`;

    const resolvedScenarioKey =
      typeof scenarioKey === 'string' && scenarioKey.trim()
        ? scenarioKey.trim()
        : DEFAULT_SCENARIO_KEY;
    const developerPrompt = `ReplyPlan (JSON): ${JSON.stringify(plan)}
Scenario key:
- scenario_key: ${resolvedScenarioKey}
${scenarioBlock}
Reply mode: ${plan.replyMode}
Max počet otázok: ${maxQuestions}
Pravidlá:
- Vráť iba prirodzený slovenský text.
- Použi plan.reaction a podľa potreby jednu z plan.questions.
- Ak replyMode = statement_only alebo maxQuestions = 0: nekladieš žiadnu otázku.
- Ak replyMode = statement_then_question: maximálne 1 otázka.
- Žiadne označenia, nadpisy ani odrážky.
- Žiadne školenie obchodníka ani meta poznámky.
- Odpoveď má max 60 slov.`;

    const resolvedHistory = Array.isArray(history) ? history : [];
    const trimmedLatestMessage = typeof latestMessage === 'string' ? latestMessage.trim() : '';
    const lastHistoryEntry = resolvedHistory[resolvedHistory.length - 1];
    const shouldAppendLatestMessage =
      trimmedLatestMessage &&
      (!lastHistoryEntry ||
        lastHistoryEntry.role !== 'user' ||
        lastHistoryEntry.content !== trimmedLatestMessage);
    const messages = [
      { role: 'system', content: scenarioSystemMessage },
      { role: 'system', content: systemPrompt },
      { role: 'developer', content: developerPrompt },
      ...resolvedHistory,
      ...(shouldAppendLatestMessage ? [{ role: 'user', content: trimmedLatestMessage }] : []),
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
  const trimmed = typeof rawReply === 'string' ? rawReply.trim() : '';
  if (!trimmed) return null;
  if (/REAKCIA:|OTÁZKA:/i.test(trimmed)) return null;

  let cleaned = trimmed.replace(/\s+/g, ' ').trim();
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount > 60) return null;

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length || sentences.length > 3) return null;

  const questionCount = (cleaned.match(/\?/g) || []).length;
  if (replyMode === 'statement_only' || maxQuestions === 0) {
    if (questionCount > 0) return null;
    return cleaned;
  }

  if (questionCount <= 1) {
    return cleaned;
  }

  let seenQuestion = false;
  const keptSentences = [];
  for (const sentence of sentences) {
    if (sentence.includes('?')) {
      if (seenQuestion) continue;
      seenQuestion = true;
    }
    keptSentences.push(sentence);
  }

  cleaned = keptSentences.join(' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const normalizedQuestionCount = (cleaned.match(/\?/g) || []).length;
  if (normalizedQuestionCount <= 1) return cleaned;

  const firstQuestionIndex = cleaned.indexOf('?');
  if (firstQuestionIndex === -1) return cleaned;
  const truncated = cleaned.slice(0, firstQuestionIndex + 1).trim();
  return truncated || null;
}

function renderPlanFallback(plan, replyMode, maxQuestions) {
  const reactionSeed = plan.reaction?.trim() || plan.constraints[0] || '';
  const reactionParts = [];
  if (reactionSeed) {
    reactionParts.push(reactionSeed);
  }

  if (plan.stage === 'closing') {
    reactionParts.push(resolveClosingEnding(plan));
  }

  const reaction = reactionParts.join(' ').trim();
  let question = '';
  if (replyMode !== 'statement_only' && maxQuestions > 0 && plan.questions.length) {
    question = plan.questions[0];
  }

  return [reaction, question].filter(Boolean).join(' ').trim();
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

function isMissingColumnError(err, columnName) {
  if (!err) return false;
  const code = err.code ? String(err.code) : '';
  const pieces = [err.message, err.details, err.hint].filter((value) => typeof value === 'string');
  const haystack = pieces.join(' ').toLowerCase();
  const normalizedColumn =
    typeof columnName === 'string' && columnName.trim() ? columnName.trim().toLowerCase() : '';
  const hasColumnName = normalizedColumn ? haystack.includes(normalizedColumn) : true;
  if (code === '42703') {
    return hasColumnName;
  }
  const missingSignals = [
    "could not find the",
    'column does not exist',
    'does not exist',
    'missing column',
    'schema cache',
  ];
  const hasMissingSignal = missingSignals.some((signal) => haystack.includes(signal));
  return hasMissingSignal && hasColumnName;
}
