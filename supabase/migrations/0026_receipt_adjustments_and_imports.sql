-- =====================================================================
-- 0026 — Baris penyesuaian bernilai negatif + idempotensi impor struk
-- =====================================================================
-- Dua hal yang sebelumnya tidak bisa diwakili apa adanya:
--
-- 1. DISKON, VOUCHER, dan SELISIH pada struk.
--    shopping_transaction_items memaksa price >= 0 dan subtotal >= 0, dan
--    fin_create_shopping menolak harga negatif. Akibatnya satu-satunya cara
--    membuat total transaksi sama dengan yang dibayar di kasir adalah
--    MENGUBAH DIAM-DIAM harga tiap barang (lihat distributeTotal lama) —
--    sehingga detail transaksi menampilkan harga yang tidak pernah tertulis
--    di struk mana pun.
--
--    Sesudah migration ini, "Diskon transaksi", "Voucher", dan "Selisih struk"
--    menjadi BARIS TERSENDIRI bernilai negatif, persis seperti struk
--    mencetaknya. Harga barang tetap apa adanya dan bisa ditelusuri.
--
--    Penjaga yang tetap berlaku: TOTAL transaksi tidak boleh negatif. Yang
--    dilonggarkan hanya nilai per baris, bukan keseluruhannya.
--
-- 2. STRUK YANG SAMA DIIMPOR DUA KALI.
--    Tabel receipt_imports menyimpan sidik jari (SHA-256) berkas struk per
--    keluarga. Unik per (family_id, fingerprint), jadi mengunggah PDF yang
--    sama untuk kedua kalinya menemukan rencana yang sudah ada alih-alih
--    membuat rencana kedua.
--
-- Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Longgarkan batasan per baris
-- ---------------------------------------------------------------------
alter table shopping_transaction_items
  drop constraint if exists shopping_transaction_items_price_check;

alter table shopping_transaction_items
  drop constraint if exists shopping_transaction_items_subtotal_check;

