"use server";

import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeSetupSchema, type CompleteSetupInput } from "@/lib/validation/setup";
import { xpNeeded } from "@/lib/xp";

const BCRYPT_ROUNDS = 10;
const PLACEHOLDER_AVATAR = "/avatars/placeholder.png";

export interface CompleteSetupResult {
  success: boolean;
  error?: string;
}

function currentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Min, 1=Sen, ... 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: toISODate(monday), weekEnd: toISODate(sunday) };
}

/**
 * Jalankan First Time Setup Wizard:
 * - buat family
 * - buat profile admin (Ayah, Mamah) + PIN
 * - buat profile anak + avatar default (unlock) + weekly streak minggu berjalan
 * - buat pocket Belanja & Tabungan default (level keluarga)
 * - tandai families.setup_complete = true
 */
export async function completeSetup(input: CompleteSetupInput): Promise<CompleteSetupResult> {
  const parsed = completeSetupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const { familyName, ayahName, mamahName, adminPin, children } = parsed.data;
  const supabase = createAdminClient();

  // Pastikan belum ada family (cegah setup ganda)
  const { data: existing } = await supabase.from("families").select("id").limit(1).maybeSingle();
  if (existing) {
    return { success: false, error: "Setup sudah pernah dilakukan." };
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName, setup_complete: false })
    .select("id")
    .single();

  if (familyError || !family) {
    return { success: false, error: "Gagal membuat data keluarga." };
  }

  const familyId = family.id as string;
  const adminPinHash = await bcrypt.hash(adminPin, BCRYPT_ROUNDS);

  const { data: admins, error: adminError } = await supabase
    .from("profiles")
    .insert([
      { family_id: familyId, role: "admin", name: ayahName, pin: adminPinHash },
      { family_id: familyId, role: "admin", name: mamahName, pin: adminPinHash },
    ])
    .select("id");

  if (adminError || !admins || admins.length === 0) {
    return { success: false, error: "Gagal membuat profil admin." };
  }

  const adminId = admins[0].id as string;

  await supabase.from("pockets").insert([
    { family_id: familyId, name: "Belanja", type: "default" },
    { family_id: familyId, name: "Tabungan", type: "default" },
  ]);

  const { weekStart, weekEnd } = currentWeekRange();

  // Profile anak + avatar default (unlock) + weekly streak
  for (const child of children) {
    const childPinHash = await bcrypt.hash(child.pin, BCRYPT_ROUNDS);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        family_id: familyId,
        role: "child",
        name: child.name,
        age: child.age,
        pin: childPinHash,
        level: 1,
        xp: 0,
        xp_next_level: xpNeeded(1),
        point: 0,
        saldo: 0,
        world_theme: "sky",
      })
      .select("id")
      .single();

    if (profileError || !profile) continue;

    const profileId = profile.id as string;

    const { data: avatar, error: avatarError } = await supabase
      .from("avatars")
      .insert({
        family_id: familyId,
        name: `${child.name} Default`,
        costume: null,
        image_url: PLACEHOLDER_AVATAR,
        unlock_level: 1,
        is_default: true,
        generated_by: adminId,
      })
      .select("id")
      .single();

    if (!avatarError && avatar) {
      const avatarId = avatar.id as string;
      await supabase.from("profiles").update({ active_avatar_id: avatarId }).eq("id", profileId);
      await supabase.from("profile_avatars").insert({ profile_id: profileId, avatar_id: avatarId });
    }

    await supabase.from("weekly_streaks").insert({
      profile_id: profileId,
      week_start: weekStart,
      week_end: weekEnd,
      days_complete: 0,
      is_complete: false,
      bonus_claimed: false,
    });
  }

  const { error: completeError } = await supabase
    .from("families")
    .update({ setup_complete: true })
    .eq("id", familyId);

  if (completeError) {
    return { success: false, error: "Gagal menyelesaikan setup." };
  }

  return { success: true };
}
