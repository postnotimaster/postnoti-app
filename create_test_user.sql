
-- Create a test user directly in auth.users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'supertest@postnoti.com', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated');

INSERT INTO public.profiles (id, email, name, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'supertest@postnoti.com', 'Super Test', 'tenant');

