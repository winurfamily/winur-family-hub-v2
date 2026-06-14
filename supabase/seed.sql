-- Winur Family Hub V2 — Seed Data
-- Jalankan setelah 0001_initial_schema.sql
-- PIN di-hash dengan bcrypt via pgcrypto (kompatibel dengan bcryptjs.compare)

do $$
declare
  v_family_id    uuid;
  v_ayah_id      uuid;
  v_mamah_id     uuid;
  v_daffa_id     uuid;
  v_dio_id       uuid;
  v_avatar_daffa uuid;
  v_avatar_dio   uuid;
  v_today        date := current_date;
  v_week_start   date := date_trunc('week', current_date)::date; -- Senin
  v_week_end     date := (date_trunc('week', current_date) + interval '6 days')::date; -- Minggu
begin
  -- FAMILY
  insert into families (name, setup_complete, theme, sound_enabled)
  values ('Winur Family', true, 'light', true)
  returning id into v_family_id;

  -- PROFILES
  insert into profiles (family_id, role, name, pin, age)
  values (v_family_id, 'admin', 'Ayah', crypt('080820', gen_salt('bf')), null)
  returning id into v_ayah_id;

  insert into profiles (family_id, role, name, pin, age)
  values (v_family_id, 'admin', 'Mamah', crypt('080820', gen_salt('bf')), null)
  returning id into v_mamah_id;

  insert into profiles (family_id, role, name, pin, age, level, xp, xp_next_level, point, saldo)
  values (v_family_id, 'child', 'Daffa', crypt('1234', gen_salt('bf')), 5, 1, 0, 20, 0, 0)
  returning id into v_daffa_id;

  insert into profiles (family_id, role, name, pin, age, level, xp, xp_next_level, point, saldo)
  values (v_family_id, 'child', 'Dio', crypt('1234', gen_salt('bf')), 2, 1, 0, 20, 0, 0)
  returning id into v_dio_id;

  -- DEFAULT AVATARS (1 per anak, tanpa kostum)
  insert into avatars (family_id, name, costume, image_url, unlock_level, is_default, generated_by)
  values (v_family_id, 'Daffa Default', null, '/avatars/daffa-default.png', 1, true, v_ayah_id)
  returning id into v_avatar_daffa;

  insert into avatars (family_id, name, costume, image_url, unlock_level, is_default, generated_by)
  values (v_family_id, 'Dio Default', null, '/avatars/dio-default.png', 1, true, v_ayah_id)
  returning id into v_avatar_dio;

  -- ASSIGN ACTIVE AVATAR
  update profiles set active_avatar_id = v_avatar_daffa where id = v_daffa_id;
  update profiles set active_avatar_id = v_avatar_dio where id = v_dio_id;

  -- UNLOCK DEFAULT AVATAR UNTUK MASING-MASING ANAK
  insert into profile_avatars (profile_id, avatar_id) values (v_daffa_id, v_avatar_daffa);
  insert into profile_avatars (profile_id, avatar_id) values (v_dio_id, v_avatar_dio);

  -- POCKETS DEFAULT
  insert into pockets (family_id, name, type, balance, split_percent, is_deletable)
  values
    (v_family_id, 'Belanja', 'default', 0, 0, false),
    (v_family_id, 'Tabungan', 'default', 0, 0, false);

  -- WEEKLY STREAKS (minggu berjalan)
  insert into weekly_streaks (profile_id, week_start, week_end, days_complete, is_complete, bonus_claimed)
  values
    (v_daffa_id, v_week_start, v_week_end, 0, false, false),
    (v_dio_id, v_week_start, v_week_end, 0, false, false);
end $$;
