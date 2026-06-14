-- Izinkan pocket_transfers menarik saldo pocket kembali ke Saldo Utama.

alter table pocket_transfers add column if not exists to_type text not null default 'pocket' check (to_type in ('main', 'pocket'));
alter table pocket_transfers alter column to_pocket_id drop not null;
alter table pocket_transfers add constraint pocket_transfers_to_target_check check (
  (to_type = 'pocket' and to_pocket_id is not null) or (to_type = 'main' and to_pocket_id is null)
);
