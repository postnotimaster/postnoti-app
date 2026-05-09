const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testFetch() {
    // Get any profile with a company
    const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .limit(1);
    
    console.log('Profile companies:', JSON.stringify(profile[0].companies, null, 2));
}

testFetch();
