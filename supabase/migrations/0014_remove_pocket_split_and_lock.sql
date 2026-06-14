-- Hilangkan fitur split persentase otomatis & batasan "pocket default tidak bisa dihapus".
-- Semua pocket sekarang bisa dihapus (selama saldo 0); distribusi dana dilakukan manual via Transfer.

alter table pockets drop column if exists split_percent;
alter table pockets drop column if exists is_deletable;
