-- Ensure storage bucket is public and has policies
insert into storage.buckets (id, name, public)
values ('mail_images', 'mail_images', true)
on conflict (id) do update set public = true;

-- Allow public read access to mail_images
create policy "Public Access to mail_images"
on storage.objects for select
using ( bucket_id = 'mail_images' );

-- Allow authenticated/public upload to mail_images (simplicity for this app context)
create policy "Public Upload to mail_images"
on storage.objects for insert
with check ( bucket_id = 'mail_images' );

-- Update profiles table if needed (just in case they are missing)
-- (Assuming they exist based on previous code review, but safe to check if I could)
