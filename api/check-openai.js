const OpenAI = require('openai');

async function main() {
  const key = process.env.OPENAI_API_KEY;
  console.log('[check-openai] hasKey =', !!key, 'prefix =', key ? key.slice(0, 5) : '(none)');

  if (!key) {
    console.error('[check-openai] OPENAI_API_KEY is not set');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: key });

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello from LibApp healthcheck.' }],
      max_tokens: 10,
    });

    console.log('[check-openai] SUCCESS');
    console.log('[check-openai] first message =', resp.choices[0]?.message?.content);
  } catch (err) {
    console.error('[check-openai] ERROR:', err.status, err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  }
}

main();
