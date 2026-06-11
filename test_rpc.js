const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { error } = await supabase.rpc('execute_sql', { sql: 'CREATE TABLE IF NOT EXISTS push_logs (id uuid default gen_random_uuid() primary key, message text, created_at timestamptz default now());' });
  console.log('Error creating table:', error);
}
run();
