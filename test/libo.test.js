const assert = require('assert');
const { test } = require('node:test');
const { searchContext } = require('../api/lib/rag');
const { resolveNavigate, executeTool } = require('../kod/src/utils/liboTools.js');
const { createLLMClient } = require('../api/lib/llmClient');

process.env.LIBO_AI_ENABLED = 'false';

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

test('RAG returns topics sorted', () => {
  const results = searchContext('zmeniť heslo', 1);
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].id, 'change-password');
});

test('LLM client returns fallback when disabled', async () => {
  const llm = createLLMClient();
  const iterator = llm.streamChat({ messages: [{ role: 'user', content: 'hi' }] });
  const { value } = await iterator.next();
  assert.strictEqual(value.type, 'final');
  assert.ok(value.content.includes('nedostupná'));
});
