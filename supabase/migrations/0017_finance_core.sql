-- Winur Family Hub V2 — Finance Core
-- =====================================================================
-- MASALAH YANG DIPERBAIKI
--
-- Sebelum migration ini "Saldo Utama" TIDAK pernah disimpan. Nilainya
-- dihitung ulang setiap render di getFinanceSummary():
--
--   saldo_utama = Σ income
--               − Σ pocket_transfers(from_type='main')
--               + Σ pocket_transfers(to_type='main')
--               − Σ shopping_transactions(pocket_id IS NULL)
--
-- Akibatnya menghapus satu baris pocket_transfers otomatis MENGEMBALIKAN
-- uang ke Saldo Utama — bukan karena ada trigger, tapi karena baris itu
-- adalah satu-satunya jejak bahwa uang pernah keluar.
--
-- Migration ini memindahkan Saldo Utama menjadi kolom tersimpan
-- (families.main_balance) yang di-backfill PERSIS dengan rumus lama,
-- sehingga saldo yang tampil di aplikasi tidak berubah sedikit pun.
-- Setelah itu riwayat transfer bisa dihapus permanen tanpa efek saldo.
--
-- Semua perubahan bersifat additive: tidak ada DROP TABLE / DELETE data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Saldo Utama jadi kolom tersimpan
-- ---------------------------------------------------------------------
alter table families
  add column if not exists main_balance numeric(14, 2) not null default 0;

-- Backfill satu kali. Guard `main_balance_initialized` memastikan
-- migration aman dijalankan ulang (idempotent) tanpa menimpa saldo yang
-- sudah berjalan lewat RPC.
alter table families
  add column if not exists main_balance_initialized boolean not null default false;

update families f
set
  main_balance = coalesce(
    (select sum(i.amount) from income i where i.family_id = f.id), 0
  ) - coalesce(
    (select sum(t.amount) from pocket_transfers t
      where t.family_id = f.id and t.from_type = 'main'), 0
  ) + coalesce(
    (select sum(t.amount) from pocket_transfers t
      where t.family_id = f.id and t.to_type = 'main'), 0
  ) - coalesce(
    (select sum(s.total) from shopping_transactions s
      where s.family_id = f.id and s.pocket_id is null), 0
  ),
  main_balance_initialized = true
where f.main_balance_initialized = false;

-- ---------------------------------------------------------------------
-- 2. Perluas tabel income (akun tujuan, kategori, jejak audit)
-- ---------------------------------------------------------------------
alter table income
  add column if not exists pocket_id   uuid references pockets (id) on delete set null,
  add column if not exists category    text,
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists updated_by  uuid references profiles (id);

-- pocket_id NULL = masuk ke Saldo Utama (perilaku lama, tetap valid).
comment on column income.pocket_id is
  'Akun tujuan pendapatan. NULL = Saldo Utama (families.main_balance).';

update income set category = 'lainnya' where category is null;

create index if not exists idx_income_family_date
  on income (family_id, date desc, created_at desc);
create index if not exists idx_income_family_pocket
  on income (family_id, pocket_id);

-- ---------------------------------------------------------------------
-- 3. Idempotency token — cegah double-submit menghasilkan dua record
-- ---------------------------------------------------------------------
alter table income            add column if not exists client_token uuid;
alter table pocket_transfers  add column if not exists client_token uuid;

create unique index if not exists uq_income_client_token
  on income (family_id, client_token) where client_token is not null;
create unique index if not exists uq_pocket_transfers_client_token
  on pocket_transfers (family_id, client_token) where client_token is not null;

