"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { logAudit, type ActionResult } from "@/lib/server/admin-helpers";

export interface CollectionAvatarItem {
  id: string;
  name: string;
  costume: string | null;
  imageUrl: string;
  unlockLevel: number;
  unlocked: boolean;
  active: boolean;
}

export interface CollectionPetItem {
  id: string;
  name: string;
  imageUrl: string;
  unlockLevel: number;
  unlocked: boolean;
  active: boolean;
}

export interface ChildCollections {
  level: number;
  avatars: CollectionAvatarItem[];
  pets: CollectionPetItem[];
}

/** Koleksi avatar & pet milik anak, dengan status unlock & yang sedang aktif. */
export async function getChildCollections(childId: string): Promise<ChildCollections | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, level, active_avatar_id, active_pet_id")
    .eq("id", childId)
    .maybeSingle();

  if (!profile) return null;

  const [avatarsRes, petsRes, ownedAvatarsRes, ownedPetsRes] = await Promise.all([
    supabase
      .from("avatars")
      .select("id, name, costume, image_url, unlock_level")
      .eq("family_id", profile.family_id)
      .order("unlock_level", { ascending: true }),
    supabase
      .from("pets")
      .select("id, name, image_url, unlock_level")
      .eq("family_id", profile.family_id)
      .order("unlock_level", { ascending: true }),
    supabase.from("profile_avatars").select("avatar_id").eq("profile_id", childId),
    supabase.from("profile_pets").select("pet_id").eq("profile_id", childId),
  ]);

  const ownedAvatarIds = new Set((ownedAvatarsRes.data ?? []).map((a) => a.avatar_id));
  const ownedPetIds = new Set((ownedPetsRes.data ?? []).map((p) => p.pet_id));

  const avatars: CollectionAvatarItem[] = (avatarsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    costume: a.costume,
    imageUrl: a.image_url,
    unlockLevel: a.unlock_level,
    unlocked: ownedAvatarIds.has(a.id) || a.unlock_level <= profile.level,
    active: a.id === profile.active_avatar_id,
  }));

  const pets: CollectionPetItem[] = (petsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.image_url,
    unlockLevel: p.unlock_level,
    unlocked: ownedPetIds.has(p.id) || p.unlock_level <= profile.level,
    active: p.id === profile.active_pet_id,
  }));

  return { level: profile.level, avatars, pets };
}

export async function selectAvatar(childId: string, avatarId: string): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, level, active_avatar_id")
    .eq("id", childId)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  const { data: avatar } = await supabase.from("avatars").select("id, family_id, unlock_level").eq("id", avatarId).maybeSingle();
  if (!avatar || avatar.family_id !== profile.family_id) return { success: false, error: "Avatar tidak ditemukan." };

  const { data: owned } = await supabase
    .from("profile_avatars")
    .select("id")
    .eq("profile_id", childId)
    .eq("avatar_id", avatarId)
    .maybeSingle();

  if (!owned && avatar.unlock_level > profile.level) {
    return { success: false, error: "Avatar ini masih terkunci." };
  }

  const { error } = await supabase.from("profiles").update({ active_avatar_id: avatarId }).eq("id", childId);
  if (error) {
    console.error("selectAvatar error", error);
    return { success: false, error: "Gagal memilih avatar." };
  }

  await logAudit(
    supabase,
    profile.family_id,
    childId,
    "profiles",
    childId,
    "select_avatar",
    { active_avatar_id: profile.active_avatar_id },
    { active_avatar_id: avatarId }
  );

  revalidatePath(`/child/${childId}`);
  revalidatePath(`/child/${childId}/avatar`);
  return { success: true };
}

export async function selectPet(childId: string, petId: string): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, level, active_pet_id")
    .eq("id", childId)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  const { data: pet } = await supabase.from("pets").select("id, family_id, unlock_level").eq("id", petId).maybeSingle();
  if (!pet || pet.family_id !== profile.family_id) return { success: false, error: "Pet tidak ditemukan." };

  const { data: owned } = await supabase
    .from("profile_pets")
    .select("id")
    .eq("profile_id", childId)
    .eq("pet_id", petId)
    .maybeSingle();

  if (!owned && pet.unlock_level > profile.level) {
    return { success: false, error: "Pet ini masih terkunci." };
  }

  const { error } = await supabase.from("profiles").update({ active_pet_id: petId }).eq("id", childId);
  if (error) {
    console.error("selectPet error", error);
    return { success: false, error: "Gagal memilih pet." };
  }

  await logAudit(
    supabase,
    profile.family_id,
    childId,
    "profiles",
    childId,
    "select_pet",
    { active_pet_id: profile.active_pet_id },
    { active_pet_id: petId }
  );

  revalidatePath(`/child/${childId}`);
  revalidatePath(`/child/${childId}/avatar`);
  return { success: true };
}
