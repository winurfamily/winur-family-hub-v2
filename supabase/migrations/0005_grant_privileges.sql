-- Winur Family Hub V2 — Grant table privileges
-- RESET_AND_SEED.sql membuat ulang semua tabel via SQL Editor (role `postgres`),
-- sehingga role `service_role` (dipakai createAdminClient untuk bypass RLS)
-- kehilangan privilege standar Supabase (SELECT/INSERT/UPDATE/DELETE).
-- Migration ini mengembalikan grant tersebut untuk tabel yang sudah ada
-- dan tabel yang akan dibuat di kemudian hari.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
