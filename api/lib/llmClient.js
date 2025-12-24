const DEFAULT_MODEL = process.env.LIBO_MODEL || 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = parseFloat(process.env.LIBO_TEMPERATURE || '0.2');

const systemPrompt = `Si Libo, sprievodca aplikáciou LibApp. Tvoj cieľ je:
- v slovenčine stručne vysvetliť kroky alebo priamo navrhnúť klikateľnú akciu
- ak zistíš, že otázka je v angličtine, odpovedaj v EN
- ak máš nástroj, ktorý pomôže, navrhni jeho použitie alebo ho zavolaj
- nikdy si nevymýšľaj neexistujúce obrazovky alebo funkcie
- ak si nie si istý, opýtaj sa doplňujúcu otázku
`;

const toolDefinitions = [
  { type: 'function', function: { name: 'navigate', description: 'Prepni obrazovku alebo sekciu aplikácie', parameters: { type: 'object', properties: { route: { type: 'string', description: 'Cesta/route v aplikácii' }, params: { type: 'object', description: 'Voliteľné parametre pre route', additionalProperties: true } }, required: ['route'] } } },
  { type: 'function', function: { name: 'searchFeature', description: 'Vyhľadaj funkciu alebo akciu v aplikácii', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'showGuide', description: 'Otvor konkrétny návod alebo FAQ', parameters: { type: 'object', properties: { topicId: { type: 'string' } }, required: ['topicId'] } } },
  { type: 'function', function: { name: 'openSettings', description: 'Prejdi do nastavení', parameters: { type: 'object', properties: { section: { type: 'string', description: 'konkrétna sekcia nastavení' } } } } },
];

function createLLMClient() {
  console.log('[libo-llm-debug]', {
    enabled: process.env.LIBO_AI_ENABLED !== 'false',
    hasKey: !!process.env.OPENAI_API_KEY
  });
  const enabled = process.env.LIBO_AI_ENABLED !== 'false';
  const apiKey = process.env.OPENAI_API_KEY;
  const client = enabled && apiKey ? new (require('openai'))({ apiKey }) : null;

  async function *streamChat({ messages, model = DEFAULT_MODEL, temperature = DEFAULT_TEMPERATURE }) {
    if (!client) {
      yield { type: 'final', content: 'AI je dočasne nedostupná. Skús to prosím neskôr.' };
      return;
    }

    try {
      const completion = await client.chat.completions.create({ model, temperature, messages, tools: toolDefinitions, stream: true });
      for await (const part of completion) {
        const choice = part.choices[0];
        if (choice.delta?.tool_calls?.length) for (const call of choice.delta.tool_calls) yield { type: 'tool_call', name: call.function?.name, arguments: safeParse(call.function?.arguments || '{}') };
        if (choice.delta?.content) yield { type: 'token', content: choice.delta.content };
        // Akákoľvek "finish_reason" je terminálny stav
        if (choice.finish_reason) {
          yield { type: 'final' };
          break;
        }
      }
    } catch (err) {
      console.error('[libo-ai] OpenAI chat error', err);
      yield { type: 'final', content: 'AI je dočasne nedostupná. Skús to prosím neskôr.' };
    }
  }

  return { streamChat, systemPrompt, toolDefinitions };
}

function safeParse(text) { try { return JSON.parse(text); } catch (err) { return {}; } }

module.exports = { createLLMClient, systemPrompt, toolDefinitions };
