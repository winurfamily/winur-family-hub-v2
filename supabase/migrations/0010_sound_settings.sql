-- Winur Family Hub V2 — Sound settings per profil
--
-- Menyimpan preferensi audio (BGM/SFX volume, mute) per profil sebagai JSONB
-- agar bisa dipulihkan lintas device. Shape bebas, divalidasi di app layer.

alter table profiles add column if not exists sound_settings jsonb not null default '{}'::jsonb;
