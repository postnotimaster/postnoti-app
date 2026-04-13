const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vcrpqxetbrgqtxltbitm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnBxeGV0YnJncXR4bHRiaXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE0MDksImV4cCI6MjA4Mzk0NzQwOX0.UT2VW0Czmen0IET06dAhVk1a-Q5W7tdKgdjx9yBXq9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Testing insert into mail_logs...');
    const { data, error } = await supabase
        .from('mail_logs')
        .insert([{
            company_id: '8642345e-990e-4dd7-8919-688756855239', // Just a test UUID
            profile_id: '8642345e-990e-4dd7-8919-688756855239',
            mail_type: 'test',
            status: 'test_insert'
        }])
        .select();

    if (error) {
        console.log('Insert test FAILED:', error.message, error.code);
        if (error.code === '42501') {
            console.log('Reason: RLS policy potentially missing.');
        }
    } else {
        console.log('Insert test SUCCESSFUL:', data);
        // Delete it
        await supabase.from('mail_logs').delete().eq('status', 'test_insert');
    }
}
testInsert();
