const assert = require('assert');
const { test } = require('node:test');

const simulatorPromise = import('../kod/src/utils/salesSimulator.js');
const analyzerPromise = import('../kod/src/utils/salesAnalyzer.js');

function withFixedRandom(value, fn) {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

test('sessionState defaults to new client type when missing', async () => {
  const { generateClientReplyForState, STATES, getInitialMetrics } = await simulatorPromise;
  const sessionState = {
    difficulty: 'beginner',
    clientDiscType: 'D',
    industry: 'fintech',
    metrics: getInitialMetrics(),
    introFlags: {
      hasGoal: false,
      hasAgenda: false,
      hasOpenQuestion: false,
      hasConsentSignal: false,
      startedPitchTooEarly: false,
      longMonologue: false,
    },
    // intentionally no clientType
  };

  const response = withFixedRandom(0.9, () =>
    generateClientReplyForState(STATES.INTRO, '', sessionState)
  );

  assert.match(response.message, /cie\u013e|postup/i);
  assert.strictEqual(response.reason.includes('Potrebujem jasn\u00fd cie\u013e'), true);
});

test('detectSignalsIntro extracts intro signals and flags pitch issues', async () => {
  const { detectSignalsIntro, getInitialIntroFlags } = await simulatorPromise;
  const text = 'Dnes by som chcel jasne stanoviť cieľ, najprv agenda a potom demo. Prečo je to pre vás téma?';
  const signals = detectSignalsIntro(text, { introFlags: getInitialIntroFlags() });

  assert.strictEqual(signals.hasGoal, true);
  assert.strictEqual(signals.hasAgenda, true);
  assert.ok(signals.openQuestions >= 1);
  assert.strictEqual(signals.startedPitchTooEarly, false);

  const pitchText = 'Máme skvelý produkt a modul, ktorý vám pomôže. Toto je moja dlhá veta jedna. Toto je druhá. Toto je tretia. Toto je štvrtá. Toto je piata. Toto je šiesta.';
  const pitchSignals = detectSignalsIntro(pitchText, { introFlags: getInitialIntroFlags() });
  assert.strictEqual(pitchSignals.startedPitchTooEarly, true);
  assert.strictEqual(pitchSignals.longMonologue, true);
});

test('analyzeSalesmanTurn produces unified deltas for intro agenda + consent + open question', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text = 'Dnes by som chcel jasne stanoviť cieľ. Najprv prejdeme otázky, potom možnosti a na záver ďalší krok. Môžeme takto? Ako dnes vyzerá vaša situácia?';
  const analysis = analyzeSalesmanTurn({
    text,
    phase: 'intro',
    settings: { difficulty: 'beginner', client_type: 'new' },
    state: {},
  });

  assert.strictEqual(analysis.introFlagsDelta.goalFramed, true);
  assert.strictEqual(analysis.introFlagsDelta.agendaProposed, true);
  assert.strictEqual(analysis.introFlagsDelta.consentObtained, true);
  assert.strictEqual(analysis.introFlagsDelta.diagnosticStarted, true);
  assert.ok((analysis.metricDelta.questionsAsked || 0) >= 1);
  assert.ok((analysis.metricDelta.openQuestions || 0) >= 1);
  assert.strictEqual(analysis.moodDelta.delta, 1);
});

test('needs analyzer counts questions and open questions', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text = 'Aký je váš cieľ? Máte už riešenie? Ako dnes vyzerá proces? Kto je rozhodca? Funguje to?';
  const analysis = analyzeSalesmanTurn({ text, phase: 'needs' });

  assert.strictEqual(analysis.metricDelta.questionsAsked, 5);
  assert.strictEqual(analysis.metricDelta.openQuestions, 3);
});

test('needs analyzer detects summary and confirmation cues', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text = 'Ak to správne chápem, brzdí vás pomalý proces. Sedí to?';
  const analysis = analyzeSalesmanTurn({ text, phase: 'needs' });

  assert.strictEqual(analysis.phaseSignals.needs.summary, true);
  assert.strictEqual(analysis.phaseSignals.needs.confirm, true);
});

test('needs analyzer surfaces impact signals', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text = 'Aký dopad to má na tím a koľko času to stojí?';
  const analysis = analyzeSalesmanTurn({ text, phase: 'needs' });

  assert.strictEqual(analysis.phaseSignals.needs.impact, true);
});

