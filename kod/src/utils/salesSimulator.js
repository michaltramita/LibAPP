// Comprehensive Sales Conversation Simulator Logic
import { analyzeSalesmanTurn, deriveMoodFromScore, updateMoodScore } from './salesAnalyzer.js';

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

const INTRO_MOOD_BY_DIFFICULTY = {
  beginner: 3,
  intermediate: 3,
  expert: 2,
};

const DISC_MOOD_DEFAULT = {
  D: 2,
  I: 3,
  S: 3,
  C: 2,
};

// --- CORE LOGIC ---

/**
 * Generates a contextual reply from the client AI.
 * This is the main function called by the UI.
 */
export const generateClientReply = (currentState, userMessage, sessionState) => {
  const normalizedSessionState = {
    clientType: sessionState.clientType || 'new',
    introFlags: sessionState.introFlags || getInitialIntroFlags(),
    moodScore: sessionState.moodScore || 0,
    phaseCounters: sessionState.phaseCounters || getInitialPhaseCounters(),
    ...sessionState,
  };
  const { metrics, difficulty, clientDiscType } = normalizedSessionState;

  // 1. Analyze user's message and update metrics
  const { metrics: updatedMetrics, introFlags: updatedIntroFlags, phaseCounters: updatedPhaseCounters, phaseGate, moodScore: updatedMoodScore, moodReasons: updatedMoodReasons } = analyzeSalesMessage(
    userMessage,
    metrics,
    currentState,
    normalizedSessionState
  );
  const sessionWithIntro = {
    ...normalizedSessionState,
    introFlags: updatedIntroFlags,
    phaseCounters: updatedPhaseCounters || normalizedSessionState.phaseCounters,
    phaseGate,
    moodScore: updatedMoodScore ?? normalizedSessionState.moodScore,
  };

  // 1b. Update intro mood based on detected signals
  let introSignals = null;
  if (currentState === STATES.INTRO) {
    introSignals = userMessage ? extractIntroSignals(userMessage, normalizedSessionState) : null;
    if (introSignals) {
      const moodUpdate = updateMoodIntro(normalizedSessionState.moodLevel, introSignals, normalizedSessionState);
      normalizedSessionState.moodLevel = moodUpdate.moodLevel;
      normalizedSessionState.lastMoodReason = moodUpdate.reason;
      normalizedSessionState.moodHistory = appendMoodHistory(normalizedSessionState, moodUpdate);
      normalizedSessionState.lastIntroSignals = introSignals;
    }
  }

  // 2. Determine the next state of the conversation
  const nextState = getNextState(currentState, userMessage, updatedMetrics, sessionWithIntro);
  const introGatePassed = currentState === STATES.INTRO && nextState === STATES.DISCOVERY;

  // 3. Generate the client's response based on the new state
  normalizedSessionState.metrics = updatedMetrics;
  const clientReply = generateClientReplyForState(nextState, userMessage, normalizedSessionState, updatedMetrics);

  // 4. Style the response based on DISC profile
  const moodScore =
    sessionWithIntro.introFlags._moodScore ??
    sessionWithIntro.phaseCounters?.needs?._moodScore ??
    sessionWithIntro.moodScore ??
    normalizedSessionState.moodScore ??
    0;
  const moodReasons =
    sessionWithIntro.introFlags._moodReasons ||
    sessionWithIntro.phaseCounters?.needs?._moodReasons ||
    updatedMoodReasons ||
    [];
  const derivedMood = currentState === STATES.INTRO ? deriveMoodFromScore(moodScore) : clientReply.mood;
  const styledReply = styleResponseByDISC(
    { ...clientReply, mood: derivedMood },
    clientDiscType,
    sessionWithIntro.clientType
  );

  const shouldEnd = nextState === STATES.FINISHED || (currentState === STATES.CLOSING && Math.random() < 0.5);
  const phaseFeedback = currentState === STATES.INTRO && (nextState !== STATES.INTRO || (introSignals && introSignals.attemptToMoveOn))
    ? generateIntroFeedback({ ...normalizedSessionState, metrics: updatedMetrics })
    : undefined;
  const moodReason = normalizedSessionState.lastMoodReason || styledReply.reason;

  return {
    newState: nextState,
    clientMessage: styledReply.message,
    clientMood: styledReply.mood,
    clientMoodReason: styledReply.reason || moodReason,
    updatedMetrics: updatedMetrics,
    introFlags: updatedIntroFlags,
    shouldEnd: shouldEnd,
    moodScore: moodScore,
    moodReasons,
    phaseCounters: sessionWithIntro.phaseCounters,
    phaseGate,
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



function clampMood(level) {
  return Math.max(1, Math.min(5, level));
}

export function getStartingMoodLevel(sessionState = {}) {
  const base = INTRO_MOOD_BY_DIFFICULTY[sessionState.difficulty] ?? 3;
  const discBias = DISC_MOOD_DEFAULT[sessionState.clientDiscType] ?? base;
  return clampMood(sessionState.moodLevel ?? discBias ?? base);
}

function ensureSessionDefaults(sessionState = {}) {
  const normalized = {
    clientType: sessionState.clientType || 'new',
    metrics: sessionState.metrics || getInitialMetrics(),
    moodLevel: getStartingMoodLevel(sessionState),
    lastMoodReason: sessionState.lastMoodReason || 'Počiatočná nálada podľa profilu a obtiažnosti.',
    moodHistory: sessionState.moodHistory || [],
    lastIntroSignals: sessionState.lastIntroSignals || {},
    ...sessionState,
  };

  if (!normalized.metrics) {
    normalized.metrics = getInitialMetrics();
  }

  normalized.moodLevel = clampMood(normalized.moodLevel);
  return normalized;
}

function appendMoodHistory(sessionState, moodUpdate) {
  if (!Array.isArray(sessionState.moodHistory)) return [];
  const entry = {
    level: moodUpdate.moodLevel,
    reason: moodUpdate.reason,
    at: new Date().toISOString(),
    signals: moodUpdate.signals || {},
  };
  return [...sessionState.moodHistory, entry].slice(-10);
}

function detectDiscMismatch(sessionState, signals = {}, wordCount = 0, lowerMessage = '') {
  const disc = sessionState.clientDiscType;
  if (!disc) return false;

  if ((disc === 'D' || disc === 'C') && signals.longMonologue) return true;
  if (disc === 'I' && signals.brevity && !/(ďakujem|rád|teší|vitajte)/.test(lowerMessage)) return true;
  if (disc === 'S' && (signals.pressureSignal || /tlak|urgent/.test(lowerMessage))) return true;
  return false;
}

export function extractIntroSignals(message = '', sessionState = {}) {
  const lower = (message || '').toLowerCase();
  const words = lower.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const signals = {
    goalAgendaConcise: /(cieľ|agenda|program|zámer)/.test(lower) && wordCount <= 60,
    explainedQuestionPurpose: /(aby som (lepšie )?pochopil|chcem pochopiť|chcem vedieť prečo)/.test(lower),
    openQuestion: /(\bako\b|\bčo\b|\bprečo\b|\bktor[ýaeé]\b|\bkde\b).*\?/.test(lower) || lower.trim().startsWith('ako'),
    brevity: wordCount > 0 && wordCount <= 40,
    longMonologue: wordCount > 80,
    pitchTooEarly: /(ponuka|cena|zľav|zmluv|objednáv)/.test(lower) && wordCount < 80,
    pressureSignal: /(ihneď|hneď|musíte|rýchlo|do konca dňa|urgentne|tlak)/.test(lower),
    attemptToMoveOn: /(poďme ďalej|prejdime|môžeme prejsť|posuňme sa)/.test(lower),
  };

  signals.discMismatch = detectDiscMismatch(sessionState, signals, wordCount, lower);
  return signals;
}

export function updateMoodIntro(prevMood, signals = {}, sessionState = {}) {
  let delta = 0;
  const positives = [];
  const negatives = [];

  if (signals.goalAgendaConcise || signals.explainedQuestionPurpose || signals.openQuestion) {
    delta = 1;
    if (signals.goalAgendaConcise) positives.push('jasný cieľ/agenda');
    if (signals.explainedQuestionPurpose) positives.push('vysvetlený zámer otázky');
    if (signals.openQuestion) positives.push('otvorená otázka');
  }

  if (signals.brevity && (sessionState.difficulty === 'expert' || ['D', 'C'].includes(sessionState.clientDiscType))) {
    delta = 1;
    positives.push('stručnosť');
  }

  if (signals.longMonologue || signals.pitchTooEarly || signals.pressureSignal || signals.discMismatch) {
    delta = -1;
    if (signals.longMonologue) negatives.push('príliš dlhý úvod');
    if (signals.pitchTooEarly) negatives.push('príliš skorý pitch');
    if (signals.pressureSignal) negatives.push('tlak/urgentnosť');
    if (signals.discMismatch) negatives.push('nesúlad s DISC');
  }

  const moodLevel = clampMood(prevMood + delta);
  const reasonParts = [];
  if (positives.length) reasonParts.push(`+1 za ${positives.join(', ')}`);
  if (negatives.length) reasonParts.push(`-1 za ${negatives.join(', ')}`);
  if (!reasonParts.length) reasonParts.push('Bez zmeny nálady.');

  return {
    moodLevel,
    reason: reasonParts.join('; '),
    signals,
  };
}

function mapMoodLevelToLabel(level) {
  if (level >= 5) return 'positive';
  if (level === 4) return 'interested';
  if (level === 3) return 'neutral';
  if (level === 2) return 'skeptical';
  return 'negative';
}

function shortenIntroLine(message, maxWords = 18) {
  const words = message.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return message;
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function applyMoodToIntroResponse(baseMessage, sessionState) {
  const moodLevel = sessionState.moodLevel ?? 3;
  const reason = sessionState.lastMoodReason || 'Reaguje podľa nálady v úvode.';
  let message = baseMessage;

  switch (moodLevel) {
    case 5:
      message = `${baseMessage} Pre kontext mi pomôže vedieť, čo chcete tento rok dosiahnuť. Aký výsledok by vás potešil?`;
      break;
    case 4:
      message = `${baseMessage} Môžete pridať jeden konkrétny detail, aby sme vedeli, kde začať.`;
      break;
    case 3:
      message = baseMessage;
      break;
    case 2:
      message = `${shortenIntroLine(baseMessage)} Aký je cieľ tohto rozhovoru?`;
      break;
    default:
      message = `Poďme k veci. ${shortenIntroLine(baseMessage, 8)}`;
      break;
  }

  return {
    message,
    mood: mapMoodLevelToLabel(moodLevel),
    reason,
  };
}

export function generateIntroFeedback(sessionState = {}) {
  const { metrics = {}, moodLevel = 3, lastIntroSignals = {}, clientType, clientDiscType } = sessionState;
  const strengths = [];
  const improvements = [];

  if (lastIntroSignals.goalAgendaConcise) {
    strengths.push('Stručne ste pomenovali cieľ a agendu.');
  } else {
    improvements.push('Hneď v úvode naznačte cieľ a čo chcete prebrať v jednej vete.');
  }

  if (lastIntroSignals.openQuestion || (metrics.openQuestions ?? 0) > 0) {
    strengths.push('Použili ste otvorenú otázku na zmapovanie situácie.');
  } else if (improvements.length < 2) {
    improvements.push('Pridajte aspoň jednu otvorenú otázku, aby ste získali kontext.');
  }

  if ((metrics.questionsAsked ?? 0) === 0 && improvements.length < 2) {
    improvements.push('Začnite otázkou namiesto dlhého monológu.');
  }

  const verdict = moodLevel >= 3 && strengths.length > 0 ? 'splnená' : 'nesplnená';
  const recommendedLine = moodLevel <= 2
    ? 'Spomaľte a vysvetlite, prečo sa pýtate – klient potrebuje vidieť cieľ rozhovoru.'
    : 'Udržte otvorené otázky a pripomeňte spoločný cieľ.';

  const discNote = clientType === 'repeat'
    ? `Rešpektujte preferencie typu ${clientDiscType || 'klienta'} z predchádzajúcich hovorov.`
    : undefined;

  return {
    verdict,
    strengths: strengths.slice(0, 2),
    improvements: improvements.slice(0, 2),
    recommendedLine,
    discNote,
  };
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

export const getInitialPhaseCounters = () => ({
  needs: {
    askedQuestions: 0,
    openQuestions: 0,
    identifiedNeeds: 0,
    followUps: 0,
    impactFound: false,
    summaryFound: false,
    confirmFound: false,
    lastQuestion: '',
    earlyPitch: false,
  },
});


export const getInitialIntroFlags = () => ({
  hasGoal: false,
  hasAgenda: false,
  hasOpenQuestion: false,
  hasConsentSignal: false,
  startedPitchTooEarly: false,
  longMonologue: false,
});

export function detectSignalsIntro(text, sessionState) {
  const analysis = analyzeSalesmanTurn({ text, phase: 'intro', settings: sessionState, state: sessionState });
  const { signals, metricDelta, introFlagsDelta } = analysis;

  return {
    questionsAsked: metricDelta.questionsAsked || 0,
    openQuestions: metricDelta.openQuestions || 0,
    hasGoal: introFlagsDelta.goalFramed || false,
    hasAgenda: introFlagsDelta.agendaProposed || false,
    hasOpenQuestion: introFlagsDelta.diagnosticStarted || false,
    hasConsentQuestion: introFlagsDelta.consentObtained || false,
    startedPitchTooEarly: introFlagsDelta.earlyPitchDetected || false,
    longMonologue: introFlagsDelta.longMonologue || false,
    signals,
  };
}

export function isIntroGateSatisfied(sessionState) {
  const { introFlags = getInitialIntroFlags(), metrics = getInitialMetrics() } = sessionState;

  const requiredSignals =
    introFlags.hasGoal &&
    introFlags.hasAgenda &&
    introFlags.hasOpenQuestion &&
    introFlags.hasConsentSignal;

  const metricsReady = metrics.questionsAsked >= 1 && metrics.openQuestions >= 1;
  const blocked = introFlags.startedPitchTooEarly === true || introFlags.longMonologue === true;

  return requiredSignals && metricsReady && !blocked;
}

export function isNeedsGateSatisfied(phaseCounters = getInitialPhaseCounters()) {
  const needs = phaseCounters.needs || getInitialPhaseCounters().needs;
  const hasCounts =
    (needs.askedQuestions || 0) >= 5 &&
    (needs.openQuestions || 0) >= 3 &&
    (needs.identifiedNeeds || 0) >= 2;
  const hasSignals = needs.impactFound && needs.summaryFound && needs.confirmFound;
  const blocked = needs.earlyPitch === true;
  return hasCounts && hasSignals && !blocked;
}

/**
 * Analyzes the user's message to update performance metrics.
 */
export function analyzeSalesMessage(message, currentMetrics, state, sessionState) {
    const introFlags = { ...(sessionState.introFlags || getInitialIntroFlags()) };
    const phaseCounters = { ...(sessionState.phaseCounters || getInitialPhaseCounters()) };
    if (!message) {
      return { metrics: currentMetrics, introFlags, phaseCounters, moodScore: sessionState.moodScore || 0 };
    }

    const newMetrics = { ...currentMetrics };
    const lowerMessage = message.toLowerCase();

    if (state === STATES.INTRO) {
        const analysis = analyzeSalesmanTurn({
          text: message,
          phase: 'intro',
          settings: sessionState,
          state: sessionState,
        });

        newMetrics.questionsAsked += analysis.metricDelta.questionsAsked || 0;
        newMetrics.openQuestions += analysis.metricDelta.openQuestions || 0;
        newMetrics.valueStatements += analysis.metricDelta.valueStatements || 0;
        newMetrics.adaptationToDISC += analysis.metricDelta.adaptationToDISC || 0;

        introFlags.hasGoal = introFlags.hasGoal || analysis.introFlagsDelta.goalFramed;
        introFlags.hasAgenda = introFlags.hasAgenda || analysis.introFlagsDelta.agendaProposed;
        introFlags.hasOpenQuestion = introFlags.hasOpenQuestion || analysis.introFlagsDelta.diagnosticStarted;
        introFlags.hasConsentSignal = introFlags.hasConsentSignal || analysis.introFlagsDelta.consentObtained;
        introFlags.startedPitchTooEarly = introFlags.startedPitchTooEarly || analysis.introFlagsDelta.earlyPitchDetected;
        introFlags.longMonologue = introFlags.longMonologue || analysis.introFlagsDelta.longMonologue;

        // Mood handling for intro
        const updatedMoodScore = updateMoodScore(sessionState.moodScore || 0, analysis.moodDelta.delta);
        introFlags._moodScore = updatedMoodScore;
        introFlags._moodReasons = analysis.moodDelta.reasons;
        return { metrics: newMetrics, introFlags, phaseCounters, moodScore: updatedMoodScore, moodReasons: analysis.moodDelta.reasons };
    } else if (state === STATES.DISCOVERY) {
        const analysis = analyzeSalesmanTurn({
          text: message,
          phase: 'needs',
          settings: sessionState,
          state: { ...sessionState, phaseCounters },
        });

        newMetrics.questionsAsked += analysis.metricDelta.questionsAsked || 0;
        newMetrics.openQuestions += analysis.metricDelta.openQuestions || 0;
        newMetrics.needsIdentified += analysis.metricDelta.needsIdentified || 0;
        newMetrics.valueStatements += analysis.metricDelta.valueStatements || 0;

        const updatedPhaseCounters = {
          ...phaseCounters,
          ...(analysis.phaseCounters || {}),
        };

        const updatedMoodScore = updateMoodScore(sessionState.moodScore || 0, analysis.moodDelta.delta);
        if (updatedPhaseCounters.needs) {
          updatedPhaseCounters.needs._moodScore = updatedMoodScore;
          updatedPhaseCounters.needs._moodReasons = analysis.moodDelta.reasons;
        }

        return {
          metrics: newMetrics,
          introFlags,
          phaseCounters: updatedPhaseCounters,
          phaseGate: analysis.phaseGate,
          moodScore: updatedMoodScore,
          moodReasons: analysis.moodDelta.reasons,
        };
    } else {
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
    }

    return { metrics: newMetrics, introFlags, phaseCounters, moodScore: sessionState.moodScore || 0 };
}

// --- STATE MACHINE ---

/**
 * Determines the next state in the conversation flow.
 */
function getNextState(currentState, userMessage, metrics, sessionState) {
    if (!userMessage) return currentState;

    switch (currentState) {
        case STATES.INTRO:
            return isIntroGateSatisfied({ ...sessionState, metrics }) ? STATES.DISCOVERY : STATES.INTRO;
        case STATES.DISCOVERY:
            const needsGatePassed = sessionState.phaseGate?.needs?.passed ?? isNeedsGateSatisfied(sessionState.phaseCounters);
            return needsGatePassed ? STATES.PRESENTATION : STATES.DISCOVERY;
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
export function generateClientReplyForState(state, userMessage, sessionState, metrics = getInitialMetrics(), options = {}) {
    const { difficulty, clientType = 'new', industry } = sessionState;
    const { introGatePassed = false } = options;
    const introFlags = sessionState.introFlags || getInitialIntroFlags();
    let message = '';
    let mood = 'neutral';
    let reason = 'Čaká na ďalšie informácie.';

    const isNewClient = clientType === 'new';

    switch (state) {
        case STATES.INTRO:
            let introBase = '';
            if (isNewClient) {
                introBase = 'Dobrý deň, teší ma, že sa spoznávame. Rád si vypočujem, čo prinášate.';
                reason = 'Nový kontakt, neutrálne predstavenie.';
                if (sessionState.clientType === undefined) {
                  introBase = `${introBase} Aký cieľ a postup rozhovoru navrhujete?`;
                  reason = `${reason} Potrebujem jasný cieľ a postup.`;
                }
            } else {
                introBase = `Som rád, že nadväzujeme na naše minulé rozhovory o ${industry || 'vašej firme'}. Poďme pokračovať.`;
                reason = 'Pozná predchádzajúcu spoluprácu.';
            }
            const introResponse = applyMoodToIntroResponse(introBase, sessionState);
            message = introResponse.message;
            mood = introResponse.mood;
            reason = [reason, sessionState.lastMoodReason || introResponse.reason].filter(Boolean).join(' ');
            break;
        case STATES.DISCOVERY:
            if (introGatePassed) {
                message = 'Super. Tak poďme na vašu situáciu a priority, čo je teraz najdôležitejšie?';
                mood = 'interested';
                reason = 'Intro splnené, prechádza do zisťovania potrieb.';
            } else if (isNewClient) {
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
    let introFlags = getInitialIntroFlags();
    let moodScore = 0;
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
        const analysis = analyzeSalesMessage(msg, tempMetrics, currentState, { ...sessionState, introFlags, moodScore });
        tempMetrics = analysis.metrics;
        introFlags = analysis.introFlags;
        moodScore = introFlags._moodScore || moodScore;
        currentState = getNextState(currentState, msg, tempMetrics, { ...sessionState, introFlags });
    }
    sessionState.metrics = tempMetrics;
    sessionState.introFlags = introFlags;
    sessionState.moodScore = moodScore;
    
    return buildFinalFeedback(sessionState);
};
