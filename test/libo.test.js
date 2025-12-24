const assert = require('assert');
const { test } = require('node:test');
const { searchContext } = require('../api/lib/rag');
const { resolveNavigate, executeTool } = require('../kod/src/utils/liboTools.js');

test('resolveNavigate whitelists routes', () => {
  assert.strictEqual(resolveNavigate('/dashboard'), '/dashboard');
  assert.strictEqual(resolveNavigate('/settings/security'), '/settings/security');
  assert.strictEqual(resolveNavigate('/unknown'), '/dashboard');
});

test('executeTool calls navigate for navigate tool', () => {
  let called = null;
  executeTool({ tool: 'navigate', args: { route: '/dashboard' }, navigate: (r) => { called = r; } });
  assert.strictEqual(called, '/dashboard');
});

test('RAG returns LibApp docs sorted by keyword hits', () => {
  const results = searchContext('obchodný rozhovor námietka ceny', 1);
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].id, 'obchodny-rozhovor');
});

test('LLM client returns fallback when disabled', async () => {
  process.env.LIBO_AI_ENABLED = 'false';
  delete require.cache[require.resolve('../api/lib/llmClient')];
  const { createLLMClient } = require('../api/lib/llmClient');
  const llm = createLLMClient();
  const iterator = llm.streamChat({ messages: [{ role: 'user', content: 'hi' }] });
  const { value } = await iterator.next();
  assert.strictEqual(value.type, 'final');
  assert.ok(value.content.includes('nedostupná'));
});

async function loadLLMClientWithMockOpenAI(mockIterableFactory, options = {}) {
  // mock openai module
  delete require.cache[require.resolve('openai')];
  require.cache[require.resolve('openai')] = {
    exports: function MockOpenAI() {
      this.chat = {
        completions: {
          create: async () => {
            if (options.throwOnCreate) throw options.throwOnCreate;
            return mockIterableFactory();
          },
        },
      };
    },
  };
  process.env.LIBO_AI_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/lib/llmClient')];
  return require('../api/lib/llmClient').createLLMClient();
}

test('LLM client emits final for any finish_reason', async () => {
  const reasons = ['stop', 'tool_calls', 'length', 'content_filter'];

  for (const reason of reasons) {
    const llm = await loadLLMClientWithMockOpenAI(async function* () {
      yield { choices: [{ delta: { content: 'A' }, finish_reason: null }] };
      yield { choices: [{ delta: {}, finish_reason: reason }] };
    });

    const chunks = [];
    for await (const part of llm.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) {
      chunks.push(part);
    }

    const finals = chunks.filter((c) => c.type === 'final');
    assert.strictEqual(finals.length, 1, `Expected one final for reason ${reason}`);
    assert.strictEqual(chunks[chunks.length - 1].type, 'final');
  }
});

test('LLM client returns fallback when OpenAI call fails', async () => {
  const llm = await loadLLMClientWithMockOpenAI(async function* () {}, { throwOnCreate: new Error('network down') });

  const iterator = llm.streamChat({ messages: [{ role: 'user', content: 'hi' }] });
  const { value } = await iterator.next();

  assert.strictEqual(value.type, 'final');
  assert.ok(value.content.includes('nedostupná'));
});

test('chat handler closes SSE stream on final', async () => {
  // mock LLM client for the handler
  const mockLLM = {
    systemPrompt: '',
    streamChat: async function* () {
      yield { type: 'token', content: 'hello' };
      yield { type: 'final', content: 'done' };
    },
  };

  const llmModulePath = require.resolve('../api/lib/llmClient');
  delete require.cache[llmModulePath];
  require.cache[llmModulePath] = {
    exports: { createLLMClient: () => mockLLM },
  };

  delete require.cache[require.resolve('../api/chat')];
  const handler = require('../api/chat');

  const writes = [];
  let endCount = 0;
  const req = { method: 'POST', body: { message: 'kde zmenim heslo' } };
  const res = {
    writeHead: () => {},
    write: (chunk) => writes.push(chunk),
    end: () => {
      endCount += 1;
    },
  };

  await handler(req, res);

  const finalEvents = writes.filter((w) => w.includes('event: final'));
  assert.strictEqual(finalEvents.length, 1, 'final event written once');
  assert.strictEqual(endCount, 1, 'res.end called once');
});

test('chat handler validates empty message', async () => {
  delete require.cache[require.resolve('../api/chat')];
  const handler = require('../api/chat');

  let statusCode = null;
  let jsonBody = null;
  const req = { method: 'POST', body: { message: '   ' }, socket: { remoteAddress: '1.1.1.1' } };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      jsonBody = payload;
    },
  };

  await handler(req, res);

  assert.strictEqual(statusCode, 400);
  assert.deepStrictEqual(jsonBody, { error: 'missing_message' });
});

test('chat handler rejects oversized message', async () => {
  delete require.cache[require.resolve('../api/chat')];
  const handler = require('../api/chat');

  const longMessage = 'a'.repeat(2001);
  let statusCode = null;
  let jsonBody = null;
  const req = { method: 'POST', body: { message: longMessage }, socket: { remoteAddress: '2.2.2.2' } };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      jsonBody = payload;
    },
  };

  await handler(req, res);

  assert.strictEqual(statusCode, 400);
  assert.deepStrictEqual(jsonBody, { error: 'message_too_long' });
});

test('chat handler rejects invalid session id', async () => {
  delete require.cache[require.resolve('../api/chat')];
  const handler = require('../api/chat');

  let statusCode = null;
  let jsonBody = null;
  const req = {
    method: 'POST',
    body: { message: 'hello', sessionId: 'a'.repeat(129) },
    socket: { remoteAddress: '3.3.3.3' },
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      jsonBody = payload;
    },
  };

  await handler(req, res);

  assert.strictEqual(statusCode, 400);
  assert.deepStrictEqual(jsonBody, { error: 'invalid_session_id' });
});

test('chat handler rate limits unauthenticated requests', async () => {
  const mockLLM = {
    systemPrompt: '',
    streamChat: async function* () {
      yield { type: 'final', content: 'ok' };
    },
  };

  const llmModulePath = require.resolve('../api/lib/llmClient');
  delete require.cache[llmModulePath];
  require.cache[llmModulePath] = {
    exports: { createLLMClient: () => mockLLM },
  };

  delete require.cache[require.resolve('../api/chat')];
  const handler = require('../api/chat');

  const reqBase = {
    method: 'POST',
    body: { message: 'hello' },
    socket: { remoteAddress: '4.4.4.4' },
  };

  let rateLimitedWrites = [];
  const buildRes = () => ({
    writeHead: () => {},
    write: (chunk) => rateLimitedWrites.push(chunk),
    end: () => {},
    status: () => ({ json: () => {} }),
    json: () => {},
  });

  for (let i = 0; i < 11; i += 1) {
    rateLimitedWrites = [];
    await handler(reqBase, buildRes());
  }

  const finalEvents = rateLimitedWrites.filter((w) => w.includes('event: final'));
  assert.strictEqual(finalEvents.length, 1);
  assert.ok(finalEvents[0].includes('Rate limit'));
});