test('needs analyzer identifies multiple needs statements', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text = 'Čo vás trápi najviac? Ktoré časti procesu vás brzdia a čo ešte nefunguje alebo chýba?';
  const analysis = analyzeSalesmanTurn({ text, phase: 'needs' });

  assert.ok((analysis.metricDelta.identifiedNeeds || 0) >= 2);
});

test('offer analyzer counts value statements and feature pitches distinctly', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const valueText =
    'Hovorili ste, že vás trápi manuálny reporting. Navrhujem automatizáciu follow-upov, ušetrí vám to čas tímu. ' +
    'Zníži to chyby v reporte a riziko oneskorenia. Pomôže vám to dosiahnuť cieľ rýchlejšej adaptácie.';
  const analysisValue = analyzeSalesmanTurn({ text: valueText, phase: 'offer' });

  assert.strictEqual(analysisValue.phaseSignals.offer.valueStatementsCount, 3);
  assert.strictEqual(analysisValue.phaseSignals.offer.featurePitchCount, 0);

  const featureText = 'Máme dashboard, integrácie a reporting pre pipeline. Funkcie zahŕňajú modul a automatizácie.';
  const analysisFeature = analyzeSalesmanTurn({ text: featureText, phase: 'offer' });

  assert.strictEqual(analysisFeature.phaseSignals.offer.valueStatementsCount, 0);
  assert.ok(analysisFeature.phaseSignals.offer.featurePitchCount >= 2);
});

test('offer analyzer detects bridge cues and reaction questions', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const bridgeText = 'Spomenuli ste chaos v procesoch, takže navrhujem zjednotenie. Ako to na vás pôsobí?';
  const analysis = analyzeSalesmanTurn({ text: bridgeText, phase: 'offer' });

  assert.strictEqual(analysis.phaseSignals.offer.bridgedFromNeeds, true);
  assert.strictEqual(analysis.phaseSignals.offer.reactionQuestion, true);
  assert.ok((analysis.metricDelta.openQuestions || 0) >= 1);
});

test('offer analyzer captures structure hit and metric deltas', async () => {
  const { analyzeSalesmanTurn } = await analyzerPromise;
  const text =
    'Ak to správne chápem, brzdí vás manuálny onboarding. Odporúčam zaviesť automatizáciu, ušetrí vám to čas a prinesie jasný výsledok. ' +
    'Ako to sedí na vašu situáciu?';
  const analysis = analyzeSalesmanTurn({ text, phase: 'offer' });

  assert.strictEqual(analysis.phaseSignals.offer.structureHit, true);
  assert.ok((analysis.metricDelta.valueStatements || 0) >= 1);
  assert.ok((analysis.metricDelta.questionsAsked || 0) >= 1);
  assert.ok((analysis.metricDelta.openQuestions || 0) >= 1);
});

test('unified analyzer catches early pitch monologue and blocks gate', async () => {
  const { analyzeSalesMessage, isIntroGateSatisfied, getInitialMetrics, getInitialIntroFlags, STATES } = await simulatorPromise;
  const pitchText = 'Máme skvelý produkt a modul, ktorý vám pomôže. Toto je moja dlhá veta jedna. Toto je druhá. Toto je tretia. Toto je štvrtá. Toto je piata. Toto je šiesta.';
  const sessionState = {
    difficulty: 'intermediate',
    clientType: 'new',
    clientDiscType: 'D',
    introFlags: getInitialIntroFlags(),
  };
  const { metrics, introFlags } = analyzeSalesMessage(pitchText, getInitialMetrics(), STATES.INTRO, sessionState);

  assert.strictEqual(introFlags.startedPitchTooEarly, true);
  assert.strictEqual(introFlags.longMonologue, true);
  assert.strictEqual(isIntroGateSatisfied({ metrics, introFlags }), false);
  assert.strictEqual(introFlags._moodScore < 0, true);
});

test('expert difficulty penalizes pitch monologue mood faster', async () => {
  const { analyzeSalesMessage, getInitialMetrics, getInitialIntroFlags, STATES } = await simulatorPromise;
  const pitchText = 'Predstavím vám produkt, modul a ponuku. Toto je dlhé rozprávanie bez otázok.';

  const beginnerAnalysis = analyzeSalesMessage(pitchText, getInitialMetrics(), STATES.INTRO, {
    difficulty: 'beginner',
    clientType: 'new',
    introFlags: getInitialIntroFlags(),
  });
  const expertAnalysis = analyzeSalesMessage(pitchText, getInitialMetrics(), STATES.INTRO, {
    difficulty: 'expert',
    clientType: 'new',
    introFlags: getInitialIntroFlags(),
  });

  assert.strictEqual((beginnerAnalysis.introFlags._moodScore || 0) > (expertAnalysis.introFlags._moodScore || 0), true);
});

