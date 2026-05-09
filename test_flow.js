const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testFullFlow() {
    // 1. Get a company
    const { data: companies } = await supabase.from('companies').select('*').limit(1);
    const company = companies[0];
    console.log('Company:', company.id);

    // 2. Get a tenant from this company using get_mail_stats_by_company to find an active tenant_id
    const { data: stats } = await supabase.rpc('get_mail_stats_by_company', { p_company_id: company.id });
    if (!stats || stats.length === 0) {
        console.log('No tenants found with mails');
        return;
    }
    const tenantId = stats[0].tenant_id;
    console.log('Tenant ID:', tenantId);

    // 3. Test the RPC exactly as the app does
    const { data: tenantData, error } = await supabase.rpc('get_tenant_by_id_secure', { p_tenant_id: tenantId });
    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Result:', tenantData);
    }
}

testFullFlow();
