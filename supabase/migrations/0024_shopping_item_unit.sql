-- =====================================================================
-- 0024 — Satuan barang pada rincian transaksi belanja
-- =====================================================================
-- shopping_plan_items sudah menyimpan satuan (kolom `note`), tetapi begitu
-- rencana diselesaikan satuan itu hilang: shopping_transaction_items hanya
-- punya name/qty/price. Akibatnya detail transaksi menulis "5 ×" sementara
-- checklist-nya menulis "5 kg" untuk barang yang sama.
--
-- Migration ini menambahkan kolom `unit` dan meneruskannya lewat kedua RPC
-- belanja. Aman dijalankan ulang.
--
-- Aplikasi tetap berjalan bila migration ini BELUM diterapkan:
--   - tulis  : `unit` dikirim sebagai kunci tambahan di dalam jsonb p_items,
--              dan RPC versi lama mengabaikannya tanpa error;
--   - baca   : getShoppingTransaction() mencoba SELECT dengan `unit` lalu
--              mengulang tanpa kolom itu bila ditolak (42703).
-- =====================================================================

alter table shopping_transaction_items
  add column if not exists unit text;

-- ---------------------------------------------------------------------
-- RPC: sisipkan unit dari p_items
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
    if v_qty <= 0 or v_price < 0 then
      raise exception 'Kuantitas/harga tidak valid.' using errcode = 'P0001';
    end if;
    v_total := v_total + round(v_qty * v_price);
  end loop;

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