test('intro gate evaluates required signals and blocks on pitch issues', async () => {
  const { isIntroGateSatisfied } = await simulatorPromise;

  const baseSession = {
    metrics: { questionsAsked: 1, openQuestions: 1 },
    introFlags: {
      hasGoal: true,
      hasAgenda: true,
      hasOpenQuestion: true,
      hasConsentSignal: true,
      startedPitchTooEarly: false,
      longMonologue: false,
    },
  };

  assert.strictEqual(isIntroGateSatisfied(baseSession), true);

  const blockedSession = {
    ...baseSession,
    introFlags: { ...baseSession.introFlags, startedPitchTooEarly: true },
  };
  assert.strictEqual(isIntroGateSatisfied(blockedSession), false);
});

test('new client responses stay general across states', async () => {
  const { generateClientReplyForState, STATES, getInitialMetrics } = await simulatorPromise;
  const sessionState = {
    difficulty: 'beginner',
    clientDiscType: 'I',
    clientType: 'new',
    industry: 'cloud',
    metrics: getInitialMetrics(),
    introFlags: {
      hasGoal: true,
      hasAgenda: true,
      hasOpenQuestion: false,
      hasConsentSignal: false,
      startedPitchTooEarly: false,
      longMonologue: false,
    },
  };

  const intro = generateClientReplyForState(STATES.INTRO, '', sessionState);
  const discovery = generateClientReplyForState(STATES.DISCOVERY, '', sessionState);
  const presentation = generateClientReplyForState(STATES.PRESENTATION, '', sessionState);
  const closing = generateClientReplyForState(STATES.CLOSING, '', sessionState);
  const finished = generateClientReplyForState(STATES.FINISHED, '', sessionState);

  assert.match(intro.message, /spozn\u00e1vame|pripraven/);
  assert.ok(!/nadv\u00e4zujeme/i.test(intro.message));
  assert.match(discovery.message, /aktu\u00e1lne priority|priestor na zlep\u0161enie/i);
  assert.match(presentation.message, /z\u00e1kladn\u00e9 benefity|pr\u00edklady z praxe/i);
  assert.match(closing.message, /premyslie\u0165|uisti\u0165/i);
  assert.match(finished.message, /Ozvem sa|prejdeme inform\u00e1cie/i);
});

test('repeat client responses reference history and personalization', async () => {
  const { generateClientReplyForState, STATES, getInitialMetrics } = await simulatorPromise;
  const sessionState = {
    difficulty: 'intermediate',
    clientDiscType: 'S',
    clientType: 'repeat',
    industry: 'logistika',
    metrics: getInitialMetrics(),
    introFlags: {
      hasGoal: true,
      hasAgenda: true,
      hasOpenQuestion: false,
      hasConsentSignal: false,
      startedPitchTooEarly: false,
      longMonologue: false,
    },
  };

  const intro = generateClientReplyForState(STATES.INTRO, '', sessionState);
  const discovery = generateClientReplyForState(STATES.DISCOVERY, '', sessionState);
  const presentation = generateClientReplyForState(STATES.PRESENTATION, '', sessionState);
  const closing = generateClientReplyForState(STATES.CLOSING, '', sessionState);
  const finished = generateClientReplyForState(STATES.FINISHED, '', sessionState);

  assert.match(intro.message, /nadv\u00e4zujeme|minul/);
  assert.match(discovery.message, /Minule ste spom\u00ednali/);
  assert.match(presentation.message, /nadvia\u017eeme|nadvia[zs]ali na predch\u00e1dzaj\u00face/i);
  assert.match(closing.message, /doteraj\u0161iu spolupr\u00e1cu|minule|naposledy/i);
  assert.match(finished.message, /doteraj\u0161iu spolupr\u00e1cu|pokra\u010duvali/i);
});

