-- Winur Family Hub V2 — Tema kamar custom (V3 redesign, BAGIAN 2)
--
-- Tema bawaan (roket/minecraft/tayo) didefinisikan di kode (BUILTIN_THEMES) dan
-- tidak butuh row di tabel ini. Tabel ini menampung tema custom yang akan bisa
-- diupload admin per-anak di masa depan (gambar siang/malam + konfigurasi
-- hotspot/walkable/default position sebagai JSON).

create table if not exists room_themes (
  id                 uuid primary key default gen_random_uuid(),
  owner_profile_id   uuid not null references profiles(id) on delete cascade,
  name               text not null,
  day_image_url      text not null,
  night_image_url    text not null,
  config             jsonb not null,
  created_at         timestamptz not null default now()
);

alter table room_themes enable row level security;

-- Tema aktif anak: key tema bawaan (mis. 'roket') atau id tema custom (uuid as text).
alter table profiles add column if not exists active_theme_key text;

insert into storage.buckets (id, name, public)
values ('room-themes', 'room-themes', true)
on conflict (id) do nothing;
