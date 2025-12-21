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
    // intentionally no clientType
  };

  const response = withFixedRandom(0.9, () =>
    generateClientReplyForState(STATES.INTRO, '', sessionState)
  );

  assert.match(response.message, /spozn\u00e1vame/i);
  assert.strictEqual(response.reason.includes('Nov\u00fd kontakt'), true);
});

test('new client responses stay general across states', async () => {
  const { generateClientReplyForState, STATES, getInitialMetrics } = await simulatorPromise;
  const sessionState = {
    difficulty: 'beginner',
    clientDiscType: 'I',
    clientType: 'new',
    industry: 'cloud',
    metrics: getInitialMetrics(),
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
