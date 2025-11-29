import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nzocogzhakmqwiifrjuk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2NvZ3poYWttcXdpaWZyanVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNDE1NDcsImV4cCI6MjA3OTcxNzU0N30.nxlVycIOhyd7Zn9zXLhSP6FMhJfYvFdiIzReFRUHkHY';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
