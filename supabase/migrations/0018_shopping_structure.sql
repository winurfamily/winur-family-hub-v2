-- Winur Family Hub V2 — Struktur Belanja (header + item)
-- =====================================================================
-- Sebelumnya satu baris shopping_transactions = satu BARANG, sehingga
-- tidak ada tempat untuk menyimpan nama toko, kategori pengeluaran, atau
-- bukti struk milik satu kali belanja.
--
-- Migration ini MEMPROMOSIKAN shopping_transactions menjadi tabel HEADER
-- (satu baris = satu transaksi belanja) dan memindahkan rincian barang ke
-- shopping_transaction_items. Tidak ada tabel lama yang dibuang: kolom
-- name/qty/price tetap ada dan tetap terisi agar query lama tidak pecah,
-- dan setiap baris lama otomatis di-backfill menjadi satu item.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolom header baru
-- ---------------------------------------------------------------------
alter table shopping_transactions
  add column if not exists merchant     text,
  add column if not exists category     text,
  add column if not exists note         text,
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists updated_by   uuid references profiles (id),
  add column if not exists client_token uuid;

create unique index if not exists uq_shopping_transactions_client_token
  on shopping_transactions (family_id, client_token) where client_token is not null;

-- Baris lama tidak punya nama toko; pakai nama barangnya sebagai merchant
-- supaya riwayat tetap terbaca, bukan kosong.
update shopping_transactions set merchant = name where merchant is null;
update shopping_transactions set category = 'lainnya' where category is null;

-- Transaksi multi-item tidak punya satu harga satuan tunggal.
alter table shopping_transactions alter column price drop not null;
alter table shopping_transactions alter column qty   drop not null;

create index if not exists idx_shopping_transactions_family_created
  on shopping_transactions (family_id, created_at desc);
create index if not exists idx_shopping_transactions_category
  on shopping_transactions (family_id, category);

-- ---------------------------------------------------------------------
-- 2. Rincian barang per transaksi
-- ---------------------------------------------------------------------
create table if not exists shopping_transaction_items (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references shopping_transactions (id) on delete cascade,
  product_id      uuid references products (id) on delete set null,
  name            text not null,
  qty             numeric(10, 2) not null default 1 check (qty > 0),
  price           numeric(14, 2) not null default 0 check (price >= 0),
  subtotal        numeric(14, 2) not null default 0 check (subtotal >= 0),
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sti_transaction
  on shopping_transaction_items (transaction_id, position);

-- Backfill: setiap transaksi lama (1 baris = 1 barang) menjadi 1 item.
-- Guard NOT EXISTS membuat migration aman dijalankan ulang.
insert into shopping_transaction_items
  (transaction_id, product_id, name, qty, price, subtotal, position, created_at)
select
  s.id, s.product_id, s.name, coalesce(s.qty, 1), coalesce(s.price, 0),
  s.total, 0, s.created_at
from shopping_transactions s
where not exists (
  select 1 from shopping_transaction_items i where i.transaction_id = s.id
);

-- ---------------------------------------------------------------------
-- 3. Rencana belanja v2 — status yang lebih kaya
-- ---------------------------------------------------------------------
alter table shopping_plans
  add column if not exists note        text,
  add column if not exists updated_at  timestamptz not null default now();

-- 'planned' (lama) dipetakan ke 'active'.
alter table shopping_plans drop constraint if exists shopping_plans_status_check;
update shopping_plans set status = 'active' where status = 'planned';
alter table shopping_plans add constraint shopping_plans_status_check
  check (status in ('draft', 'active', 'done', 'cancelled', 'archived'));
alter table shopping_plans alter column status set default 'active';

alter table shopping_plan_items
  add column if not exists status          text not null default 'pending',
  add column if not exists note            text,
  add column if not exists transaction_id  uuid references shopping_transactions (id) on delete set null,
  add column if not exists position        int not null default 0,
  add column if not exists updated_at      timestamptz not null default now();

-- Sinkronkan status dengan kolom `checked` lama (tetap dipertahankan).
update shopping_plan_items set status = 'bought' where checked = true and status = 'pending';

alter table shopping_plan_items drop constraint if exists shopping_plan_items_status_check;
alter table shopping_plan_items add constraint shopping_plan_items_status_check
  check (status in ('pending', 'bought', 'cancelled'));

create index if not exists idx_plan_items_plan on shopping_plan_items (plan_id, position);

-- ---------------------------------------------------------------------
-- 4. Kategori produk untuk saran otomatis di form belanja
-- ---------------------------------------------------------------------
create index if not exists idx_products_family_name
  on products (family_id, name_normalized);

-- ---------------------------------------------------------------------
-- 5. RPC BELANJA — header + item + saldo dalam satu transaksi
-- ---------------------------------------------------------------------
-- p_items: jsonb array [{ "name": text, "qty": number, "price": number }]
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
    if v_price < 0 then
      raise exception 'Harga tidak boleh negatif.' using errcode = 'P0001';
    end if;
    v_total := v_total + round(v_qty * v_price);
  end loop;

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
      (transaction_id, name, qty, price, subtotal, position)
    values
      (v_id, coalesce(nullif(v_item ->> 'name', ''), 'Item'),
       v_qty, v_price, round(v_qty * v_price), v_pos);
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
    if v_qty <= 0 or v_price < 0 then
      raise exception 'Kuantitas/harga tidak valid.' using errcode = 'P0001';
    end if;
    v_total := v_total + round(v_qty * v_price);
  end loop;

  -- Kembalikan dulu dana lama, lalu potong dana baru. Bila sumber dana
  -- berubah, keduanya jatuh ke akun yang berbeda.
  perform fin_apply_balance(p_family_id, v_old_pocket, v_old_total, true);
  perform fin_apply_balance(p_family_id, p_pocket_id, -v_total);

  delete from shopping_transaction_items where transaction_id = p_transaction_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty   := coalesce((v_item ->> 'qty')::numeric, 1);
    v_price := round(coalesce((v_item ->> 'price')::numeric, 0));
    insert into shopping_transaction_items
      (transaction_id, name, qty, price, subtotal, position)
    values
      (p_transaction_id, coalesce(nullif(v_item ->> 'name', ''), 'Item'),
       v_qty, v_price, round(v_qty * v_price), v_pos);
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

-- Menghapus belanja MENGEMBALIKAN dana ke sumbernya — berbeda dari
-- transfer, karena uang belanja memang tidak jadi keluar dari keluarga.
create or replace function fin_delete_shopping(
  p_transaction_id  uuid,
  p_family_id       uuid
) returns void
language plpgsql
as $$
declare
  v_total   numeric;
  v_pocket  uuid;
begin
  select total, pocket_id into v_total, v_pocket
    from shopping_transactions
    where id = p_transaction_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform fin_apply_balance(p_family_id, v_pocket, v_total, true);

  -- Lepaskan tautan rencana supaya rencana belanja tidak ikut rusak.
  update shopping_plan_items set transaction_id = null
    where transaction_id = p_transaction_id;

  delete from shopping_transactions
    where id = p_transaction_id and family_id = p_family_id;
end;
$$;

grant execute on all functions in schema public to service_role;
