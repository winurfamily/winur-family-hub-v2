-- Winur Family Hub V2 — Background profil anak (AI generate, 1280x720)
--
-- Admin generate background dunia anak via AI (deskripsi bebas), disimpan
-- per-profil dan ditampilkan sebagai background dunia anak.

alter table profiles add column if not exists background_url text;
