const OPEN_QUESTION_REGEX = /(\bako\b|\bprečo\b|\bčo\b|\bkde\b|\bkedy\b|\bktor\w*\b|\bpre ktor\w*\b|\bakým spôsobom\b|\bak\w*\b)[^?]*\?/gi;

const GOAL_PHRASES = ['cieľ', 'dôvod', 'účel', 'chcel by som dosiahnuť', 'dnes by som chcel', 'chceme dosiahnuť'];
const AGENDA_PHRASES = ['najprv', 'potom', 'na záver', 'agenda', 'postup', 'struktúru'];
const CONSENT_PHRASES = ['môžeme takto', 'môžeme začať', 'je to ok', 'je to okej', 'sedí vám', 'je to v poriadku', 'ste za'];
const EXPLANATION_PHRASES = ['aby som vedel', 'aby som vedela', 'aby som mohol', 'aby som mohla', 'chcem pochopiť', 'potrebujem vedieť'];
const PRESSURE_PHRASES = ['musíme rozhodnúť dnes', 'potrebujem potvrdiť hneď', 'do konca dňa', 'ihneď potvrdiť', 'okamžite rozhodnúť'];
const PRODUCT_PHRASES = ['produkt', 'funkci', 'modul', 'ponuku', 'cena', 'licenc', 'demo', 'riešenie', 'feature', 'ponuka'];
const VALUE_PHRASES = ['zlepšiť', 'ušetriť', 'benefit', 'výhoda', 'výsledok', 'hodnota'];

const NEED_PHRASES = ['trápi', 'brzdí', 'problém', 'potrebujete', 'cieľ', 'nefunguje', 'chýba', 'naráža'];
const IMPACT_PHRASES = ['dopad', 'čo to spôsobuje', 'koľko času', 'koľko stojí', 'riziko', 'chyby', 'dopad na tím', 'dopad na ľudí'];
const SUMMARY_PHRASES = ['ak to správne chápem', 'zhrniem', 'čiže', 'rozumiem tomu tak'];
const CONFIRM_PHRASES = ['sedí to?', 'je to tak?', 'chápem správne?', 'súhlasí?'];
const FOLLOW_UP_PHRASES = ['spomenuli ste', 'hovorili ste', 'vraveli ste', 'keď ste povedali', 'k tomu'];
const EARLY_PITCH_PHRASES = ['ponúkame', 'naše riešenie', 'produkt', 'balík', 'implementácia', 'cenník', 'demo'];
const OPEN_STARTERS = ['ako', 'čo', 'prečo', 'kedy', 'kde', 'kto', 'aký', 'koľko', 'ktor'];
const OFFER_BRIDGE_PHRASES = ['hovorili ste, že', 'spomenuli ste', 'ako ste vraveli', 'ak to správne chápem'];
const OFFER_REACTION_QUESTIONS = [
  'ako to na vás pôsobí',
  'ako to sedí',
  'čo na to hovoríte',
  'čo by ste k tomu potrebovali vedieť',
  'čo je pre vás najdôležitejšie',
  'sedí to?',
];
const OFFER_FEATURE_KEYWORDS = ['dashboard', 'integráci', 'reporting', 'pipeline', 'automatizáci', 'modul', 'funkci', 'feature'];
const OFFER_BENEFIT_KEYWORDS = ['ušetr', 'zníž', 'zlepší', 'pomôž', 'benefit', 'prínos', 'hodnot', 'výsled', 'dopad', 'riziko', 'chyby', 'úspech'];
const OFFER_PROPOSAL_CUES = ['navrhujem', 'riešenie je', 'odporúčam', 'môžeme', 'môj návrh', 'ponúk'];

