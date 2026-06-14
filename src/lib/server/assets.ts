import "server-only";
import type { AdminClient } from "@/lib/server/admin-helpers";

/**
 * Unlock satu avatar/pet untuk semua anak di keluarga yang levelnya sudah
 * mencapai unlockLevel tapi belum punya baris di profile_avatars/profile_pets
 * (Decision #27 — assign by admin, otomatis terbuka berdasarkan level).
 */
export async function backfillAssetUnlock(
  supabase: AdminClient,
  familyId: string,
  assetType: "avatar" | "pet",
  assetId: string,
  unlockLevel: number
): Promise<void> {
  const { data: children } = await supabase
    .from("profiles")
    .select("id, level")
    .eq("family_id", familyId)
    .eq("role", "child")
    .gte("level", unlockLevel);

  if (!children || children.length === 0) return;
  const childIds = children.map((c) => c.id);

  if (assetType === "avatar") {
    const { data: existing } = await supabase.from("profile_avatars").select("profile_id").eq("avatar_id", assetId).in("profile_id", childIds);
    const existingIds = new Set((existing ?? []).map((e) => e.profile_id));
    const toInsert = childIds.filter((id) => !existingIds.has(id)).map((id) => ({ profile_id: id, avatar_id: assetId }));
    if (toInsert.length > 0) await supabase.from("profile_avatars").insert(toInsert);
  } else {
    const { data: existing } = await supabase.from("profile_pets").select("profile_id").eq("pet_id", assetId).in("profile_id", childIds);
    const existingIds = new Set((existing ?? []).map((e) => e.profile_id));
    const toInsert = childIds.filter((id) => !existingIds.has(id)).map((id) => ({ profile_id: id, pet_id: assetId }));
    if (toInsert.length > 0) await supabase.from("profile_pets").insert(toInsert);
  }
}

export interface UnlockedAsset {
  id: string;
  name: string;
}

export interface UnlockResult {
  avatars: UnlockedAsset[];
  pets: UnlockedAsset[];
}

/**
 * Unlock semua avatar/pet yang unlock_level <= level untuk satu anak
 * (dipanggil saat anak naik level). Mengembalikan daftar avatar/pet yang
 * baru saja terbuka agar caller bisa mengirim notifikasi (Decision #34).
 */
export async function unlockAssetsForProfile(supabase: AdminClient, familyId: string, profileId: string, level: number): Promise<UnlockResult> {
  const [{ data: avatars }, { data: pets }, { data: ownedAvatars }, { data: ownedPets }] = await Promise.all([
    supabase.from("avatars").select("id, name").eq("family_id", familyId).lte("unlock_level", level),
    supabase.from("pets").select("id, name").eq("family_id", familyId).lte("unlock_level", level),
    supabase.from("profile_avatars").select("avatar_id").eq("profile_id", profileId),
    supabase.from("profile_pets").select("pet_id").eq("profile_id", profileId),
  ]);

  const ownedAvatarIds = new Set((ownedAvatars ?? []).map((a) => a.avatar_id));
  const ownedPetIds = new Set((ownedPets ?? []).map((p) => p.pet_id));

  const newAvatars = (avatars ?? []).filter((a) => !ownedAvatarIds.has(a.id));
  const newPets = (pets ?? []).filter((p) => !ownedPetIds.has(p.id));

  if (newAvatars.length > 0) {
    await supabase.from("profile_avatars").insert(newAvatars.map((a) => ({ profile_id: profileId, avatar_id: a.id })));
  }
  if (newPets.length > 0) {
    await supabase.from("profile_pets").insert(newPets.map((p) => ({ profile_id: profileId, pet_id: p.id })));
  }

  return {
    avatars: newAvatars.map((a) => ({ id: a.id, name: a.name })),
    pets: newPets.map((p) => ({ id: p.id, name: p.name })),
  };
}
