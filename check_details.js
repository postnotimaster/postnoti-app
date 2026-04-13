const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vcrpqxetbrgqtxltbitm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnBxeGV0YnJncXR4bHRiaXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE0MDksImV4cCI6MjA4Mzk0NzQwOX0.UT2VW0Czmen0IET06dAhVk1a-Q5W7tdKgdjx9yBXq9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data } = await supabase.from('profiles').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns in profiles:', Object.keys(data[0]).join(', '));
    }
}
check();
