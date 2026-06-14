"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import type { FamilySettingsInput, ChildProfileInput, ChildPinInput } from "@/lib/validation/dunia-anak";
import type { ProfileRole } from "@/lib/supabase/types";

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Profil seluruh anggota keluarga (untuk pengelolaan avatar/foto profil)
// ---------------------------------------------------------------------------

export interface FamilyProfileItem {
  id: string;
  name: string;
  role: ProfileRole;
  level: number;
  photoUrl: string | null;
}

export async function getFamilyProfiles(): Promise<FamilyProfileItem[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, role, level, photo_url")
    .eq("family_id", session.familyId)
    .eq("status", "active")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    level: p.level,
    photoUrl: p.photo_url,
  }));
}

// ---------------------------------------------------------------------------
// Reward default, sound, tema (family-wide)
// ---------------------------------------------------------------------------

export async function getFamilySettings(): Promise<FamilySettingsInput | null> {
  const session = await requireAdmin();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("families")
    .select(
      "default_task_money, default_task_point, default_task_xp, default_tugas_money, default_tugas_point, default_tugas_xp, streak_bonus_money, streak_bonus_point, sound_enabled, theme"
    )
    .eq("id", session.familyId)
    .maybeSingle();

  if (!data) return null;

  return {
    defaultTaskMoney: Number(data.default_task_money),
    defaultTaskPoint: data.default_task_point,
    defaultTaskXp: data.default_task_xp,
    defaultTugasMoney: Number(data.default_tugas_money),
    defaultTugasPoint: data.default_tugas_point,
    defaultTugasXp: data.default_tugas_xp,
    streakBonusMoney: Number(data.streak_bonus_money),
    streakBonusPoint: data.streak_bonus_point,
    soundEnabled: data.sound_enabled,
    theme: data.theme,
  };
}

export async function updateFamilySettings(input: FamilySettingsInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("families")
    .update({
      default_task_money: input.defaultTaskMoney,
      default_task_point: input.defaultTaskPoint,
      default_task_xp: input.defaultTaskXp,
      default_tugas_money: input.defaultTugasMoney,
      default_tugas_point: input.defaultTugasPoint,
      default_tugas_xp: input.defaultTugasXp,
      streak_bonus_money: input.streakBonusMoney,
      streak_bonus_point: input.streakBonusPoint,
      sound_enabled: input.soundEnabled,
      theme: input.theme,
    })
    .eq("id", session.familyId);

  if (error) {
    console.error("updateFamilySettings error", error);
    return { success: false, error: "Gagal menyimpan pengaturan." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "families", session.familyId, "update_settings", null, {
    ...input,
  });

  revalidatePath("/admin/dunia-anak/settings");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Profil anak (nama, usia, tema dunia) & PIN
// ---------------------------------------------------------------------------

export interface ChildSettingsItem {
  id: string;
  name: string;
  age: number | null;
  worldTheme: string;
  hasPin: boolean;
  photoUrl: string | null;
  backgroundUrl: string | null;
}

export async function getChildProfiles(): Promise<ChildSettingsItem[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, age, world_theme, pin, photo_url, background_url")
    .eq("family_id", session.familyId)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age,
    worldTheme: p.world_theme,
    hasPin: Boolean(p.pin),
    photoUrl: p.photo_url,
    backgroundUrl: p.background_url,
  }));
}

export async function updateChildProfile(childId: string, input: ChildProfileInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, name, age, world_theme")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const { error } = await supabase
    .from("profiles")
    .update({ name: input.name, age: input.age, world_theme: input.worldTheme })
    .eq("id", childId);

  if (error) {
    console.error("updateChildProfile error", error);
    return { success: false, error: "Gagal menyimpan profil anak." };
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "profiles",
    childId,
    "update_profile",
    { name: profile.name, age: profile.age, world_theme: profile.world_theme },
    { name: input.name, age: input.age, world_theme: input.worldTheme }
  );

  revalidatePath("/admin/dunia-anak/settings");
  revalidatePath(`/admin/dunia-anak/${childId}`);
  return { success: true };
}

export async function setChildPin(childId: string, input: ChildPinInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const pinHash = await bcrypt.hash(input.pin, BCRYPT_ROUNDS);
  const { error } = await supabase.from("profiles").update({ pin: pinHash }).eq("id", childId);

  if (error) {
    console.error("setChildPin error", error);
    return { success: false, error: "Gagal menyimpan PIN." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "profiles", childId, "set_pin", null, { pin: "****" });

  revalidatePath("/admin/dunia-anak/settings");
  return { success: true };
}
