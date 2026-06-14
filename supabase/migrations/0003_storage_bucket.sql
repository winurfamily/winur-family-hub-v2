-- Winur Family Hub V2 — Storage bucket untuk aset hasil generate AI
-- (gambar task/tugas, avatar, pet, item point shop). Public read, 512px PNG.

insert into storage.buckets (id, name, public)
values ('ai-assets', 'ai-assets', true)
on conflict (id) do nothing;
