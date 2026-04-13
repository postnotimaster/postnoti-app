-- Add push_token column to profiles table
alter table public.profiles add column if not exists push_token text;

-- Also ensured previously in ensure_storage_permissions.sql
-- But let's add it here for clarity
alter table public.profiles add column if not exists pwa_installed boolean default false;
alter table public.profiles add column if not exists web_push_token text;
