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
        res.status(400).json({ ok: false, error: 'invalid_json' });
        return;
      }

      try {
        if (req.url === '/api/chat') {
          await chatHandler(req, res);
        } else if (req.url === '/api/chat/tool-callback') {
          await toolCallbackHandler(req, res);
        } else if (req.url === '/api/sales/session/start') {
          const body = req.body || {};
          const sessionInput = {
            user_id: body.user_id ?? null,
            module: body.module || 'obchodny_rozhovor',
            difficulty: body.difficulty || 'beginner',
            client_type: body.client_type || 'new',
            client_disc_type: body.client_disc_type ?? null,
          };

          const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('sales_voice_sessions')
            .insert([sessionInput])
            .select('id')
            .single();

          if (sessionError) {
            console.error('[sales-api] failed to insert session', sessionError);
            res.status(500).json({ ok: false, error: 'supabase_insert_failed' });
            return;
          }

          res.status(200).json({ ok: true, session_id: sessionData.id });
        } else if (req.url === '/api/sales/message') {
          const body = req.body || {};
          const { session_id, role, content } = body;

          const missingFields = [];
          const sessionIdValue = typeof session_id === 'string' ? session_id.trim() : '';
          const roleValue = typeof role === 'string' ? role.trim() : '';
          const contentValue = typeof content === 'string' ? content.trim() : '';

          if (!sessionIdValue) missingFields.push('session_id');
          if (!roleValue) missingFields.push('role');
          if (!contentValue) missingFields.push('content');

          if (missingFields.length) {
            const details = `Missing or invalid fields: ${missingFields.join(', ')}`;
            console.warn(`[sales] message validation failed: ${details}`);
            res.status(400).json({ ok: false, error: 'missing_fields', details });
            return;
          }

          const allowedRoles = ['salesman', 'client', 'system'];
          if (!allowedRoles.includes(roleValue)) {
            const details = `Invalid role: ${roleValue}`;
            console.warn(`[sales] message validation failed: ${details}`);
            res.status(400).json({ ok: false, error: 'invalid_role', details });
            return;
          }

          const { data: existingSessions, error: sessionQueryError } = await supabaseAdmin
            .from('sales_voice_sessions')
            .select('id')
            .eq('id', sessionIdValue)
            .limit(1);

          if (sessionQueryError) {
            console.error('[sales-api] failed to verify session', sessionQueryError);
            res.status(500).json({ ok: false, error: 'supabase_query_failed' });
            return;
          }

          if (!existingSessions || !existingSessions.length) {
            console.warn(`[sales] message rejected: session_not_found ${sessionIdValue}`);
            res.status(404).json({ ok: false, error: 'session_not_found' });
            return;
          }

          const { error: messageError } = await supabaseAdmin
            .from('sales_voice_messages')
            .insert([{
              session_id: sessionIdValue,
              role: roleValue,
              content,
            }]);

          if (messageError) {
            console.error('[sales-api] failed to insert message', messageError);
            res.status(500).json({ ok: false, error: 'supabase_insert_failed' });
            return;
          }

          const { error: salesmanCountError, count: salesmanCount } = await supabaseAdmin
            .from('sales_voice_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionIdValue)
            .eq('role', 'salesman');

          if (salesmanCountError) {
            console.error('[sales-api] failed to count salesman messages', salesmanCountError);
            res.status(500).json({
              ok: false,
              error: 'salesman_count_failed',
              details: salesmanCountError.message || 'Unable to read salesman messages count',
            });
            return;
          }

          let clientReplyText = 'Rozumiem. Povedzte mi o tom viac.';
          let stage = 'intro';

          if (salesmanCount === 1) {
            clientReplyText = 'Dobrý deň. Povedzte mi stručne, čo ponúkate a komu.';
            stage = 'intro';
          } else if (salesmanCount <= 3) {
            clientReplyText = 'Rozumiem. Aké sú pre vás najdôležitejšie potreby alebo ciele, ktoré chcete týmto riešiť?';
            stage = 'discovery';
          } else if (salesmanCount <= 5) {
            clientReplyText = 'OK. V čom je vaša ponuka iná než bežné riešenia a aký to má dopad na výsledky?';
            stage = 'presentation';
          } else if (salesmanCount >= 6) {
            clientReplyText = 'Dobre. Aký je ďalší konkrétny krok, ktorý navrhujete?';
            stage = 'closing';
          }

          console.log(`[sales] reply stage=${stage} salesmanCount=${salesmanCount}`);

          const { error: clientMessageError } = await supabaseAdmin
            .from('sales_voice_messages')
            .insert([{
              session_id: sessionIdValue,
              role: 'client',
              content: clientReplyText,
            }]);

          if (clientMessageError) {
            console.error('[sales-api] failed to insert client reply', clientMessageError);
            res.status(500).json({ ok: false, error: 'client_reply_insert_failed' });
            return;
          }

          res.status(200).json({ ok: true, client_message: clientReplyText });
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