create index if not exists idx_pocket_transfers_family_created
  on pocket_transfers (family_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Helper internal — mutasi saldo satu akun dengan row lock
-- ---------------------------------------------------------------------
-- p_pocket_id NULL  -> mutasi families.main_balance
-- p_pocket_id ada   -> mutasi pockets.balance
-- p_delta negatif   -> pengurangan; ditolak bila membuat saldo minus
--                      (kecuali p_allow_negative = true untuk koreksi data lama)
create or replace function fin_apply_balance(
  p_family_id       uuid,
  p_pocket_id       uuid,
  p_delta           numeric,
  p_allow_negative  boolean default false
) returns numeric
language plpgsql
as $$
declare
  v_new     numeric;
  v_label   text;
begin
  if p_delta = 0 then
    if p_pocket_id is null then
      select main_balance into v_new from families where id = p_family_id for update;
    else
      select balance into v_new from pockets
        where id = p_pocket_id and family_id = p_family_id for update;
    end if;
    return v_new;
  end if;

  if p_pocket_id is null then
    -- FOR UPDATE mengunci baris family sampai transaksi selesai,
    -- sehingga dua request paralel tidak bisa saling menimpa saldo.
    select main_balance into v_new from families where id = p_family_id for update;
    if not found then
      raise exception 'Keluarga tidak ditemukan.' using errcode = 'P0002';
    end if;
    v_new := v_new + p_delta;
    v_label := 'Saldo Utama';

    if v_new < 0 and not p_allow_negative then
      raise exception 'Saldo Utama tidak cukup.' using errcode = 'P0001';
    end if;

    update families set main_balance = v_new where id = p_family_id;
  else
    select balance, name into v_new, v_label from pockets
      where id = p_pocket_id and family_id = p_family_id for update;
    if not found then
      raise exception 'Pocket tidak ditemukan.' using errcode = 'P0002';
    end if;
    v_new := v_new + p_delta;

    if v_new < 0 and not p_allow_negative then
      raise exception 'Saldo pocket "%" tidak cukup.', v_label using errcode = 'P0001';
    end if;

    update pockets set balance = v_new where id = p_pocket_id;
  end if;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC PENDAPATAN — record + saldo dalam satu transaksi
-- ---------------------------------------------------------------------
create or replace function fin_create_income(
  p_family_id     uuid,
  p_source        text,
  p_amount        numeric,
  p_date          date,
  p_pocket_id     uuid,
  p_category      text,
  p_note          text,
  p_created_by    uuid,
  p_client_token  uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id      uuid;
  v_amount  numeric := round(p_amount);
begin
  if v_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0.' using errcode = 'P0001';
  end if;

  -- Idempotency: request kedua dengan token sama mengembalikan record pertama.
  if p_client_token is not null then
    select id into v_id from income
      where family_id = p_family_id and client_token = p_client_token;
    if found then
      return v_id;
    end if;
  end if;

  if p_pocket_id is not null then
    perform 1 from pockets where id = p_pocket_id and family_id = p_family_id;
    if not found then
      raise exception 'Pocket tujuan tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  insert into income (
    family_id, source, amount, date, pocket_id, category, note,
    created_by, updated_by, client_token
  )
  values (
    p_family_id, p_source, v_amount, p_date, p_pocket_id,
    coalesce(nullif(p_category, ''), 'lainnya'), nullif(p_note, ''),
    p_created_by, p_created_by, p_client_token
  )
  returning id into v_id;

  perform fin_apply_balance(p_family_id, p_pocket_id, v_amount);

  return v_id;
end;
$$;

create or replace function fin_update_income(
  p_income_id   uuid,
  p_family_id   uuid,
  p_source      text,
  p_amount      numeric,
  p_date        date,
  p_pocket_id   uuid,
  p_category    text,
  p_note        text,
  p_updated_by  uuid
) returns void
language plpgsql
as $$
declare
  v_old_amount  numeric;
  v_old_pocket  uuid;
  v_amount      numeric := round(p_amount);
begin
  if v_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0.' using errcode = 'P0001';
  end if;

  select amount, pocket_id into v_old_amount, v_old_pocket
    from income where id = p_income_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Pendapatan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if p_pocket_id is not null then
    perform 1 from pockets where id = p_pocket_id and family_id = p_family_id;
    if not found then
      raise exception 'Pocket tujuan tidak ditemukan.' using errcode = 'P0002';
    end if;
  end if;

  if v_old_pocket is distinct from p_pocket_id then
    -- Akun tujuan pindah: tarik penuh dari akun lama, setor penuh ke akun baru.
    -- allow_negative pada akun lama karena uangnya mungkin sudah terpakai —
    -- koreksi historis tidak boleh gagal di tengah jalan.
    perform fin_apply_balance(p_family_id, v_old_pocket, -v_old_amount, true);
    perform fin_apply_balance(p_family_id, p_pocket_id, v_amount);
  else
    perform fin_apply_balance(p_family_id, p_pocket_id, v_amount - v_old_amount, true);
  end if;

  update income set
    source     = p_source,
    amount     = v_amount,
    date       = p_date,
    pocket_id  = p_pocket_id,
    category   = coalesce(nullif(p_category, ''), 'lainnya'),
    note       = nullif(p_note, ''),
    updated_at = now(),
    updated_by = p_updated_by
  where id = p_income_id and family_id = p_family_id;
end;
$$;

create or replace function fin_delete_income(
  p_income_id  uuid,
  p_family_id  uuid
) returns void
language plpgsql
as $$
declare
  v_amount  numeric;
  v_pocket  uuid;
begin
  select amount, pocket_id into v_amount, v_pocket
    from income where id = p_income_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Pendapatan tidak ditemukan.' using errcode = 'P0002';
  end if;

  -- Pendapatan dihapus = uangnya tidak pernah ada -> saldo tujuan dikurangi.
  perform fin_apply_balance(p_family_id, v_pocket, -v_amount, true);

  -- Auto-split lama (0012) sudah tidak dipakai; lepaskan tautannya supaya
  -- riwayat transfer tetap utuh dan saldo tidak ikut berubah.
  update pocket_transfers set income_id = null
    where family_id = p_family_id and income_id = p_income_id;

  delete from income where id = p_income_id and family_id = p_family_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC TRANSFER
-- ---------------------------------------------------------------------
create or replace function fin_create_transfer(
  p_family_id     uuid,
  p_from_type     text,
  p_from_pocket   uuid,
  p_to_type       text,
  p_to_pocket     uuid,
  p_amount        numeric,
  p_note          text,
  p_created_by    uuid,
  p_client_token  uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id      uuid;
  v_amount  numeric := round(p_amount);
begin
  if v_amount <= 0 then
    raise exception 'Nominal harus lebih dari 0.' using errcode = 'P0001';
  end if;
  if p_from_type = 'pocket' and p_from_pocket is null then
    raise exception 'Pilih pocket asal.' using errcode = 'P0001';
  end if;
  if p_to_type = 'pocket' and p_to_pocket is null then
    raise exception 'Pilih pocket tujuan.' using errcode = 'P0001';
  end if;
  if p_from_type = 'pocket' and p_to_type = 'pocket' and p_from_pocket = p_to_pocket then
    raise exception 'Pocket asal dan tujuan tidak boleh sama.' using errcode = 'P0001';
  end if;
  if p_from_type = 'main' and p_to_type = 'main' then
    raise exception 'Asal dan tujuan tidak boleh sama.' using errcode = 'P0001';
  end if;

  if p_client_token is not null then
    select id into v_id from pocket_transfers
      where family_id = p_family_id and client_token = p_client_token;
    if found then
      return v_id;
    end if;
  end if;

  -- Kunci akun dengan urutan deterministik (asal dulu, lalu tujuan) untuk
  -- menghindari deadlock saat dua transfer berlawanan arah berjalan bersamaan.
  perform fin_apply_balance(
    p_family_id,
    case when p_from_type = 'pocket' then p_from_pocket else null end,
    -v_amount
  );

  if p_to_type <> 'external' then
    perform fin_apply_balance(
      p_family_id,
      case when p_to_type = 'pocket' then p_to_pocket else null end,
      v_amount
    );
  end if;

  insert into pocket_transfers (
    family_id, from_type, from_pocket_id, to_type, to_pocket_id,
    amount, note, created_by, client_token
  )
  values (
    p_family_id, p_from_type,
    case when p_from_type = 'pocket' then p_from_pocket else null end,
    p_to_type,
    case when p_to_type = 'pocket' then p_to_pocket else null end,
    v_amount, nullif(p_note, ''), p_created_by, p_client_token
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- HAPUS RIWAYAT TRANSFER — HANYA menghapus record.
--
-- Fungsi ini SENGAJA tidak menyentuh saldo apa pun. Uang yang sudah
-- dipindahkan tetap berada di akun tujuan. Ini berbeda dari "batalkan
-- transfer" (fin_reverse_transfer) yang membuat transaksi pembalik baru.
create or replace function fin_delete_transfer(
  p_transfer_id  uuid,
  p_family_id    uuid
) returns void
language plpgsql
as $$
begin
  perform 1 from pocket_transfers
    where id = p_transfer_id and family_id = p_family_id;
  if not found then
    raise exception 'Riwayat transfer tidak ditemukan.' using errcode = 'P0002';
  end if;

  delete from pocket_transfers
    where id = p_transfer_id and family_id = p_family_id;
end;
$$;

-- BATALKAN TRANSFER — operasi terpisah yang memang memindahkan uang kembali.
-- Tidak dipakai oleh tombol "Hapus riwayat"; disediakan agar kedua konsep
-- tidak pernah tercampur lagi seperti pada implementasi lama.
create or replace function fin_reverse_transfer(
  p_transfer_id  uuid,
  p_family_id    uuid,
  p_created_by   uuid
) returns uuid
language plpgsql
as $$
declare
  v_row     pocket_transfers%rowtype;
  v_new_id  uuid;
begin
  select * into v_row from pocket_transfers
    where id = p_transfer_id and family_id = p_family_id
    for update;
  if not found then
    raise exception 'Transfer tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_row.to_type = 'external' then
    raise exception 'Transfer ke luar pocket tidak bisa dibatalkan otomatis.'
      using errcode = 'P0001';
  end if;

  v_new_id := fin_create_transfer(
    p_family_id,
    v_row.to_type,
    v_row.to_pocket_id,
    v_row.from_type,
    v_row.from_pocket_id,
    v_row.amount,
    'Pembatalan transfer ' || to_char(v_row.created_at, 'DD/MM/YYYY'),
    p_created_by,
    null
  );

  return v_new_id;
end;
$$;

grant execute on all functions in schema public to service_role;
