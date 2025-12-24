const assert = require('assert');
const path = require('path');
const { test, beforeEach } = require('node:test');

const handlerPath = path.resolve(__dirname, '../api/sales.js');
const supabaseClientPath = path.resolve(__dirname, '../api/lib/supabaseClient.js');

let mockState;
let handler;

function createMockState() {
  return {
    sessions: new Map(),
    messages: [],
    nextSessionId: 1,
  };
}

function createMockSupabaseClient(token, state) {
  const userId = token || null;

  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : { message: 'unauthorized' },
      }),
    },
    from: (table) => new Query(table, state, userId),
  };
}

class Query {
  constructor(table, state, userId) {
    this.table = table;
    this.state = state;
    this.userId = userId;
    this.filters = [];
    this.insertRows = null;
    this.selectColumns = null;
    this.count = null;
    this.head = false;
    this.singleResult = false;
  }

  select(columns, options) {
    this.selectColumns = columns;
    if (options) {
      this.count = options.count || null;
      this.head = Boolean(options.head);
    }
    return this;
  }

  insert(rows) {
    this.insertRows = rows;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  limit() {
    return this;
  }

  order() {
    return this.exec();
  }

  single() {
    this.singleResult = true;
    return this.exec();
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  async exec() {
    if (this.insertRows) {
      return this.handleInsert();
    }

    const rows = this.readRows();
    const data = this.applyFilters(rows);

    if (this.count) {
      return { data: this.head ? null : data, count: data.length, error: null };
    }

    if (this.singleResult) {
      const row = data[0] || null;
      if (row) {
        return { data: row, error: null };
      }

      const forbidden = this.detectForbidden(rows);
      if (forbidden) {
        return { data: null, error: { status: 403, message: 'forbidden' } };
      }

      return { data: null, error: { message: 'not found' } };
    }

    return { data, error: null };
  }

  readRows() {
    if (this.table === 'sales_voice_sessions') {
      return Array.from(this.state.sessions.values());
    }
    if (this.table === 'sales_voice_messages') {
      return this.state.messages;
    }
    return [];
  }

  applyFilters(rows) {
    return rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
  }

  detectForbidden(rows) {
    if (this.table !== 'sales_voice_sessions') return false;
    const idFilter = this.filters.find((filter) => filter.column === 'id');
    const userFilter = this.filters.find((filter) => filter.column === 'user_id');
    if (!idFilter || !userFilter) return false;

    return rows.some(
      (row) => row.id === idFilter.value && row.user_id !== userFilter.value
    );
  }

  handleInsert() {
    if (this.table === 'sales_voice_sessions') {
      const row = { ...this.insertRows[0] };
      if (!row.user_id || row.user_id !== this.userId) {
        return { data: null, error: { status: 403, message: 'forbidden' } };
      }
      if (!row.id) {
        row.id = `session-${this.state.nextSessionId++}`;
      }
      this.state.sessions.set(row.id, row);
      return { data: pickColumns(row, this.selectColumns), error: null };
    }

    if (this.table === 'sales_voice_messages') {
      this.insertRows.forEach((row) => {
        this.state.messages.push({ ...row });
      });
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }
}

function pickColumns(row, columns) {
  if (!columns || columns === '*') return row;
  const selected = {};
  columns.split(',').map((col) => col.trim()).forEach((col) => {
    if (col && Object.prototype.hasOwnProperty.call(row, col)) {
      selected[col] = row[col];
    }
  });
  return selected;
}

function loadHandler(options = {}) {
  const { envError, createUserSupabaseClient } = options;
  delete require.cache[handlerPath];
  require.cache[supabaseClientPath] = {
    id: supabaseClientPath,
    filename: supabaseClientPath,
    loaded: true,
    exports: {
      createUserSupabaseClient:
        createUserSupabaseClient || ((token) => createMockSupabaseClient(token, mockState)),
      getSupabaseEnvError: () => envError || null,
    },
  };
  handler = require(handlerPath);
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
    },
  };
}

async function callHandler({ url, method, body, token }) {
  const req = {
    url,
    method,
    headers: {},
    body,
    socket: { remoteAddress: '127.0.0.1' },
  };

  if (token) {
    req.headers.authorization = `Bearer ${token}`;
  }

  const res = createMockRes();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  mockState = createMockState();
  loadHandler();
});

test('unauthorized session start returns 401', async () => {
  const res = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    body: {},
  });

  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, { error: 'unauthorized' });
});

test('missing env returns 500 with missing_env error', async () => {
  loadHandler({ envError: 'missing_env' });

  const res = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    token: 'user-1',
    body: { module: 'obchodny_rozhovor' },
  });

  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.body, { error: 'missing_env' });
});

test('authorized user can create session and send message', async () => {
  const sessionRes = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    token: 'user-1',
    body: {
      module: 'obchodny_rozhovor',
      difficulty: 'beginner',
      client_type: 'new',
      client_disc_type: 'D',
    },
  });

  assert.strictEqual(sessionRes.statusCode, 200);
  assert.strictEqual(sessionRes.body.ok, true);
  assert.ok(sessionRes.body.session_id);
  assert.strictEqual(
    mockState.sessions.get(sessionRes.body.session_id).user_id,
    'user-1'
  );

  const messageRes = await callHandler({
    url: '/api/sales/message',
    method: 'POST',
    token: 'user-1',
    body: {
      session_id: sessionRes.body.session_id,
      role: 'salesman',
      content: 'Hello there',
    },
  });

  assert.strictEqual(messageRes.statusCode, 200);
  assert.strictEqual(messageRes.body.ok, true);
  assert.ok(messageRes.body.client_message);
});

test('session creation ignores user_id from request body', async () => {
  const res = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    token: 'user-1',
    body: { module: 'obchodny_rozhovor', user_id: 'user-2' },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(
    mockState.sessions.get(res.body.session_id).user_id,
    'user-1'
  );
});

test('session creation returns 403 on rls failure', async () => {
  loadHandler({
    createUserSupabaseClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => ({ data: null, error: { status: 403, message: 'forbidden' } }),
          }),
        }),
      }),
    }),
  });

  const res = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    token: 'user-1',
    body: { module: 'obchodny_rozhovor' },
  });

  assert.strictEqual(res.statusCode, 403);
  assert.deepStrictEqual(res.body, {
    ok: false,
    error: 'forbidden',
    details: 'forbidden',
  });
});

test("user can't access another user's session", async () => {
  const sessionRes = await callHandler({
    url: '/api/sales/session',
    method: 'POST',
    token: 'user-1',
    body: { module: 'obchodny_rozhovor' },
  });

  const sessionId = sessionRes.body.session_id;
  const res = await callHandler({
    url: `/api/sales/session/${sessionId}`,
    method: 'GET',
    token: 'user-2',
  });

  assert.strictEqual(res.statusCode, 403);
  assert.deepStrictEqual(res.body, {
    ok: false,
    error: 'forbidden',
    details: 'forbidden',
  });
});
