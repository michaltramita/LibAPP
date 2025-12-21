const OPEN_QUESTION_REGEX = /(\bako\b|\bprečo\b|\bčo\b|\bkde\b|\bkedy\b|\bktor\w*\b|\bpre ktor\w*\b|\bakým spôsobom\b|\bak\w*\b)[^?]*\?/gi;

const GOAL_PHRASES = ['cieľ', 'dôvod', 'účel', 'chcel by som dosiahnuť', 'dnes by som chcel', 'chceme dosiahnuť'];
const AGENDA_PHRASES = ['najprv', 'potom', 'na záver', 'agenda', 'postup', 'struktúru'];
const CONSENT_PHRASES = ['môžeme takto', 'môžeme začať', 'je to ok', 'je to okej', 'sedí vám', 'je to v poriadku', 'ste za'];
const EXPLANATION_PHRASES = ['aby som vedel', 'aby som vedela', 'aby som mohol', 'aby som mohla', 'chcem pochopiť', 'potrebujem vedieť'];
const PRESSURE_PHRASES = ['musíme rozhodnúť dnes', 'potrebujem potvrdiť hneď', 'do konca dňa', 'ihneď potvrdiť', 'okamžite rozhodnúť'];
const PRODUCT_PHRASES = ['produkt', 'funkci', 'modul', 'ponuku', 'cena', 'licenc', 'demo', 'riešenie', 'feature', 'ponuka'];
const VALUE_PHRASES = ['zlepšiť', 'ušetriť', 'benefit', 'výhoda', 'výsledok', 'hodnota'];
const IMPACT_PHRASES = ['dopad', 'vplyv', 'koľko stojí', 'koľko to stojí', 'koľko nás stojí', 'náklad', 'cost', 'strácate', 'strata'];
const SUMMARY_PHRASES = ['zhrniem', 'zhrňme', 'zhrnutie', 'sumarizujem', 'v skratke', 'ak to zhrniem'];
const CONFIRM_PHRASES = ['sedí to', 'je to tak', 'rozumiem správne', 'chápem správne', 'je to správne', 'potvrdíte', 'pasuje to'];
const FOLLOW_UP_PHRASES = ['ako ste spomenuli', 'ako ste vraveli', 'spomínali ste', 'nadviažem', 'nadväzujem'];
const CERTAINTY_PHRASES = ['garantujeme', 'určite'];

const NEED_PHRASES = ['trápi', 'brzdí', 'problém', 'potrebujete', 'cieľ', 'nefunguje', 'chýba', 'naráža'];
const BASE_IMPACT_PHRASES = ['dopad', 'čo to spôsobuje', 'koľko času', 'koľko stojí', 'riziko', 'chyby', 'dopad na tím', 'dopad na ľudí'];
const POTREBY_IMPACT_PHRASES = ['aký dopad', 'aké dopady'];
const IMPACT_PHRASES = [...new Set([...BASE_IMPACT_PHRASES, ...POTREBY_IMPACT_PHRASES])];
const SUMMARY_PHRASES = ['ak to správne chápem', 'zhrniem', 'čiže', 'rozumiem tomu tak'];
const CONFIRM_PHRASES = ['sedí to?', 'je to tak?', 'chápem správne?', 'súhlasí?'];
const FOLLOW_UP_PHRASES = ['spomenuli ste', 'hovorili ste', 'vraveli ste', 'keď ste povedali', 'k tomu'];
const EARLY_PITCH_PHRASES = ['ponúkame', 'naše riešenie', 'produkt', 'balík', 'implementácia', 'cenník', 'demo'];
const OPEN_STARTERS = ['ako', 'čo', 'prečo', 'kedy', 'kde', 'kto', 'aký', 'koľko', 'ktor'];

