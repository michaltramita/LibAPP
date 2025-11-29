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

const STATES = {
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
  const { metrics, difficulty, clientDiscType } = sessionState;

  // 1. Analyze user's message and update metrics
  const updatedMetrics = analyzeSalesMessage(userMessage, metrics, currentState, sessionState);

  // 2. Determine the next state of the conversation
  const nextState = getNextState(currentState, userMessage, updatedMetrics, sessionState);

  // 3. Generate the client's response based on the new state
  const clientReply = generateClientReplyForState(nextState, userMessage, sessionState, updatedMetrics);
  
  // 4. Style the response based on DISC profile
  const styledReply = styleResponseByDISC(clientReply, clientDiscType);

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
function styleResponseByDISC(response, discType) {
  const profile = DISC_PROFILES[discType];
  if (!profile) return response;

  let message = response.message;
  
  // Occasionally add a typical phrase
  if (Math.random() < 0.2) {
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
function pickObjection(difficulty) {
  const possibleObjections = OBJECTIONS[difficulty] || OBJECTIONS['beginner'];
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
function generateClientReplyForState(state, userMessage, sessionState) {
    const { difficulty } = sessionState;
    let message = '';
    let mood = 'neutral';
    let reason = 'Čaká na ďalšie informácie.';

    switch (state) {
        case STATES.INTRO:
            message = 'Dobrý deň. Som pripravený. Povedzte mi, čo máte pre mňa.';
            reason = 'Začína stretnutie.';
            break;
        case STATES.DISCOVERY:
            message = 'To je dobrá otázka. Našou hlavnou prioritou je momentálne zvýšenie efektivity a zníženie nákladov.';
            mood = 'interested';
            reason = 'Zaujal sa o zisťovanie potrieb.';
            break;
        case STATES.PRESENTATION:
            message = 'Rozumiem. A ako presne mi v tom vaše riešenie pomôže?';
            mood = 'neutral';
            reason = 'Očakáva prezentáciu hodnoty.';
            break;
        case STATES.OBJECTIONS:
            const objection = pickObjection(difficulty);
            message = objection.text;
            mood = 'skeptical';
            reason = `Má námietku (${objection.type}).`;
            break;
        case STATES.CLOSING:
            if (sessionState.metrics.objectionsHandledWell > 0) {
                message = 'Dobre, presvedčili ste ma, že to stojí za zváženie. Aké sú ďalšie kroky?';
                mood = 'positive';
                reason = 'Pripravený na ďalšie kroky.';
            } else {
                message = 'Stále nie som úplne presvedčený. Potrebujem si to ešte premyslieť.';
                mood = 'skeptical';
                reason = 'Má pochybnosti pred uzatvorením.';
            }
            break;
        case STATES.FINISHED:
            message = 'Ďakujem za stretnutie. Bolo to produktívne. Ozvem sa vám.';
            mood = 'neutral';
            reason = 'Ukončuje stretnutie.';
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
    const { metrics, clientDiscType } = sessionState;

    // Detailed dimension scores
    const dimScores = {
        discovery: scaleScore(metrics.openQuestions, 3) * 0.6 + scaleScore(metrics.needsIdentified, 2) * 0.4,
        presentation: scaleScore(metrics.valueStatements, 3),
        objections: scaleScore(metrics.objectionsHandledWell, metrics.objectionHandlingAttempts || 1),
        closing: scaleScore(metrics.closingAttempts, 1),
        adaptation: scaleScore(metrics.adaptationToDISC, 3),
    };

    // Ensure all dimScores are integers
    for (const key in dimScores) {
        dimScores[key] = Math.floor(dimScores[key]);
    }

    const overallScore = Math.floor((dimScores.discovery + dimScores.presentation + dimScores.objections + dimScores.closing + dimScores.adaptation) / 5);

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
        metrics: tempMetrics,
    };

    for(const msg of salesmanMessages) {
        tempMetrics = analyzeSalesMessage(msg, tempMetrics, currentState, sessionState);
        currentState = getNextState(currentState, msg, tempMetrics, sessionState);
    }
    sessionState.metrics = tempMetrics;
    
    return buildFinalFeedback(sessionState);
};