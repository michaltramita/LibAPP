const http = require('http');
const chatHandler = require('./chat');
const toolCallbackHandler = require('./chat/tool-callback');
const { createLLMClient } = require('./lib/llmClient');
const { supabaseAdmin } = require('./lib/supabaseAdmin');

const port = process.env.PORT || 4000;

// Emit the LLM debug log on startup so we can verify env wiring.
createLLMClient();

function augmentResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return res;
  };

  return res;
}

const server = http.createServer(async (req, res) => {
  augmentResponse(res);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    if (req.url === '/') {
      res.status(200).json({ status: 'ok', service: 'libapp-api', time: new Date().toISOString() });
    } else if (req.url === '/health') {
      res.status(200).json({ status: 'ok' });
    } else if (req.url === '/api/test-supabase') {
      try {
        const { data: sessionData, error: sessionError } = await supabaseAdmin
          .from('sales_voice_sessions')
          .insert([{
            user_id: null,
            module: 'obchodny_rozhovor',
            difficulty: 'beginner',
            client_type: 'new',
            client_disc_type: null,
          }])
          .select('id')
          .single();

        if (sessionError) throw sessionError;

        const sessionId = sessionData.id;

        const { error: messageError } = await supabaseAdmin
          .from('sales_voice_messages')
          .insert([{
            session_id: sessionId,
            role: 'salesman',
            content: 'TEST message',
          }]);

        if (messageError) throw messageError;

        res.status(200).json({ ok: true, session_id: sessionId });
      } catch (err) {
        console.error('[libo-dev] supabase test error', err);
        res.status(500).json({ error: 'supabase_error', details: err.message || 'Unknown error' });
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }

    return;
  }

  if (req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });

    req.on('end', async () => {
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch (err) {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }

      try {
        if (req.url === '/api/chat') {
          await chatHandler(req, res);
        } else if (req.url === '/api/chat/tool-callback') {
          await toolCallbackHandler(req, res);
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      } catch (err) {
        console.error('[libo-dev] handler error', err);
        if (!res.writableEnded) res.status(500).json({ error: 'Internal server error' });
      }
    });

    return;
  }

  res.status(404).json({ error: 'Not found' });
});

server.listen(port, () => {
  console.log(`[libo-dev] API server listening on port ${port}`);
});