const DISC_SIGNALS = {
  D: ['roi', 'výsledok', 'výsledky', 'termín', 'tempo'],
  C: ['dáta', 'parametre', 'analýza', 'presnosť', 'compliance'],
  S: ['podpora', 'bezpečnosť', 'bezpečné', 'stabilita', 'tím'],
  I: ['ľudia', 'spolupráca', 'tím', 'partnerstvo', 'energia'],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeQuestion = (text = '') => (text || '').toLowerCase().replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();

const isSimilarQuestion = (prev = '', current = '') => {
  if (!prev || !current) return false;
  const a = normalizeQuestion(prev);
  const b = normalizeQuestion(current);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.75) return true;
  }

  const aTokens = new Set(a.split(' '));
  const bTokens = new Set(b.split(' '));
  const intersection = [...aTokens].filter((t) => bTokens.has(t));
  const overlap = intersection.length / Math.max(1, Math.min(aTokens.size, bTokens.size));
  return overlap >= 0.7;
};

function deriveMoodDelta(signals, difficulty) {
  const positiveReasons = [];
  const negativeReasons = [];

  if (signals.clearAgenda) positiveReasons.push('clear_agenda');
  if (signals.hasOpenQuestion) positiveReasons.push('open_question');
  if (signals.explainsWhyAsking) positiveReasons.push('explains_why');

  if (signals.earlyPitch) negativeReasons.push('early_pitch');
  if (signals.isLongMonologue) negativeReasons.push('monologue');
  if (signals.hasPressure) negativeReasons.push('pressure');
  if (signals.discMismatch) negativeReasons.push('disc_mismatch');
  if (difficulty === 'expert' && (signals.earlyPitch || signals.isLongMonologue)) {
    negativeReasons.push('expert_fast_penalty');
  }
  if (difficulty === 'beginner' && (signals.clearAgenda || signals.hasOpenQuestion)) {
    positiveReasons.push('beginner_bonus');
  }

  const moodBias = difficulty === 'beginner' ? 1 : difficulty === 'expert' ? -1 : 0;
  const raw = positiveReasons.length - negativeReasons.length + moodBias;
  const delta = raw > 0 ? 1 : raw < 0 ? -1 : 0;
  const reasons = delta > 0 ? positiveReasons : delta < 0 ? negativeReasons : [...positiveReasons, ...negativeReasons];

  return { delta: clamp(delta, -1, 1), reasons };
}

function detectIntroSignals(text) {
  const lowerMessage = (text || '').toLowerCase();
  const sentences = (text || '').split(/[.!?]/).filter((part) => part.trim().length > 0);
  const questionsAsked = ((text || '').match(/\?/g) || []).length;

  let openQuestions = ((text || '').match(OPEN_QUESTION_REGEX) || []).length;
  const openQuestionPhrases = ['povedzte mi', 'ako dnes'];
  if (openQuestionPhrases.some((phrase) => lowerMessage.includes(phrase))) {
    openQuestions = Math.max(openQuestions, 1);
  }

  const hasGoalFraming = GOAL_PHRASES.some((word) => lowerMessage.includes(word));
  const hasAgenda = AGENDA_PHRASES.some((word) => lowerMessage.includes(word));
  const asksForConsent = CONSENT_PHRASES.some((phrase) => lowerMessage.includes(phrase));
  const explainsWhyAsking = EXPLANATION_PHRASES.some((phrase) => lowerMessage.includes(phrase));

  const earlyPitch = PRODUCT_PHRASES.some((word) => lowerMessage.includes(word)) && openQuestions === 0;
  const isLongMonologue = sentences.length >= 6 && questionsAsked === 0;
  const hasPressure = PRESSURE_PHRASES.some((phrase) => lowerMessage.includes(phrase));
  const clearAgenda = hasAgenda && sentences.length <= 3 && !earlyPitch;

  const valueStatements = VALUE_PHRASES.some((phrase) => lowerMessage.includes(phrase)) ? 1 : 0;

  return {
    signals: {
      hasQuestion: questionsAsked > 0,
      hasOpenQuestion: openQuestions > 0,
      hasGoalFraming,
      hasAgenda,
      asksForConsent,
      diagnosticQuestion: openQuestions > 0,
      earlyPitch,
      isLongMonologue,
      hasPressure,
      clearAgenda,
      explainsWhyAsking,
      valueStatements,
      questionCount: questionsAsked,
      openQuestionCount: openQuestions,
      discMismatch: false,
    },
    valueStatements,
  };
}

