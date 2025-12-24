const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabase-client] Missing env vars');
  throw new Error('Missing Supabase env vars');
}

function createUserSupabaseClient(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
  });
}

module.exports = { createUserSupabaseClient };
