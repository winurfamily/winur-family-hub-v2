-- Winur Family Hub V2 — Enable Row Level Security (Decision #40: "RLS aktif Sprint 6")
--
-- Aplikasi ini TIDAK memakai Supabase Auth — sesi admin/anak adalah cookie
-- bertanda tangan custom (lihat src/lib/server/admin-helpers.ts), sehingga
-- auth.uid() selalu null. Semua akses DB dilakukan lewat Server Actions
-- via createAdminClient() (service_role key), yang secara default BYPASS RLS
-- di Postgres/Supabase.
--
-- Mengaktifkan RLS tanpa policy untuk anon/authenticated berarti default-deny
-- total bagi kedua role tsb:
--   - service_role (dipakai createAdminClient) tetap full access seperti biasa.
--   - anon/authenticated (mis. jika SUPABASE_SERVICE_ROLE_KEY belum di-set dan
--     createAdminClient() fallback ke anon key) tidak bisa baca/tulis apa pun.

do $$
declare
  r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'alter table public.' || quote_ident(r.tablename) || ' enable row level security';
  end loop;
end $$;

-- Lockdown tambahan: cabut privilege langsung anon/authenticated di schema public.
-- service_role tetap full access (grant terpisah di 0005_grant_privileges.sql).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
