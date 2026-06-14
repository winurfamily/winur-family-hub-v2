-- Winur Family Hub V2 — Hapus avatar/pet & kolom style untuk pet
--
-- 1. Tambah kolom `style` di tabel pets (mirip `costume` di avatars) supaya
--    admin bisa mengisi detail prompt AI tambahan saat generate gambar pet.
-- 2. Ubah FK avatar_id/pet_id di profile_avatars/profile_pets jadi
--    ON DELETE CASCADE, dan active_avatar_id/active_pet_id di profiles jadi
--    ON DELETE SET NULL, supaya admin bisa menghapus avatar/pet dari library
--    tanpa diblok foreign key constraint.

alter table pets add column if not exists style text;

alter table profile_avatars
  drop constraint profile_avatars_avatar_id_fkey,
  add constraint profile_avatars_avatar_id_fkey foreign key (avatar_id) references avatars(id) on delete cascade;

alter table profile_pets
  drop constraint profile_pets_pet_id_fkey,
  add constraint profile_pets_pet_id_fkey foreign key (pet_id) references pets(id) on delete cascade;

alter table profiles
  drop constraint profiles_active_avatar_id_fkey,
  add constraint profiles_active_avatar_id_fkey foreign key (active_avatar_id) references avatars(id) on delete set null,
  drop constraint profiles_active_pet_id_fkey,
  add constraint profiles_active_pet_id_fkey foreign key (active_pet_id) references pets(id) on delete set null;
