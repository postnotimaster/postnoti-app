const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('Testing RPC get_mails_by_tenant_secure...');
    const dummyId = '11111111-1111-1111-1111-111111111111';
    
    const { data, error } = await supabase.rpc('get_mails_by_tenant_secure', {
        p_tenant_id: dummyId
    });

    if (error) {
        console.error('RPC Error:', error.message);
    } else {
        console.log('RPC Success:', data);
    }
}
testRpc();
