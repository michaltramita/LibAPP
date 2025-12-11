// Comprehensive Sales Conversation Simulator Logic

// --- CONFIGURATION ---

const DISC_PROFILES = {
  D: {
    tone: 'direct',
    focus: 'results',
    typicalPhrases: ['Prejdime k veci.', 'Aký je konečný výsledok?', 'Chcem vidieť čísla.', 'Nestrácajme čas.'],
  },
  I: {
    tone: 'enthusiastic',
    focus: 'relationships',
    typicalPhrases: ['To znie úžasne!', 'Povedzte mi o tom viac!', 'Kto ďalší to používa?', 'Milujem túto energiu!'],
  },
  S: {
    tone: 'supportive',
    focus: 'security',
    typicalPhrases: ['Ako to pomôže môjmu tímu?', 'Je to bezpečné riešenie?', 'Potrebujem si to premyslieť.', 'Poďme na to krok za krokom.'],
  },
  C: {
    tone: 'analytical',
    focus: 'accuracy',
    typicalPhrases: ['Máte na to dáta?', 'Aká je presná špecifikácia?', 'Potrebujem vidieť podrobnú analýzu.', 'Ako to zapadá do predpisov?'],
  },
};

const OBJECTIONS = {
  beginner: [
    { text: 'Zdá sa mi to trochu drahé.', type: 'price' },
    { text: 'Nie som si istý, či to teraz potrebujeme.', type: 'need' },
    { text: 'Budem si to musieť premyslieť.', type: 'stall' },
  ],
  intermediate: [
    { text: 'Váš konkurent ponúka niečo podobné za nižšiu cenu. Prečo by som si mal vybrať vás?', type: 'competition' },
    { text: 'Máme zlé skúsenosti s implementáciou podobných systémov v minulosti.', type: 'past_experience' },
    { text: 'Nie som si istý, či má náš tím kapacity na to, aby sa to naučil používať.', type: 'resources' },
  ],
  expert: [
    { text: 'Vlastne už finalizujeme dohodu s iným dodávateľom. Prečo by sme to mali meniť?', type: 'competition_advanced' },
    { text: 'Váš produkt nerieši náš špecifický problém X, ktorý je pre nás kľúčový.', type: 'feature_gap' },
    { text: 'Rozhodovacia osoba je mimo kancelárie na ďalší mesiac. Musíme to odložiť.', type: 'stall_hard' },
  ],
};

const REPEAT_CLIENT_OBJECTIONS = {
  beginner: [
    { text: 'Minule sme sa bavili o implementácii a stále si nie som istý návratnosťou.', type: 'roi_history' },
    { text: 'Konkurencia nám po poslednom stretnutí dala agresívnejšiu ponuku. Čím ju prekonáte?', type: 'competition_history' },
    { text: 'Ešte stále vyhodnocujeme výsledky z predchádzajúcej fázy. Prečo to teraz zrýchľovať?', type: 'timeline' },
  ],
  intermediate: [
    { text: 'Pri minulej spolupráci sme mali výzvy s adopciou tímu. Ako to tentoraz urobíte inak?', type: 'past_experience' },
    { text: 'Naša interná analýza ukázala nižší ROI, než sme čakali. Viete to doložiť dátami?', type: 'roi' },
    { text: 'Konkurent nám ukázal referencie z podobných projektov. Aké výsledky sme dosiahli spolu doteraz?', type: 'competition' },
  ],
  expert: [
    { text: 'Chcem porovnať konkrétne výsledky z nášho minulého projektu s tým, čo teraz navrhujete.', type: 'results_comparison' },
    { text: 'Pri implementácii sme narazili na úzke hrdlá. Ako zabezpečíte, že sa to nezopakuje?', type: 'implementation_history' },
    { text: 'Aký posun sme dosiahli oproti konkurencii od nášho posledného rozhovoru?', type: 'competition_advanced' },
  ],
};

export const STATES = {
  INTRO: 'intro',
  DISCOVERY: 'discovery',
  PRESENTATION: 'presentation',
  OBJECTIONS: 'objections',
  CLOSING: 'closing',
  FINISHED: 'finished',
};

// --- CORE LOGIC ---

/**
 * Generates a contextual reply from the client AI.
 * This is the main function called by the UI.
 */
