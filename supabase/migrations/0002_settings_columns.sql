-- Winur Family Hub V2 — Settings columns
-- Tambahan kolom non-relasional untuk Settings (PRD modul Dunia Anak > Settings),
-- tidak mengubah entitas/relasi yang sudah LOCKED di 03_DATABASE_ERD.md.

alter table families
  add column if not exists default_task_money  numeric(8,2) not null default 1000,
  add column if not exists default_task_point  int not null default 1,
  add column if not exists default_task_xp     int not null default 1,
  add column if not exists default_tugas_money numeric(8,2) not null default 2000,
  add column if not exists default_tugas_point int not null default 2,
  add column if not exists default_tugas_xp    int not null default 2,
  add column if not exists streak_bonus_money  numeric(12,2) not null default 15000,
  add column if not exists streak_bonus_point  int not null default 15;

-- Setting investasi % per anak (decision #22: "return % admin set")
alter table profiles
  add column if not exists invest_return_percent numeric(5,2) not null default 10;