export function analyzeSalesmanTurn({ text = '', phase = 'intro', settings = {}, state = {} }) {
  const normalizedText = text || '';
  const difficulty = settings.difficulty || state.difficulty || 'intermediate';
  const clientType = settings.client_type || settings.clientType || state.clientType || 'new';
  const discProfile = settings.disc || settings.clientDiscType || state.clientDiscType;
  const phaseCounters = state.phaseCounters || settings.phaseCounters;

  if (phase !== 'intro') {
    if (phase === 'needs') {
      const lowerMessage = normalizedText.toLowerCase();
      const questionsAsked = ((normalizedText || '').match(/\?/g) || []).length;
      const openQuestions = ((normalizedText || '').match(OPEN_QUESTION_REGEX) || []).length;
      const hasFollowUp = FOLLOW_UP_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const explainsPurpose = EXPLANATION_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const identifiedNeeds = (lowerMessage.match(/potreb|probl[eé]m|výzva|priorit[ay]?/g) || []).length > 0 ? 1 : 0;
      const impactExplored = IMPACT_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const summarySignal = SUMMARY_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const confirmSignal = CONFIRM_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const currentQuestion = normalizedText.split('?')[0] && normalizedText.includes('?') ? normalizedText.split('?')[0] + '?' : '';
      const repeatQuestion = isSimilarQuestion(phaseCounters?.needs?.lastQuestion, currentQuestion);
      const earlyPitch = PRODUCT_PHRASES.some((word) => lowerMessage.includes(word));
      const sentenceCount = (normalizedText || '').split(/[.!?]/).filter((p) => p.trim()).length;
      const hasPressure = PRESSURE_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const longMonologue = sentenceCount >= 5 && questionsAsked === 0;
      const certaintyClaim = CERTAINTY_PHRASES.some((phrase) => lowerMessage.includes(phrase));
      const supportedClaim = /(dát|dôkaz|referenc|príklad|case study|údaj|merani)/.test(lowerMessage);

      const needsCounters = {
        ...(phaseCounters?.needs || {}),
      };

      needsCounters.askedQuestions = (needsCounters.askedQuestions || 0) + questionsAsked;
      needsCounters.openQuestions = (needsCounters.openQuestions || 0) + openQuestions;
      needsCounters.identifiedNeeds = (needsCounters.identifiedNeeds || 0) + identifiedNeeds;
      needsCounters.followUps = (needsCounters.followUps || 0) + (hasFollowUp ? 1 : 0);
      needsCounters.impactFound = needsCounters.impactFound || impactExplored;
      needsCounters.summaryFound = needsCounters.summaryFound || summarySignal;
      needsCounters.confirmFound = needsCounters.confirmFound || confirmSignal;
      needsCounters.earlyPitch = needsCounters.earlyPitch || earlyPitch;
      if (currentQuestion) {
        needsCounters.lastQuestion = normalizeQuestion(currentQuestion);
      }

      const phaseGateReasons = [];
      const gatePassed =
        needsCounters.askedQuestions >= 5 &&
        needsCounters.openQuestions >= 3 &&
        needsCounters.identifiedNeeds >= 2 &&
        needsCounters.impactFound === true &&
        needsCounters.summaryFound === true &&
        needsCounters.confirmFound === true &&
        needsCounters.earlyPitch !== true;

      if (!gatePassed) {
        if (needsCounters.askedQuestions < 5) phaseGateReasons.push('chýba dostatok otázok');
        if (needsCounters.openQuestions < 3) phaseGateReasons.push('málo otvorených otázok');
        if (needsCounters.identifiedNeeds < 2) phaseGateReasons.push('neidentifikované potreby');
        if (!needsCounters.impactFound) phaseGateReasons.push('chýba dopad');
        if (!needsCounters.summaryFound) phaseGateReasons.push('chýba zhrnutie');
        if (!needsCounters.confirmFound) phaseGateReasons.push('chýba potvrdenie');
        if (needsCounters.earlyPitch) phaseGateReasons.push('príliš skorý pitch');
      }

      const moodReasons = [];
      let moodDeltaValue = 0;

      if (hasFollowUp) {
        moodDeltaValue += 1;
        moodReasons.push('follow_up_found');
      }
      if (impactExplored) {
        moodDeltaValue += 1;
        moodReasons.push('impact_found');
      }
      if (explainsPurpose) {
        moodDeltaValue += 1;
        moodReasons.push('question_purpose');
      }
      if (summarySignal && confirmSignal) {
        moodDeltaValue += 1;
        moodReasons.push('summary_and_confirm');
      }
      if (earlyPitch && !gatePassed) {
        const penalty = difficulty === 'expert' ? -2 : -1;
        moodDeltaValue += penalty;
        moodReasons.push(difficulty === 'expert' ? 'early_pitch_expert' : 'early_pitch');
      }
      if (repeatQuestion) {
        moodDeltaValue -= 1;
        moodReasons.push('repeat_question');
      }

      if (discProfile === 'D' && longMonologue) {
        moodDeltaValue -= 1;
        moodReasons.push('disc_d_monologue');
      }
      if (discProfile === 'C' && certaintyClaim && !supportedClaim) {
        moodDeltaValue -= 1;
        moodReasons.push('disc_c_unsupported_certainty');
      }
      if (discProfile === 'S' && hasPressure) {
        moodDeltaValue -= 1;
        moodReasons.push('disc_s_pressure');
      }

      const moodDelta = {
        delta: clamp(moodDeltaValue, -3, 3),
        reasons: moodReasons,
      };

      const metricDelta = {
        questionsAsked,
        openQuestions,
        needsIdentified: identifiedNeeds,
        valueStatements: VALUE_PHRASES.some((phrase) => lowerMessage.includes(phrase)) ? 1 : 0,
      };

      const notes = [
        `needs/questions=${questionsAsked}`,
        `needs/openQuestions=${openQuestions}`,
        `needs/impact=${impactExplored}`,
        `needs/summary=${summarySignal}`,
        `needs/confirm=${confirmSignal}`,
        `needs/followUp=${hasFollowUp}`,
      ];

      return {
        signals: {
          questionsAsked,
          openQuestions,
          followUp: hasFollowUp,
          impactExplored,
          summarySignal,
          confirmSignal,
          repeatQuestion,
          explainsPurpose,
          earlyPitch,
          longMonologue,
          pressure: hasPressure,
        },
        metricDelta,
        introFlagsDelta: {},
        moodDelta,
        phaseCounters: { needs: needsCounters },
        phaseGate: { needs: { passed: gatePassed, reasons: phaseGateReasons } },
        notes,
      };
    }

    return {
      signals: {},
      metricDelta: {},
      introFlagsDelta: {},
      moodDelta: { delta: 0, reasons: [] },
      phaseSignals: {},
      notes: ['No analyzer implemented for this phase'],
    };
  }

  const { signals, valueStatements } = detectIntroSignals(normalizedText);

  let adaptationDelta = 0;
  if (clientType === 'repeat' && discProfile && DISC_SIGNALS[discProfile]) {
    if (DISC_SIGNALS[discProfile].some((word) => normalizedText.toLowerCase().includes(word))) {
      adaptationDelta += 1;
    }
  } else if (clientType === 'new' && signals.hasAgenda && !signals.earlyPitch) {
    adaptationDelta += 1;
  }

  const introFlagsDelta = {
    goalFramed: signals.hasGoalFraming,
    agendaProposed: signals.hasAgenda,
    consentObtained: signals.asksForConsent,
    diagnosticStarted: signals.hasOpenQuestion,
    earlyPitchDetected: signals.earlyPitch,
    longMonologue: signals.isLongMonologue,
  };

  const metricDelta = {
    questionsAsked: signals.questionCount,
    openQuestions: signals.openQuestionCount,
    valueStatements,
    objectionHandlingAttempts: 0,
    objectionsHandledWell: 0,
    closingAttempts: 0,
    needsIdentified: 0,
    adaptationToDISC: adaptationDelta,
  };

  const moodDelta = deriveMoodDelta(signals, difficulty);
  const notes = [
    `intro/questions=${signals.questionCount}`,
    `intro/openQuestions=${signals.openQuestionCount}`,
    `intro/agenda=${signals.hasAgenda}`,
    `intro/goal=${signals.hasGoalFraming}`,
    `intro/consent=${signals.asksForConsent}`,
    `intro/pressure=${signals.hasPressure}`,
  ];

  return { signals, metricDelta, introFlagsDelta, moodDelta, phaseSignals: {}, notes };
}