export const generateClientReply = (currentState, userMessage, sessionState) => {
  const normalizedSessionState = {
    clientType: sessionState.clientType || 'new',
    ...sessionState,
  };
  const { metrics, difficulty, clientDiscType } = normalizedSessionState;

  // 1. Analyze user's message and update metrics
  const updatedMetrics = analyzeSalesMessage(userMessage, metrics, currentState, normalizedSessionState);

  // 2. Determine the next state of the conversation
  const nextState = getNextState(currentState, userMessage, updatedMetrics, normalizedSessionState);

  // 3. Generate the client's response based on the new state
  const clientReply = generateClientReplyForState(nextState, userMessage, normalizedSessionState, updatedMetrics);

  // 4. Style the response based on DISC profile
  const styledReply = styleResponseByDISC(clientReply, clientDiscType, normalizedSessionState.clientType);

  const shouldEnd = nextState === STATES.FINISHED || (currentState === STATES.CLOSING && Math.random() < 0.5);

  return {
    newState: nextState,
    clientMessage: styledReply.message,
    clientMood: styledReply.mood,
    clientMoodReason: styledReply.reason,
    updatedMetrics: updatedMetrics,
    shouldEnd: shouldEnd,
  };
};

/**
 * Adapts the client's response tone and phrasing to match their DISC profile.
 */
function styleResponseByDISC(response, discType, clientType = 'new') {
  const profile = DISC_PROFILES[discType];
  if (!profile) return response;

  let message = response.message;

  // Occasionally add a typical phrase
  const addPhraseThreshold = clientType === 'repeat' ? 0.35 : 0.2;
  if (Math.random() < addPhraseThreshold) {
    const phrase = profile.typicalPhrases[Math.floor(Math.random() * profile.typicalPhrases.length)];
    message = `${phrase} ${message}`;
  }

  // Adjust tone (this is a simplified example)
  switch(profile.tone) {
    case 'direct':
      message = message.replace('Mohli by ste mi povedať viac o', 'Povedzte mi o');
      break;
    case 'enthusiastic':
      if(response.mood === 'positive' && Math.random() < 0.4) message += ' To je skvelé!';
      break;
    case 'analytical':
      if (Math.random() < 0.3) message += ' Aké sú na to dáta?';
      break;
    default:
      break;
  }

  return { ...response, message };
}


/**
 * Selects a relevant objection based on difficulty.
 */
function pickObjection(difficulty, clientType = 'new') {
  const objectionPool = clientType === 'repeat' ? REPEAT_CLIENT_OBJECTIONS : OBJECTIONS;
  const possibleObjections = objectionPool[difficulty] || objectionPool['beginner'];
  return possibleObjections[Math.floor(Math.random() * possibleObjections.length)];
}

// --- METRICS & ANALYSIS ---
const initialMetrics = {
  questionsAsked: 0,
  openQuestions: 0,
  needsIdentified: 0,
  valueStatements: 0,
  objectionHandlingAttempts: 0,
  objectionsHandledWell: 0,
  closingAttempts: 0,
  adaptationToDISC: 0,
};

export const getInitialMetrics = () => JSON.parse(JSON.stringify(initialMetrics));

/**
 * Analyzes the user's message to update performance metrics.
 */
