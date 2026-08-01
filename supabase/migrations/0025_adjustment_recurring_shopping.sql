-- Winur Family Hub V2 — Migration 0025
-- =====================================================================
-- Tiga kemampuan baru + dua kolom penyempurnaan Belanja. Seluruhnya
-- ADDITIVE: tidak ada DROP TABLE, DELETE data, atau perubahan kolom lama.
--
--   1. balance_adjustments  — koreksi saldo yang selalu meninggalkan jejak
--   2. recurring_transactions / recurring_occurrences — transaksi rutin
--      dengan model KONFIRMASI (tidak pernah memotong saldo diam-diam)
--   3. products.is_favorite + shopping_plan_items.category
--   4. Index pendukung pencarian & rekomendasi
--
-- Aman dijalankan ulang (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PENYESUAIAN SALDO
-- ---------------------------------------------------------------------
-- Saldo aplikasi kadang berbeda dari uang yang benar-benar ada (uang
-- tunai terpakai tanpa dicatat, salah ketik nominal, dst). Sebelum ini
-- satu-satunya jalan memperbaikinya adalah mengarang transaksi palsu.
--
-- Tabel ini membuat koreksi menjadi jenis catatan tersendiri: saldo
-- sebelum, saldo sesudah, selisih, ALASAN WAJIB, pembuat, dan waktunya
-- tersimpan permanen. Tidak ada jalur yang mengubah saldo tanpa baris di
-- sini.
create table if not exists balance_adjustments (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  -- NULL = Saldo Utama (families.main_balance), selaras dengan income.pocket_id.
  pocket_id       uuid references pockets (id) on delete cascade,
  balance_before  numeric(14, 2) not null,
  balance_after   numeric(14, 2) not null,
  -- balance_after − balance_before. Positif = saldo ditambah.
  delta           numeric(14, 2) not null check (delta <> 0),
  reason          text not null check (length(btrim(reason)) > 0),
  date            date not null default current_date,
  client_token    uuid,
  created_by      uuid references profiles (id),
  created_at      timestamptz not null default now()
);

comment on column balance_adjustments.pocket_id is
  'Akun yang dikoreksi. NULL = Saldo Utama (families.main_balance).';

create index if not exists idx_balance_adjustments_family_date
  on balance_adjustments (family_id, date desc, created_at desc);
create index if not exists idx_balance_adjustments_family_pocket
  on balance_adjustments (family_id, pocket_id);
create unique index if not exists uq_balance_adjustments_client_token
  on balance_adjustments (family_id, client_token) where client_token is not null;

alter table balance_adjustments enable row level security;
drop policy if exists balance_adjustments_service_role_all on balance_adjustments;
create policy balance_adjustments_service_role_all
  on balance_adjustments for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Catat koreksi DAN pindahkan saldonya dalam satu transaksi database.
--
-- Baris akun dikunci (FOR UPDATE) sebelum dibaca, sehingga saldo "sebelum"
-- yang tersimpan benar-benar saldo saat koreksi terjadi — bukan angka yang
-- sudah basi karena request lain menyelinap di antaranya.
create or replace function fin_create_adjustment(
  p_family_id    uuid,
  p_pocket_id    uuid,
  p_delta        numeric,
  p_reason       text,
  p_date         date,
  p_created_by   uuid,
  p_client_token uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id      uuid;
  v_before  numeric;
  v_after   numeric;
  v_label   text;
  v_delta   numeric := round(p_delta);
  v_reason  text := btrim(coalesce(p_reason, ''));
begin
  if v_delta = 0 then
    raise exception 'Saldo aplikasi sudah sama dengan saldo sebenarnya.' using errcode = 'P0001';
  end if;
  if v_reason = '' then
    raise exception 'Alasan penyesuaian wajib diisi.' using errcode = 'P0001';
  end if;

  -- Idempotency: pengiriman ulang token yang sama mengembalikan koreksi
  -- pertama, bukan menerapkan selisihnya dua kali.
  if p_client_token is not null then
    select id into v_id from balance_adjustments
      where family_id = p_family_id and client_token = p_client_token;
    if found then
      return v_id;
    end if;
  end if;

  if p_pocket_id is null then
    select main_balance into v_before from families
      where id = p_family_id for update;
    if not found then
      raise exception 'Keluarga tidak ditemukan.' using errcode = 'P0002';
    end if;
    v_label := 'Saldo Utama';
    v_after := v_before + v_delta;

    if v_after < 0 then
      raise exception 'Saldo Utama tidak boleh minus.' using errcode = 'P0001';
    end if;

    update families set main_balance = v_after where id = p_family_id;
  else
    select balance, name into v_before, v_label from pockets
      where id = p_pocket_id and family_id = p_family_id for update;
    if not found then
      raise exception 'Pocket tidak ditemukan.' using errcode = 'P0002';
    end if;
    v_after := v_before + v_delta;

    if v_after < 0 then
      raise exception 'Saldo pocket "%" tidak boleh minus.', v_label using errcode = 'P0001';
    end if;

    update pockets set balance = v_after where id = p_pocket_id;
  end if;

  insert into balance_adjustments (
    family_id, pocket_id, balance_before, balance_after, delta,
    reason, date, client_token, created_by
  )
  values (
    p_family_id, p_pocket_id, v_before, v_after, v_delta,
    v_reason, coalesce(p_date, current_date), p_client_token, p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Hapus koreksi = membatalkan efeknya. Berbeda dari hapus riwayat transfer
-- (yang sengaja tidak menyentuh saldo): koreksi TIDAK mewakili uang yang
-- benar-benar berpindah, jadi menghapusnya harus mengembalikan angkanya.
create or replace function fin_delete_adjustment(
  p_adjustment_id uuid,
  p_family_id     uuid
) returns void
language plpgsql
as $$
declare
  v_row balance_adjustments%rowtype;
begin
  select * into v_row from balance_adjustments
    where id = p_adjustment_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Penyesuaian tidak ditemukan.' using errcode = 'P0002';
  end if;

  -- allow_negative: saldo mungkin sudah terpakai sejak koreksi dibuat,
  -- dan pembatalan catatan tidak boleh gagal di tengah jalan.
  perform fin_apply_balance(p_family_id, v_row.pocket_id, -v_row.delta, true);

  delete from balance_adjustments
    where id = p_adjustment_id and family_id = p_family_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. TRANSAKSI RUTIN
-- ---------------------------------------------------------------------
-- Gaji, cicilan, listrik, internet, sekolah, langganan, tabungan rutin.
--
-- Jadwal TIDAK PERNAH langsung memotong atau menambah saldo. Yang dibuat
-- otomatis hanyalah "tagihan menunggu" (recurring_occurrences) yang harus
-- dikonfirmasi manusia; barulah transaksi sungguhan lahir lewat RPC
-- keuangan yang sudah ada. Uang tidak boleh berpindah tanpa sepengetahuan
-- pengguna.
create table if not exists recurring_transactions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  kind        text not null check (kind in ('income', 'expense')),
  amount      numeric(14, 2) not null check (amount > 0),
  category    text not null default 'lainnya',
  -- Sumber dana (pengeluaran) atau akun tujuan (pendapatan). NULL = Saldo Utama.
  pocket_id   uuid references pockets (id) on delete set null,
  frequency   text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date  date not null,
  -- Tanggal jatuh tempo BERIKUTNYA yang belum dibuatkan occurrence.
  next_date   date not null,
  end_date    date,
  note        text,
  is_active   boolean not null default true,
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_recurring_transactions_family
  on recurring_transactions (family_id, is_active, next_date);

create table if not exists recurring_occurrences (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families (id) on delete cascade,
  recurring_id   uuid not null references recurring_transactions (id) on delete cascade,
  due_date       date not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'skipped')),
  amount         numeric(14, 2) not null,
  income_id      uuid references income (id) on delete set null,
  transaction_id uuid references shopping_transactions (id) on delete set null,
  resolved_at    timestamptz,
  resolved_by    uuid references profiles (id),
  created_at     timestamptz not null default now(),
  -- PENJAGA UTAMA transaksi rutin ganda. Berapa kali pun generator berjalan
  -- (cron, buka halaman, dua tab sekaligus), satu jadwal hanya bisa punya
  -- SATU baris per tanggal jatuh tempo.
  unique (recurring_id, due_date)
);

create index if not exists idx_recurring_occurrences_family_status
  on recurring_occurrences (family_id, status, due_date);

alter table recurring_transactions enable row level security;
alter table recurring_occurrences enable row level security;

drop policy if exists recurring_transactions_service_role_all on recurring_transactions;
create policy recurring_transactions_service_role_all
  on recurring_transactions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists recurring_occurrences_service_role_all on recurring_occurrences;
create policy recurring_occurrences_service_role_all
  on recurring_occurrences for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Tanggal jatuh tempo berikutnya menurut frekuensi.
--
-- p_anchor_day adalah TANGGAL ASLI jadwal (dari start_date). Tanpa itu,
-- cicilan tanggal 31 yang sekali terjepit menjadi 28 Februari akan terkunci
-- di tanggal 28 selamanya. Dengan anchor, ia kembali ke 31 pada Maret —
-- persis yang diharapkan orang dari "tanggal 31 setiap bulan".
--
-- Kembarannya di TypeScript adalah `nextRecurringDate()` di
-- src/lib/recurring.ts; keduanya HARUS memberi hasil yang sama, karena UI
-- memakai versi TS untuk pratinjau dan generator memakai versi SQL untuk
-- yang sungguhan.
create or replace function fin_recurring_next_date(
  p_date       date,
  p_frequency  text,
  p_anchor_day integer default null
) returns date
language plpgsql
immutable
as $$
declare
  v_first date;
  v_last  integer;
  v_day   integer;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  end if;

  if p_frequency = 'yearly' then
    v_first := make_date(
      extract(year from p_date)::integer + 1,
      extract(month from p_date)::integer,
      1
    );
  else
    v_first := (date_trunc('month', p_date) + interval '1 month')::date;
  end if;

  v_last := extract(day from (v_first + interval '1 month' - interval '1 day'))::integer;
  v_day  := coalesce(nullif(p_anchor_day, 0), extract(day from p_date)::integer);

  return v_first + (least(v_day, v_last) - 1);
end;
$$;

-- Buat "tagihan menunggu" untuk setiap jadwal yang jatuh tempo sampai
-- p_horizon (biasanya hari ini + beberapa hari, agar pengingat muncul
-- SEBELUM tanggalnya).
--
-- Dipanggil dari dua tempat: cron harian Vercel dan saat halaman Keuangan
-- dibuka. Keduanya aman dijalankan berulang — `on conflict do nothing` pada
-- (recurring_id, due_date) yang membuatnya idempotent.
create or replace function fin_generate_recurring_occurrences(
  p_family_id uuid,
  p_horizon   date
) returns integer
language plpgsql
as $$
declare
  v_row      recurring_transactions%rowtype;
  v_due      date;
  v_created  integer := 0;
  v_guard    integer;
  v_anchor   integer;
begin
  for v_row in
    select * from recurring_transactions
      where family_id = p_family_id
        and is_active = true
        and next_date <= p_horizon
      order by next_date
      for update
  loop
    v_due := v_row.next_date;
    v_guard := 0;
    v_anchor := extract(day from v_row.start_date)::integer;

    -- Jadwal yang lama tidak dibuka bisa tertinggal banyak periode. Batas 60
    -- iterasi mencegah satu baris rusak (mis. tanggal tahun 1990) menahan
    -- seluruh generator, tanpa menghalangi ketertinggalan yang wajar.
    while v_due <= p_horizon and v_guard < 60 loop
      exit when v_row.end_date is not null and v_due > v_row.end_date;

      insert into recurring_occurrences (family_id, recurring_id, due_date, amount)
      values (p_family_id, v_row.id, v_due, v_row.amount)
      on conflict (recurring_id, due_date) do nothing;

      if found then
        v_created := v_created + 1;
      end if;

      v_due := fin_recurring_next_date(v_due, v_row.frequency, v_anchor);
      v_guard := v_guard + 1;
    end loop;

    update recurring_transactions
      set next_date  = v_due,
          is_active  = case
                         when end_date is not null and v_due > end_date then false
                         else is_active
                       end,
          updated_at = now()
      where id = v_row.id;
  end loop;

  return v_created;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. PENYEMPURNAAN BELANJA
-- ---------------------------------------------------------------------
-- Produk favorit: ditandai manual, selalu tampil lebih dulu saat menyusun
-- rencana. Berbeda dari "sering dibeli" yang dihitung dari buy_count.
alter table products
  add column if not exists is_favorite boolean not null default false;

-- Kategori barang (mis. "sayur", "susu") untuk mengelompokkan checklist
-- supaya urutannya mengikuti rak toko, bukan urutan pengetikan.
alter table shopping_plan_items
  add column if not exists category text;

-- ---------------------------------------------------------------------
-- 4. INDEX PENDUKUNG PENCARIAN & REKOMENDASI
-- ---------------------------------------------------------------------
-- Pencarian "nama barang" memindai rincian transaksi, dan rekomendasi
-- belanja mengagregasi 2–3 bulan terakhir. Keduanya memfilter dengan
-- lower(name), jadi indexnya pun atas ekspresi yang sama.
-- `transaction_id` sudah punya index sejak 0018 (idx_sti_transaction), jadi
-- yang benar-benar baru di sini hanyalah index atas lower(name).
create index if not exists idx_shopping_transaction_items_name
  on shopping_transaction_items (lower(name));
create index if not exists idx_products_family_favorite
  on products (family_id, is_favorite, buy_count desc);
create index if not exists idx_shopping_transactions_family_category_date
  on shopping_transactions (family_id, category, date desc);

grant execute on all functions in schema public to service_role;