test('objections differ for new vs repeat clients', async () => {
  const { generateClientReplyForState, STATES, getInitialMetrics } = await simulatorPromise;

  const newSession = {
    difficulty: 'beginner',
    clientDiscType: 'C',
    clientType: 'new',
    metrics: getInitialMetrics(),
  };
  const repeatSession = {
    difficulty: 'expert',
    clientDiscType: 'D',
    clientType: 'repeat',
    metrics: getInitialMetrics(),
  };

  const newObjection = withFixedRandom(0.01, () =>
    generateClientReplyForState(STATES.OBJECTIONS, '', newSession)
  );
  const repeatObjection = withFixedRandom(0.01, () =>
    generateClientReplyForState(STATES.OBJECTIONS, '', repeatSession)
  );

  assert.match(newObjection.message, /drah\u00e9|premyslie\u0165|potrebujeme/i);
  assert.match(repeatObjection.message, /minule|konkurenc|ROI|projektu/i);
});

test('feedback for repeat clients adds history and adaptation dimensions', async () => {
  const { buildFinalFeedback } = await simulatorPromise;
  const sessionState = {
    clientDiscType: 'I',
    clientType: 'repeat',
    metrics: {
      questionsAsked: 3,
      openQuestions: 2,
      needsIdentified: 2,
      valueStatements: 3,
      objectionHandlingAttempts: 2,
      objectionsHandledWell: 1,
      closingAttempts: 1,
      adaptationToDISC: 2,
    },
  };

  const feedback = buildFinalFeedback(sessionState);
  const dimensionNames = feedback.dimensions.map((d) => d.name);

  assert.ok(dimensionNames.includes('Pr\u00e1ca s hist\u00f3riou'));
  assert.ok(dimensionNames.includes('Adapt\u00e1cia na existuj\u00faceho klienta'));
  assert.ok(feedback.score >= 1 && feedback.score <= 10);
});

test('starting mood respects difficulty and DISC bias', async () => {
  const { getStartingMoodLevel } = await simulatorPromise;

  assert.strictEqual(getStartingMoodLevel({ difficulty: 'beginner', clientDiscType: 'I' }), 3);
  assert.strictEqual(getStartingMoodLevel({ difficulty: 'expert', clientDiscType: 'D' }), 2);
  assert.strictEqual(getStartingMoodLevel({ difficulty: 'expert', clientDiscType: 'S' }), 3);
});

test('intro mood updates by +1 or -1 based on signals', async () => {
  const { updateMoodIntro } = await simulatorPromise;

  const moodUp = updateMoodIntro(2, { openQuestion: true }, { difficulty: 'expert', clientDiscType: 'C' });
  assert.strictEqual(moodUp.moodLevel, 3);

  const moodDown = updateMoodIntro(3, { longMonologue: true }, { difficulty: 'beginner', clientDiscType: 'I' });
  assert.strictEqual(moodDown.moodLevel, 2);
});

test('intro replies react to mood level length and stop cues', async () => {
  const { generateClientReplyForState, STATES } = await simulatorPromise;

  const neutral = generateClientReplyForState(STATES.INTRO, '', { clientType: 'new', moodLevel: 3, lastMoodReason: '\u0161tart' });
  const guarded = generateClientReplyForState(STATES.INTRO, '', { clientType: 'new', moodLevel: 1, lastMoodReason: 'tlak' });
  const upbeat = generateClientReplyForState(STATES.INTRO, '', { clientType: 'new', moodLevel: 5, lastMoodReason: 'otvoren\u00e1 ot\u00e1zka' });

  assert.ok(guarded.message.length < neutral.message.length);
  assert.ok(/Po\u010fme k veci|skr\u00e1\u0165me/i.test(guarded.message));
  assert.ok(upbeat.message.length > neutral.message.length);
  assert.ok(/\?/.test(upbeat.message));
});

test('intro feedback surfaces strengths and improvements', async () => {
  const { generateIntroFeedback } = await simulatorPromise;

  const feedback = generateIntroFeedback({
    metrics: { openQuestions: 1, questionsAsked: 1 },
    moodLevel: 4,
    lastIntroSignals: { goalAgendaConcise: true, openQuestion: true },
    clientType: 'repeat',
    clientDiscType: 'S',
  });

  assert.strictEqual(feedback.verdict, 'splnen\u00e1');
  assert.ok(feedback.strengths.length <= 2 && feedback.strengths.length >= 1);
  assert.ok(feedback.improvements.length <= 2);
  assert.ok(feedback.recommendedLine.length > 5);
  assert.ok(feedback.discNote);
});