function analyzeSalesMessage(message, currentMetrics, state, sessionState) {
    if (!message) {
      return currentMetrics;
    }

    const newMetrics = { ...currentMetrics };
    const lowerMessage = message.toLowerCase();

    // Questions
    const questionCount = (lowerMessage.match(/\?/g) || []).length;
    if (questionCount > 0) {
        newMetrics.questionsAsked += questionCount;
        const openWords = ['ako', 'prečo', 'čo', 'ktoré', 'akým spôsobom', 'povedzte mi'];
        if (openWords.some(word => lowerMessage.startsWith(word))) {
            newMetrics.openQuestions += 1;
        }
    }

    // Needs Identified (heuristic)
    if (state === STATES.DISCOVERY && questionCount > 0 && newMetrics.needsIdentified < 4) {
        newMetrics.needsIdentified += 1;
    }

    // Value Statements
    const valueWords = ['benefit', 'výhoda', 'zlepšiť', 'ušetriť', 'efektívnejšie', 'rast'];
    if (valueWords.some(word => lowerMessage.includes(word))) {
        newMetrics.valueStatements += 1;
    }
    
    // Objections
    if (state === STATES.OBJECTIONS) {
        newMetrics.objectionHandlingAttempts += 1;
        // Simple heuristic for good handling
        if (lowerMessage.includes('rozumiem vašej obave') || lowerMessage.includes('je to legitímna otázka')) {
            newMetrics.objectionsHandledWell += 1;
            newMetrics.adaptationToDISC +=1; // Empathy is good adaptation
        }
    }

    // Closing
    const closingWords = ['ďalšie kroky', 'môžeme začať', 'poslať zmluvu', 'dohodnime sa'];
    if (closingWords.some(word => lowerMessage.includes(word))) {
        newMetrics.closingAttempts += 1;
    }

    // DISC Adaptation
    const profile = DISC_PROFILES[sessionState.clientDiscType];
    if (profile && profile.focus === 'results' && (lowerMessage.includes('výsledky') || lowerMessage.includes('roi'))) {
        newMetrics.adaptationToDISC += 1;
    }
    if (profile && profile.focus === 'relationships' && (lowerMessage.includes('spolupráca') || lowerMessage.includes('partnerstvo'))) {
        newMetrics.adaptationToDISC += 1;
    }
    if (profile && profile.focus === 'security' && (lowerMessage.includes('bezpečnosť') || lowerMessage.includes('podpora'))) {
        newMetrics.adaptationToDISC += 1;
    }
    if (profile && profile.focus === 'accuracy' && (lowerMessage.includes('dáta') || lowerMessage.includes('analýza'))) {
        newMetrics.adaptationToDISC += 1;
    }

    return newMetrics;
}

// --- STATE MACHINE ---

/**
 * Determines the next state in the conversation flow.
 */
function getNextState(currentState, userMessage, metrics, sessionState) {
    if (!userMessage) return currentState;

    switch (currentState) {
        case STATES.INTRO:
            return metrics.questionsAsked > 0 ? STATES.DISCOVERY : STATES.INTRO;
        case STATES.DISCOVERY:
            return metrics.valueStatements > 0 || metrics.needsIdentified > 2 ? STATES.PRESENTATION : STATES.DISCOVERY;
        case STATES.PRESENTATION:
            if (Math.random() < 0.4 && metrics.objectionHandlingAttempts === 0) return STATES.OBJECTIONS;
            return metrics.closingAttempts > 0 ? STATES.CLOSING : STATES.PRESENTATION;
        case STATES.OBJECTIONS:
            return metrics.closingAttempts > 0 ? STATES.CLOSING : STATES.PRESENTATION;
        case STATES.CLOSING:
            const lowerMessage = userMessage.toLowerCase();
            if (lowerMessage.includes('ďakujem') && metrics.closingAttempts > 0) return STATES.FINISHED;
            return STATES.CLOSING;
        case STATES.FINISHED:
            return STATES.FINISHED;
        default:
            return STATES.INTRO;
    }
}

/**
 * Generates a client response based on the current conversation state.
 */
