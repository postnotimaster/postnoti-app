const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vcrpqxetbrgqtxltbitm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnBxeGV0YnJncXR4bHRiaXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE0MDksImV4cCI6MjA4Mzk0NzQwOX0.UT2VW0Czmen0IET06dAhVk1a-Q5W7tdKgdjx9yBXq9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('Checking storage...');
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.log('Error listing buckets (expected for anon):', error.message);
    } else {
        console.log('Buckets:', data.map(b => b.name).join(', '));
    }

    // Try to list files in mail_images
    const { data: files, error: fileError } = await supabase.storage.from('mail_images').list('', { limit: 1 });
    if (fileError) {
        console.log('Error accessing mail_images bucket:', fileError.message);
    } else {
        console.log('mail_images bucket is accessible. Found files:', files.length);
    }
}
checkStorage();
