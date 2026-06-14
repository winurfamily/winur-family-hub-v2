-- Izinkan transfer dari Saldo Utama (atau pocket) ke "Luar Pocket",
-- yaitu pengeluaran langsung yang tidak masuk ke pocket manapun.

alter table pocket_transfers drop constraint if exists pocket_transfers_to_type_check;
alter table pocket_transfers add constraint pocket_transfers_to_type_check check (to_type in ('main', 'pocket', 'external'));

alter table pocket_transfers drop constraint if exists pocket_transfers_to_target_check;
alter table pocket_transfers add constraint pocket_transfers_to_target_check check (
  (to_type = 'pocket' and to_pocket_id is not null) or (to_type in ('main','external') and to_pocket_id is null)
);