export function generateClientReplyForState(state, userMessage, sessionState) {
    const { difficulty, clientType = 'new', industry } = sessionState;
    let message = '';
    let mood = 'neutral';
    let reason = 'Čaká na ďalšie informácie.';

    const isNewClient = clientType === 'new';

    switch (state) {
        case STATES.INTRO:
            if (isNewClient) {
                message = 'Dobrý deň, teší ma, že sa spoznávame. Rád si vypočujem, čo prinášate.';
                reason = 'Nový kontakt, neutrálne predstavenie.';
            } else {
                message = `Som rád, že nadväzujeme na naše minulé rozhovory o ${industry || 'vašej firme'}. Poďme pokračovať.`;
                reason = 'Pozná predchádzajúcu spoluprácu.';
            }
            break;
        case STATES.DISCOVERY:
            if (isNewClient) {
                message = 'Aby som lepšie porozumel, aké sú vaše aktuálne priority a kde vnímate najväčší priestor na zlepšenie?';
                mood = 'interested';
                reason = 'Zvedavo zisťuje všeobecné potreby nového klienta.';
            } else {
                message = 'Minule ste spomínali problémy s efektivitou. Ako sa odvtedy posunuli výsledky a čo je teraz najväčšia priorita?';
                mood = 'interested';
                reason = 'Nadväzuje na minulé zistenia a kontext.';
            }
            break;
        case STATES.PRESENTATION:
            if (isNewClient) {
                message = 'Môžete mi priblížiť základné benefity a aké príklady z praxe máte? Chcem si to ujasniť.';
                mood = 'neutral';
                reason = 'Žiada objasnenie, bez predpokladu predchádzajúcej skúsenosti.';
            } else {
                message = 'Minule sme riešili rýchle nasadenie. Aké konkrétne kroky navrhujete teraz, aby sme nadviazali na predchádzajúce výsledky?';
                mood = 'neutral';
                reason = 'Očakáva detailné odporúčania prispôsobené histórii.';
            }
            break;
        case STATES.OBJECTIONS:
            const objection = pickObjection(difficulty, clientType);
            message = objection.text;
            mood = isNewClient ? 'skeptical' : 'curious';
            reason = isNewClient ? 'Má základnú námietku typickú pre nového klienta.' : 'Overuje pokračovanie na základe predchádzajúcich skúseností.';
            break;
        case STATES.CLOSING:
            if (isNewClient) {
                message = 'Potrebujem si to ešte premyslieť a uistiť sa, že to sedí na naše potreby. Aké materiály mi viete poslať?';
                mood = 'skeptical';
                reason = 'Nový klient potrebuje čas a uistenie pred rozhodnutím.';
            } else if (sessionState.metrics.objectionsHandledWell > 0) {
                message = 'Dáva mi to zmysel. Aké sú ďalšie kroky, aby sme nadviazali na našu doterajšiu spoluprácu?';
                mood = 'positive';
                reason = 'Pripravený pokračovať v už existujúcom vzťahu.';
            } else {
                message = 'Chcem vidieť, ako to zapadne do toho, čo sme robili naposledy. Viete mi ukázať plán pokračovania?';
                mood = 'neutral';
                reason = 'Zvažuje pokračovanie, potrebuje kontext s históriou.';
            }
            break;
        case STATES.FINISHED:
            if (isNewClient) {
                message = 'Ďakujem za predstavenie. Ozvem sa, keď si prejdeme informácie interne.';
                mood = 'neutral';
                reason = 'Ukončuje úvodné stretnutie bez histórie.';
            } else {
                message = 'Ďakujem, cením si nadviazanie na našu doterajšiu spoluprácu. Ozvem sa s ďalšími krokmi, aby sme pokračovali.';
                mood = 'positive';
                reason = 'Zhrnutie s ohľadom na spoločnú históriu.';
            }
            break;
        default:
            message = 'Prepáčte, stratil som niť. Kde sme to skončili?';
    }

    return { message, mood, reason };
}

// --- FEEDBACK GENERATION ---
// Changed to Math.floor to ensure whole numbers for scores (e.g., 7.2 becomes 7)
const scaleScore = (value, max) => Math.max(1, Math.min(10, Math.floor((value / max) * 10)));


/**
 * Builds the final, comprehensive feedback object.
 */
