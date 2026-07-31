-- Winur Family Hub V2 — Terapkan ulang kolom dari 0007 & 0008
--
-- Audit skema langsung ke project Supabase menemukan dua kolom yang dipakai
-- kode aplikasi tetapi tidak ada di database — tanda migration 0007 dan 0008
-- tidak pernah dijalankan di project ini:
--
--   * profiles.background_url  — dibaca/ditulis src/app/actions/anak-assets.ts
--     dan src/app/actions/anak-settings.ts. Tanpa kolom ini, generate/hapus
--     background dunia anak gagal dengan 42703 saat dipakai.
--   * pets.style               — dibaca src/app/admin/dunia-anak/assets/
--     _components/pet-list.tsx dan dikirim create-pet-form.tsx.
--
-- Keduanya idempoten (if not exists), jadi aman dijalankan walau ternyata
-- sebagian sudah ada. Perubahan foreign key dari 0007 sengaja TIDAK diulang
-- di sini: bagian itu tidak idempoten (drop constraint by name) dan tidak
-- termasuk temuan audit.

alter table profiles add column if not exists background_url text;
alter table pets     add column if not exists style          text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'background_url'
  ) then
    raise exception 'profiles.background_url gagal dibuat';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pets' and column_name = 'style'
  ) then
    raise exception 'pets.style gagal dibuat';
  end if;

  raise notice 'OK — kolom 0007/0008 tersedia.';
end $$;
