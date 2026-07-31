-- Winur Family Hub V2 — Kunci akses anon/authenticated (perbaikan keamanan)
--
-- LATAR BELAKANG
-- Migration 0006_enable_rls.sql memang sudah ditulis, tetapi audit langsung ke
-- project Supabase menunjukkan isinya TIDAK PERNAH benar-benar diterapkan:
-- setiap tabel lama masih terbuka penuh untuk role `anon`. Padahal anon key
-- adalah NEXT_PUBLIC_* — ikut terkirim ke browser, jadi siapa pun yang membuka
-- aplikasi bisa mengambilnya dari bundle.
--
-- Yang terbukti bisa dilakukan hanya berbekal anon key sebelum migration ini:
--   * SELECT seluruh isi families, profiles (termasuk kolom `pin` berisi hash
--     bcrypt), pockets, income, pocket_transfers, shopping_plans, audit_logs,
--     tasks, avatars, pets.
--   * UPDATE families.main_balance (dikonfirmasi lewat PATCH yang balas 200).
--   * EXECUTE fin_create_income dan RPC fin_* lain — fungsi ini `security
--     invoker` dan bergantung penuh pada privilege tabel pemanggilnya, jadi
--     begitu anon punya privilege tabel, seluruh mutasi uang ikut terbuka.
--
-- Aplikasi TIDAK terpengaruh oleh penguncian ini: seluruh akses database lewat
-- createAdminClient() (service_role) di Server Action. src/lib/supabase/client.ts
-- dan server.ts memang memakai anon key tetapi tidak diimpor modul mana pun.
--
-- Pola penguncian mengikuti 0006 (default-deny tanpa policy) karena aplikasi
-- tidak memakai Supabase Auth — auth.uid() selalu null, sehingga policy berbasis
-- auth tidak akan pernah cocok dan hanya menambah permukaan serang.

-- ---------------------------------------------------------------------
-- 1. RLS aktif di semua tabel public
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Cabut seluruh privilege anon/authenticated
-- ---------------------------------------------------------------------
-- Tanpa privilege tabel, RLS tidak lagi jadi satu-satunya penjaga: PostgREST
-- menolak lebih awal dengan 42501.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;

-- PENTING — mencabut dari anon/authenticated saja TIDAK cukup untuk function.
-- Postgres memberi EXECUTE ke role bawaan PUBLIC pada setiap function baru,
-- dan anon/authenticated mewarisi hak itu lewat PUBLIC. Tanpa langkah di bawah,
-- seluruh RPC fin_* tetap bisa dipanggil memakai anon key.
--
-- Function milik extension sengaja dilewati: mencabut EXECUTE dari PUBLIC pada
-- fungsi pgcrypto/uuid-ossp dsb. bisa merusak default value kolom dan operator
-- indeks yang dipakai role lain.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      -- 'f' = function, 'p' = procedure. Aggregate/window function dilewati:
      -- keduanya bukan jalur yang bisa dipanggil lewat PostgREST.
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on routine %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- `usage on schema public` sengaja DIPERTAHANKAN supaya PostgREST tetap bisa
-- membalas dengan error izin yang benar, bukan gagal memuat schema cache.

-- Objek yang dibuat di kemudian hari tidak boleh otomatis terbuka lagi.
-- Dijalankan untuk pemilik objek yang mungkin berbeda (SQL Editor = postgres,
-- migration Supabase CLI = supabase_admin).
do $$
declare
  owner_role text;
begin
  foreach owner_role in array array['postgres', 'supabase_admin', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = owner_role) then
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', owner_role);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', owner_role);
      execute format(
        'alter default privileges for role %I in schema public revoke all on routines from anon, authenticated', owner_role);
      -- Sekali lagi: PUBLIC-lah sumber EXECUTE default untuk function baru.
      execute format(
        'alter default privileges for role %I in schema public revoke execute on routines from public', owner_role);
    end if;
  end loop;
exception
  when insufficient_privilege then
    raise notice 'Lewati sebagian ALTER DEFAULT PRIVILEGES (butuh hak pemilik role).';
end $$;

-- ---------------------------------------------------------------------
-- 3. Pastikan service_role tetap punya akses penuh
-- ---------------------------------------------------------------------
-- Langkah 2 memakai ALL TABLES/ROUTINES, jadi grant service_role ditegaskan
-- ulang di sini agar Server Action tidak ikut terkunci.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all routines in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on routines to service_role;

-- ---------------------------------------------------------------------
-- 4. Verifikasi — migration gagal kalau masih ada yang terbuka
-- ---------------------------------------------------------------------
do $$
declare
  leaky text;
begin
  -- has_table_privilege dipakai (bukan information_schema.role_table_grants)
  -- karena ia ikut memperhitungkan hak yang diwarisi lewat role PUBLIC.
  select string_agg(distinct c.relname, ', ')
    into leaky
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'::name), ('authenticated'::name)) as r(role_name)
  cross join (values ('select'::text), ('insert'), ('update'), ('delete')) as p(priv)
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege(r.role_name, c.oid, p.priv);

  if leaky is not null then
    raise exception 'Masih ada privilege anon/authenticated di tabel: %', leaky;
  end if;

  -- Diperiksa untuk SELURUH function buatan sendiri di public, bukan hanya
  -- fin_*, supaya helper lain tidak diam-diam tetap terbuka.
  select string_agg(distinct p.proname, ', ')
    into leaky
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'));

  if leaky is not null then
    raise exception 'anon/authenticated masih bisa EXECUTE RPC: %', leaky;
  end if;

  raise notice 'OK — anon/authenticated tidak punya akses apa pun ke schema public.';
end $$;