export function buildFinalFeedback(sessionState) {
    const { metrics, clientDiscType, clientType = 'new' } = sessionState;

    // Detailed dimension scores
    const dimScores = {
        discovery: scaleScore(metrics.openQuestions, 3) * 0.6 + scaleScore(metrics.needsIdentified, 2) * 0.4,
        presentation: scaleScore(metrics.valueStatements, 3),
        objections: scaleScore(metrics.objectionsHandledWell, metrics.objectionHandlingAttempts || 1),
        closing: scaleScore(metrics.closingAttempts, 1),
        adaptation: scaleScore(metrics.adaptationToDISC, 3),
    };

    if (clientType === 'repeat') {
      dimScores.history = scaleScore(metrics.valueStatements + metrics.objectionsHandledWell, 4);
      dimScores.relationshipAdaptation = scaleScore(metrics.adaptationToDISC + metrics.openQuestions, 4);
    }

    // Ensure all dimScores are integers
    for (const key in dimScores) {
        dimScores[key] = Math.floor(dimScores[key]);
    }

    const scoreValues = Object.values(dimScores);
    const overallScore = Math.floor(scoreValues.reduce((acc, value) => acc + value, 0) / scoreValues.length);

    const dimensions = [
      {
        name: 'Zisťovanie potrieb',
        score: dimScores.discovery,
        comment: metrics.openQuestions > 1 ? 'Efektívne ste používali otvorené otázky.' : 'Skúste klásť viac otvorených otázok (Ako, Čo, Prečo).'
      },
      {
        name: 'Prezentácia hodnoty',
        score: dimScores.presentation,
        comment: metrics.valueStatements > 1 ? 'Jasne ste komunikovali hodnotu riešenia.' : 'Zamerajte sa na prepojenie vlastností s prínosmi pre klienta.'
      },
      {
        name: 'Práca s námietkami',
        score: dimScores.objections,
        comment: metrics.objectionHandlingAttempts > 0 ? (metrics.objectionsHandledWell > 0 ? 'Úspešne ste zvládli námietku.' : 'Pracujte na empatii pri zvládaní námietok.') : 'Nestretli ste sa so žiadnou námietkou.'
      },
      {
        name: 'Uzatváranie/dohoda',
        score: dimScores.closing,
        comment: metrics.closingAttempts > 0 ? 'Prejavili ste iniciatívu a navrhli ďalšie kroky.' : 'Nebojte sa na konci stretnutia navrhnúť konkrétny ďalší krok.'
      },
      {
        name: 'Prispôsobenie sa typu klienta',
        score: dimScores.adaptation,
        comment: `Prispôsobili ste sa klientovi typu ${clientDiscType}. ` + (metrics.adaptationToDISC > 1 ? 'Vynikajúca práca!' : 'Skúste sa viac zamerať na jeho štýl komunikácie.')
      }
    ];

    if (clientType === 'repeat') {
      dimensions.push(
        {
          name: 'Práca s históriou',
          score: dimScores.history,
          comment: metrics.valueStatements > 1 ? 'Využili ste predchádzajúce výsledky v argumentácii.' : 'Ešte viac zdôraznite, čo sa už podarilo v našej spolupráci.'
        },
        {
          name: 'Adaptácia na existujúceho klienta',
          score: dimScores.relationshipAdaptation,
          comment: metrics.adaptationToDISC > 1 ? 'Personalizácia bola citeľná a nadviazala na minulé interakcie.' : 'Viac prispôsobte komunikáciu poznaným preferenciám klienta.'
        }
      );
    }

    let personalizedMessage = '';
    if (overallScore >= 8) personalizedMessage = "Vynikajúci výkon! Vaše predajné zručnosti sú na vysokej úrovni.";
    else if (overallScore >= 6) personalizedMessage = "Skvelá práca! Ukázali ste silné základy, zamerajte sa na oblasti s nižším skóre a budete neporaziteľný.";
    else personalizedMessage = "Dobrý začiatok! Každá simulácia je krokom k majstrovstvu. Zamerajte sa na odporúčané kroky.";

    let nextSteps = '';
    const lowestScoreDim = [...dimensions].sort((a,b) => a.score - b.score)[0];
    if (lowestScoreDim.score < 7) {
        nextSteps = `Zamerajte sa na zlepšenie v oblasti "${lowestScoreDim.name}". ${lowestScoreDim.comment} Skúste si scenár zopakovať s týmto cieľom.`;
    } else {
        nextSteps = "Udržujte si skvelú prácu a skúste scenár s vyššou obtiažnosťou pre novú výzvu.";
    }

    return {
        score: overallScore,
        personalizedMessage,
        dimensions,
        nextSteps,
        finalMetrics: metrics, // For logging/debugging
    };
}


// --- DEPRECATED/COMPATIBILITY ---

export const evaluateMeeting = (messages, config) => {
    let tempMetrics = getInitialMetrics();
    let currentState = STATES.INTRO;

    const salesmanMessages = messages.filter(m => m.type === 'salesman').map(m => m.text);

    const sessionState = {
        difficulty: config.salesmanLevel,
        clientDiscType: config.clientType,
        industry: config.industry,
        clientType: config.clientCategory || 'new',
        metrics: tempMetrics,
    };

    for(const msg of salesmanMessages) {
        tempMetrics = analyzeSalesMessage(msg, tempMetrics, currentState, sessionState);
        currentState = getNextState(currentState, msg, tempMetrics, sessionState);
    }
    sessionState.metrics = tempMetrics;
    
    return buildFinalFeedback(sessionState);
};