const DISC_SIGNALS = {
  D: ['roi', 'výsledok', 'výsledky', 'termín', 'tempo'],
  C: ['dáta', 'parametre', 'analýza', 'presnosť', 'compliance'],
  S: ['podpora', 'bezpečnosť', 'bezpečné', 'stabilita', 'tím'],
  I: ['ľudia', 'spolupráca', 'tím', 'partnerstvo', 'energia'],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

  if (phase !== 'intro') {
    if (phase === 'needs' || phase === 'discovery') {
      const { needsSignals, metricDelta } = detectNeedsSignals(normalizedText, settings, state);
      return {
        signals: needsSignals,
        metricDelta,
        introFlagsDelta: {},
        moodDelta: { delta: 0, reasons: [] },
        phaseSignals: { needs: needsSignals },
        notes: [
          `needs/questions=${needsSignals.questionCount || 0}`,
          `needs/openQuestions=${needsSignals.openQuestionCount || 0}`,
          `needs/identified=${needsSignals.needsCount || 0}`,
          `needs/impact=${needsSignals.impact || false}`,
        ],
      };
    }

    if (phase === 'offer' || phase === 'presentation') {
      const { offerSignals, metricDelta } = detectOfferSignals(normalizedText);
      return {
        signals: {},
        metricDelta,
        introFlagsDelta: {},
        moodDelta: { delta: 0, reasons: [] },
        phaseSignals: { offer: offerSignals },
        notes: [
          `offer/value=${offerSignals.valueStatementsCount || 0}`,
          `offer/features=${offerSignals.featurePitchCount || 0}`,
          `offer/reactionQ=${offerSignals.reactionQuestion || false}`,
        ],
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

function detectOfferSignals(text = '') {
  const normalizedText = text || '';
  const lower = normalizedText.toLowerCase();
  const sentences = normalizedText
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const questionCount = (normalizedText.match(/\?/g) || []).length;
  const openQuestionMatches = normalizedText.match(OPEN_QUESTION_REGEX) || [];
  let valueStatementsCount = 0;
  let featurePitchCount = 0;

  sentences.forEach((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    const hasBenefitCue = OFFER_BENEFIT_KEYWORDS.some((kw) => lowerSentence.includes(kw));
    const tiesToNeed =
      NEED_PHRASES.some((kw) => lowerSentence.includes(kw)) ||
      OFFER_BRIDGE_PHRASES.some((kw) => lowerSentence.includes(kw)) ||
      /\bv(a|á)m\b|\bv(a|á)š\b|\bv(a|á)še\b/.test(lowerSentence);
    const hasFeatureCue = OFFER_FEATURE_KEYWORDS.some((kw) => lowerSentence.includes(kw));
    if (hasBenefitCue) {
      valueStatementsCount += 1;
    } else if (hasFeatureCue && !hasBenefitCue && !tiesToNeed) {
      featurePitchCount += 1;
    }
  });

  const bridgedFromNeeds = OFFER_BRIDGE_PHRASES.some((phrase) => lower.includes(phrase));
  const reactionQuestion = OFFER_REACTION_QUESTIONS.some((phrase) => lower.includes(phrase));

  const needReference = bridgedFromNeeds || NEED_PHRASES.some((phrase) => lower.includes(phrase));
  const proposalCue = OFFER_PROPOSAL_CUES.some((phrase) => lower.includes(phrase));
  const benefitCue = valueStatementsCount > 0 || OFFER_BENEFIT_KEYWORDS.some((kw) => lower.includes(kw));
  const structureHit = needReference && proposalCue && benefitCue;

  const questionDelta = reactionQuestion ? Math.max(questionCount, 1) : questionCount;
  const openQuestionDelta = reactionQuestion ? Math.max(openQuestionMatches.length, 1) : openQuestionMatches.length;

  const offerSignals = {
    valueStatementsCount,
    featurePitchCount,
    bridgedFromNeeds,
    reactionQuestion,
    structureHit,
  };

  const metricDelta = {
    valueStatements: valueStatementsCount,
    questionsAsked: questionDelta,
    openQuestions: openQuestionDelta,
  };

  return { offerSignals, metricDelta };
}
