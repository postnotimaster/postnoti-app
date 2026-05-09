const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testRpc() {
    // Read the env file for service_role key
    const envContent = fs.readFileSync('.env', 'utf-8');
    const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
    
    // We actually need the service role key if we want to bypass RLS to get a tenant.
    // Wait, we can just use the anon key if we know a company id.
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    // get a company
    const { data: companies } = await supabase.from('companies').select('id').limit(1);
    if (!companies || companies.length === 0) {
        console.log('No companies found');
        return;
    }
    const companyId = companies[0].id;
    console.log('Got company:', companyId);
    
    // get tenants from admin RPC or just try a raw query with service role if we had it
    // Let's use the RPC get_mail_stats_by_company to get a tenant_id!
    const { data: stats } = await supabase.rpc('get_mail_stats_by_company', { p_company_id: companyId });
    if (!stats || stats.length === 0) {
        console.log('No stats found, cannot get tenant ID');
        return;
    }
    
    const tenantId = stats[0].tenant_id;
    console.log('Got tenant ID:', tenantId);
    
    // Now test the get_tenant_by_id_secure
    const { data, error } = await supabase.rpc('get_tenant_by_id_secure', {
        p_tenant_id: tenantId
    });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Success:', data);
    }
}
testRpc();