function detectNeedsSignals(text = '', settings = {}, state = {}) {
  const normalizedText = text || '';
  const lower = normalizedText.toLowerCase();
  const questionsAsked = (normalizedText.match(/\?/g) || []).length;
  const questionParts = normalizedText.split('?').map((part) => part.trim()).filter(Boolean);

  let openQuestions = 0;
  questionParts.forEach((part) => {
    const lowerPart = part.toLowerCase();
    const startsWithOpen = OPEN_STARTERS.some((starter) => lowerPart.startsWith(starter));
    const containsOpenCue =
      /\bčo presne\b|\bako dnes\b|\baký dopad\b|\bpodľa čoho\b|\bkto bude\b/i.test(lowerPart);
    const matchesOpenPattern = new RegExp(OPEN_QUESTION_REGEX.source, 'gi').test(`${part}?`);
    if (startsWithOpen || containsOpenCue || matchesOpenPattern) {
      openQuestions += 1;
    }
  });

  const needMatches = NEED_PHRASES.filter((phrase) => lower.includes(phrase)).length;
  const impactDetected = IMPACT_PHRASES.some((phrase) => lower.includes(phrase));
  const summaryDetected = SUMMARY_PHRASES.some((phrase) => lower.includes(phrase));
  const confirmDetected = CONFIRM_PHRASES.some((phrase) => lower.includes(phrase));
  const followUpDetected = FOLLOW_UP_PHRASES.some((phrase) => lower.includes(phrase));
  const earlyPitch = EARLY_PITCH_PHRASES.some((phrase) => lower.includes(phrase));

  const adaptationDelta = followUpDetected || summaryDetected || confirmDetected ? 1 : 0;

  const needsSignals = {
    questions: questionsAsked > 0,
    questionCount: questionsAsked,
    openQuestionCount: openQuestions,
    openQuestions: openQuestions > 0,
    needs: needMatches > 0,
    needsCount: needMatches,
    impact: impactDetected,
    summary: summaryDetected,
    confirm: confirmDetected,
    followUp: followUpDetected,
    earlyPitch,
    discAdaptation: adaptationDelta > 0,
  };

  const metricDelta = {
    askedQuestions: questionsAsked,
    questionsAsked,
    openQuestions: openQuestions,
    identifiedNeeds: needMatches,
    discAdaptation: adaptationDelta,
    adaptationToDISC: adaptationDelta,
  };

  return { needsSignals, metricDelta };
}

export function deriveMoodFromScore(score) {
  if (score >= 2) return 'positive';
  if (score === 1) return 'interested';
  if (score === 0) return 'neutral';
  if (score <= -2) return 'negative';
  return 'skeptical';
}

export function updateMoodScore(previousScore = 0, delta = 0) {
  return clamp(previousScore + delta, -3, 3);
}
