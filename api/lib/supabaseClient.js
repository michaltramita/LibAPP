const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getSupabaseEnvError() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'missing_env';
  }
  return null;
}

function createUserSupabaseClient(token) {
  const envError = getSupabaseEnvError();
  if (envError) {
    const error = new Error(envError);
    error.code = envError;
    throw error;
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
  });
}

module.exports = { createUserSupabaseClient, getSupabaseEnvError };
