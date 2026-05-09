const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testFetch() {
    const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'companies' });
    console.log(cols);
}

testFetch();
