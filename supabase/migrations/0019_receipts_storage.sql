-- Winur Family Hub V2 — Bukti struk & Supabase Storage privat
-- =====================================================================
-- Bucket `ai-assets` yang sudah ada bersifat PUBLIC (0003) — cocok untuk
-- gambar avatar/pet, tapi tidak boleh dipakai untuk bukti transaksi.
-- Struk dibaca lewat signed URL berumur pendek, bukan public URL permanen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bucket privat
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = 10485760,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Default-deny: tidak ada policy untuk anon/authenticated sama sekali.
-- Semua baca/tulis melewati Server Action dengan service_role, yang
-- memvalidasi family_id lebih dulu (lihat src/app/actions/receipts.ts).
--
-- Policy sisa percobaan sebelumnya dibersihkan agar tidak ada celah. Dibungkus
-- DO block karena storage.objects dimiliki supabase_storage_admin: pada
-- sebagian proyek DROP POLICY bisa ditolak, dan itu tidak boleh menggagalkan
-- seluruh migration.
do $$
begin
  execute 'drop policy if exists "receipts anon read" on storage.objects';
  execute 'drop policy if exists "receipts anon write" on storage.objects';
exception
  when insufficient_privilege then
    raise notice 'Lewati pembersihan policy storage.objects (butuh hak pemilik tabel).';
end $$;

-- ---------------------------------------------------------------------
-- 2. Metadata struk
-- ---------------------------------------------------------------------
-- transaction_id ON DELETE SET NULL: menghapus transaksi TIDAK ikut
-- menghapus file (pengguna diberi pilihan). Baris dengan transaction_id
-- NULL inilah yang dianggap "orphan" oleh Storage Manager.
create table if not exists receipt_attachments (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  transaction_id  uuid references shopping_transactions (id) on delete set null,
  storage_path    text not null unique,
  file_size       bigint not null default 0 check (file_size >= 0),
  mime_type       text not null default 'image/webp',
  width           int,
  height          int,
  uploaded_by     uuid references profiles (id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_receipts_family
  on receipt_attachments (family_id, created_at desc);
create index if not exists idx_receipts_transaction
  on receipt_attachments (transaction_id);
create index if not exists idx_receipts_orphan
  on receipt_attachments (family_id) where transaction_id is null;

alter table receipt_attachments enable row level security;
revoke all on receipt_attachments from anon, authenticated;
grant all on receipt_attachments to service_role;

-- ---------------------------------------------------------------------
-- 3. Ringkasan penggunaan storage per keluarga
-- ---------------------------------------------------------------------
create or replace function fin_storage_usage(p_family_id uuid)
returns table (
  total_bytes   bigint,
  file_count    bigint,
  orphan_count  bigint,
  orphan_bytes  bigint
)
language sql
stable
as $$
  select
    coalesce(sum(file_size), 0)::bigint                                         as total_bytes,
    count(*)::bigint                                                            as file_count,
    count(*) filter (where transaction_id is null)::bigint                      as orphan_count,
    coalesce(sum(file_size) filter (where transaction_id is null), 0)::bigint   as orphan_bytes
  from receipt_attachments
  where family_id = p_family_id;
$$;

-- Penggunaan per bulan, untuk grafik di halaman Penggunaan Storage.
create or replace function fin_storage_usage_by_month(p_family_id uuid)
returns table (
  month       text,
  bytes       bigint,
  file_count  bigint
)
language sql
stable
as $$
  select
    to_char(created_at, 'YYYY-MM')  as month,
    coalesce(sum(file_size), 0)::bigint,
    count(*)::bigint
  from receipt_attachments
  where family_id = p_family_id
  group by 1
  order by 1 desc;
$$;

grant execute on all functions in schema public to service_role;
