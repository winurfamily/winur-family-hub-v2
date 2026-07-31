-- Winur Family Hub V2 — bersihkan "Default Pocket"
-- =====================================================================
-- Setup wizard lama membuat dua pocket bertipe 'default' ("Belanja" dan
-- "Tabungan"). Pocket "Tabungan" generik itu tidak pernah dipakai fitur apa
-- pun, saldonya selalu nol, dan namanya tertukar dengan "Tabungan {anak}"
-- sehingga membingungkan di menu Dompet.
--
-- Migration ini:
--   1. menghapus pocket sisa seed yang benar-benar tidak terpakai,
--   2. menghapus konsep tipe 'default' dari data yang tersisa.
--
-- AMAN untuk Dunia Anak: pocket bernama "Tabungan {nama anak}" dan pocket apa
-- pun yang bersaldo, punya transaksi, punya pendapatan, atau pernah dipakai
-- transfer TIDAK PERNAH dihapus — syaratnya dicek eksplisit di bawah.
-- =====================================================================

begin;

delete from pockets p
where p.type = 'default'
  and p.name = 'Tabungan'
  and coalesce(p.balance, 0) = 0
  -- bukan cermin celengan anak
  and not exists (
    select 1
    from profiles c
    where c.family_id = p.family_id
      and c.role = 'child'
      and p.name = 'Tabungan ' || c.name
  )
  -- tidak pernah dipakai di mana pun
  and not exists (select 1 from income i where i.pocket_id = p.id)
  and not exists (select 1 from shopping_transactions t where t.pocket_id = p.id)
  and not exists (
    select 1 from pocket_transfers tr
    where tr.from_pocket_id = p.id or tr.to_pocket_id = p.id
  );

-- Sisanya tetap ada, tapi tidak lagi ditandai "default": semua pocket kini
-- setara dan sepenuhnya dikelola pengguna.
update pockets set type = 'custom' where type = 'default';

commit;
