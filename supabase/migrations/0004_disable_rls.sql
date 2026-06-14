-- Winur Family Hub V2 — Disable Row Level Security
-- Sesuai desain awal (lihat komentar di 0001_initial_schema.sql):
-- "RLS OFF awal (aktif Sprint 6)". Supabase mengaktifkan RLS otomatis
-- untuk tabel baru yang dibuat lewat SQL Editor, jadi perlu dimatikan
-- manual agar createAdminClient() (anon key fallback) tidak terblokir.

do $$
declare
  r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'alter table public.' || quote_ident(r.tablename) || ' disable row level security';
  end loop;
end $$;
