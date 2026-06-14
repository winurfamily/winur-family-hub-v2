-- Tautkan pocket_transfers hasil auto-split ke baris income pemicunya,
-- agar saat pendapatan dihapus, split ke pocket bisa ikut dibatalkan.

alter table pocket_transfers add column if not exists income_id uuid references income(id) on delete set null;
