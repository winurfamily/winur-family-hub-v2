-- Tambah level unlock untuk tema kamar custom, agar admin bisa mengatur
-- pada level berapa tema tersebut terbuka untuk anak (sama seperti avatar/pet).

alter table room_themes add column if not exists unlock_level integer not null default 1;
