const http = require('http');
const chatHandler = require('./chat');
const toolCallbackHandler = require('./chat/tool-callback');
const { createLLMClient } = require('./lib/llmClient');

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