-- Kuantitas TETAP harus positif: baris penyesuaian selalu qty = 1 dan
-- nilainya diletakkan pada harga, bukan pada kuantitas negatif.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shopping_transaction_items_qty_check'
      and conrelid = 'shopping_transaction_items'::regclass
  ) then
    alter table shopping_transaction_items
      add constraint shopping_transaction_items_qty_check check (qty > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. RPC: izinkan harga negatif, jaga total tetap >= 0
-- ---------------------------------------------------------------------
create or replace function fin_create_shopping(
  p_family_id     uuid,
  p_merchant      text,
  p_date          date,
  p_pocket_id     uuid,
  p_category      text,
  p_note          text,
  p_source        text,
  p_plan_id       uuid,
  p_items         jsonb,
  p_created_by    uuid,
  p_client_token  uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id     uuid;
  v_total  numeric := 0;
  v_item   jsonb;
  v_qty    numeric;
  v_price  numeric;
  v_pos    int := 0;
  v_count  int;
begin
  v_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  if v_count = 0 then
    raise exception 'Tambahkan minimal satu barang.' using errcode = 'P0001';
  end if;

  if p_client_token is not null then
    select id into v_id from shopping_transactions
      where family_id = p_family_id and client_token = p_client_token;
    if found then
      return v_id;
    end if;
  end if;

  if p_pocket_id is not null then
    perform 1 from pockets where id = p_pocket_id and family_id = p_family_id;
    if not found then
      raise exception 'Sumber dana tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := coalesce((v_item ->> 'qty')::numeric, 1);
    v_price := round(coalesce((v_item ->> 'price')::numeric, 0));
    if v_qty <= 0 then
      raise exception 'Kuantitas harus lebih dari 0.' using errcode = 'P0001';
    end if;
    -- Harga negatif DIIZINKAN: itulah baris diskon/voucher/selisih.
    v_total := v_total + round(v_qty * v_price);
  end loop;

  if v_total < 0 then
    raise exception 'Total transaksi tidak boleh negatif.' using errcode = 'P0001';
  end if;

  insert into shopping_transactions (
    family_id, plan_id, pocket_id, product_id, merchant, name,
    qty, price, total, date, source, category, note,
    created_by, updated_by, client_token
  )
  values (
    p_family_id, p_plan_id, p_pocket_id, null,
    p_merchant, p_merchant,
    null, null, v_total, p_date, p_source,
    coalesce(nullif(p_category, ''), 'lainnya'), nullif(p_note, ''),
    p_created_by, p_created_by, p_client_token
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := coalesce((v_item ->> 'qty')::numeric, 1);
    v_price := round(coalesce((v_item ->> 'price')::numeric, 0));
    insert into shopping_transaction_items
      (transaction_id, name, qty, price, subtotal, unit, position)
    values
      (v_id, coalesce(nullif(v_item ->> 'name', ''), 'Item'),
       v_qty, v_price, round(v_qty * v_price),
       nullif(trim(coalesce(v_item ->> 'unit', '')), ''), v_pos);
    v_pos := v_pos + 1;
  end loop;

  perform fin_apply_balance(p_family_id, p_pocket_id, -v_total);

  return v_id;
end;
$$;

create or replace function fin_update_shopping(
  p_transaction_id  uuid,
  p_family_id       uuid,
  p_merchant        text,
  p_date            date,
  p_pocket_id       uuid,
  p_category        text,
  p_note            text,
  p_items           jsonb,
  p_updated_by      uuid
) returns void
language plpgsql
as $$
declare
  v_old_total   numeric;
  v_old_pocket  uuid;
  v_total       numeric := 0;
  v_item        jsonb;
  v_qty         numeric;
  v_price       numeric;
  v_pos         int := 0;
begin
  select total, pocket_id into v_old_total, v_old_pocket
    from shopping_transactions
    where id = p_transaction_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Tambahkan minimal satu barang.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := coalesce((v_item ->> 'qty')::numeric, 1);
    v_price := round(coalesce((v_item ->> 'price')::numeric, 0));
    if v_qty <= 0 then
      raise exception 'Kuantitas harus lebih dari 0.' using errcode = 'P0001';
    end if;
    v_total := v_total + round(v_qty * v_price);
  end loop;

  if v_total < 0 then
    raise exception 'Total transaksi tidak boleh negatif.' using errcode = 'P0001';
  end if;

  perform fin_apply_balance(p_family_id, v_old_pocket, v_old_total, true);
  perform fin_apply_balance(p_family_id, p_pocket_id, -v_total);

  delete from shopping_transaction_items where transaction_id = p_transaction_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := coalesce((v_item ->> 'qty')::numeric, 1);
    v_price := round(coalesce((v_item ->> 'price')::numeric, 0));
    insert into shopping_transaction_items
      (transaction_id, name, qty, price, subtotal, unit, position)
    values
      (p_transaction_id, coalesce(nullif(v_item ->> 'name', ''), 'Item'),
       v_qty, v_price, round(v_qty * v_price),
       nullif(trim(coalesce(v_item ->> 'unit', '')), ''), v_pos);
    v_pos := v_pos + 1;
  end loop;

  update shopping_transactions set
    merchant   = p_merchant,
    name       = p_merchant,
    date       = p_date,
    pocket_id  = p_pocket_id,
    category   = coalesce(nullif(p_category, ''), 'lainnya'),
    note       = nullif(p_note, ''),
    total      = v_total,
    updated_at = now(),
    updated_by = p_updated_by
  where id = p_transaction_id and family_id = p_family_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Idempotensi impor struk
-- ---------------------------------------------------------------------
-- Sidik jari berkas (SHA-256 hex) DAN sidik jari data transaksi (merchant +
-- tanggal + total) disimpan terpisah: berkas yang di-scan ulang menghasilkan
-- byte berbeda tetapi transaksi yang sama, dan sebaliknya PDF identik selalu
-- menghasilkan hash identik. Keduanya menunjuk ke rencana yang sama.
create table if not exists receipt_imports (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families (id) on delete cascade,
  plan_id           uuid references shopping_plans (id) on delete set null,
  file_fingerprint  text not null,
  data_fingerprint  text,
  merchant          text,
  receipt_date      date,
  total_amount      numeric(14, 2),
  item_count        int not null default 0,
  page_count        int not null default 0,
  storage_path      text,
  created_by        uuid references profiles (id),
  created_at        timestamptz not null default now()
);

create unique index if not exists uq_receipt_imports_file
  on receipt_imports (family_id, file_fingerprint);

create index if not exists idx_receipt_imports_data
  on receipt_imports (family_id, data_fingerprint)
  where data_fingerprint is not null;

create index if not exists idx_receipt_imports_plan
  on receipt_imports (plan_id);

alter table receipt_imports enable row level security;

-- Akses hanya lewat service role (server actions memvalidasi family_id lebih
-- dulu), sama seperti receipt_attachments di 0019.
do $$
begin
  execute 'drop policy if exists "receipt_imports anon" on receipt_imports';
end $$;

revoke all on receipt_imports from anon, authenticated;
grant all on receipt_imports to service_role;

-- ---------------------------------------------------------------------
-- 4. Struk PDF boleh diunggah ke bucket privat `receipts`
-- ---------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array[
         'image/webp', 'image/jpeg', 'image/png', 'application/pdf'
       ]
 where id = 'receipts';
