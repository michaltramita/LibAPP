const assert = require('assert');
const { test } = require('node:test');

const simulatorPromise = import('../kod/src/utils/salesSimulator.js');

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
