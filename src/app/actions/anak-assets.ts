"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { backfillAssetUnlock, relockAssetForProfiles } from "@/lib/server/assets";
import { generateAndStoreBackground, hasOpenAIKey } from "@/lib/ai";
import type { AvatarInput, PetInput } from "@/lib/validation/dunia-anak";

const STORAGE_BUCKET = "ai-assets";

// Hapus file di storage berdasarkan public URL-nya (best-effort, tidak melempar error).
async function deleteStorageObject(supabase: ReturnType<typeof createAdminClient>, fileUrl: string | null) {
  if (!fileUrl) return;
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;

  const path = fileUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.error("deleteStorageObject error", error);
}

export interface AvatarItem {
  id: string;
  name: string;
  costume: string | null;
  imageUrl: string;
  unlockLevel: number;
  isDefault: boolean;
}

export interface PetItem {
  id: string;
  name: string;
  style: string | null;
  imageUrl: string;
  soundUrl: string | null;
  unlockLevel: number;
}

export interface AssetsLibrary {
  avatars: AvatarItem[];
  pets: PetItem[];
}

export async function getAssetsLibrary(): Promise<AssetsLibrary> {
  const session = await requireAdmin();
  if (!session) return { avatars: [], pets: [] };

  const supabase = createAdminClient();
  const [avatarsRes, petsRes] = await Promise.all([
    supabase
      .from("avatars")
      .select("id, name, costume, image_url, unlock_level, is_default")
      .eq("family_id", session.familyId)
      .order("unlock_level", { ascending: true }),
    supabase
      .from("pets")
      .select("id, name, style, image_url, sound_url, unlock_level")
      .eq("family_id", session.familyId)
      .order("unlock_level", { ascending: true }),
  ]);

  const avatars: AvatarItem[] = (avatarsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    costume: a.costume,
    imageUrl: a.image_url,
    unlockLevel: a.unlock_level,
    isDefault: a.is_default,
  }));

  const pets: PetItem[] = (petsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    style: p.style,
    imageUrl: p.image_url,
    soundUrl: p.sound_url,
    unlockLevel: p.unlock_level,
  }));

  return { avatars, pets };
}

// ---------------------------------------------------------------------------
// Upload gambar avatar/pet (PNG, max 2MB, di-resize ke 512x512)
// ---------------------------------------------------------------------------

export interface GenerateAssetImageResult {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

const ASSET_IMAGE_SIZE = 512;
const MAX_ASSET_FILE_SIZE = 2 * 1024 * 1024; // 2MB

async function uploadAssetImage(formData: FormData, folder: string): Promise<GenerateAssetImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Pilih file gambar terlebih dahulu." };
  }
  if (file.type !== "image/png") {
    return { success: false, error: "Format gambar harus PNG." };
  }
  if (file.size > MAX_ASSET_FILE_SIZE) {
    return { success: false, error: "Ukuran gambar maksimal 2MB." };
  }

  try {
    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(ASSET_IMAGE_SIZE, ASSET_IMAGE_SIZE, { fit: "cover" })
      .png({ quality: 80 })
      .toBuffer();

    const path = `${folder}/${crypto.randomUUID()}.png`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, resized, {
      contentType: "image/png",
      upsert: false,
    });

    if (error) {
      console.error("uploadAssetImage error", error);
      return { success: false, error: "Gagal mengunggah gambar." };
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { success: true, imageUrl: data.publicUrl };
  } catch (err) {
    console.error("uploadAssetImage error", err);
    return { success: false, error: "Gagal memproses gambar." };
  }
}

export async function uploadAvatarImage(formData: FormData): Promise<GenerateAssetImageResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  return uploadAssetImage(formData, "avatars");
}

export async function uploadPetImage(formData: FormData): Promise<GenerateAssetImageResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  return uploadAssetImage(formData, "pets");
}

// ---------------------------------------------------------------------------
// Simpan avatar / pet ke library + assign level unlock
// ---------------------------------------------------------------------------

export async function createAvatar(input: AvatarInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("avatars")
    .insert({
      family_id: session.familyId,
      name: input.name,
      costume: input.costume ?? null,
      image_url: input.imageUrl,
      unlock_level: input.unlockLevel,
      is_default: false,
      generated_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createAvatar error", error);
    return { success: false, error: "Gagal menyimpan avatar." };
  }

  await backfillAssetUnlock(supabase, session.familyId, "avatar", inserted.id, input.unlockLevel);

  await logAudit(supabase, session.familyId, session.profileId, "avatars", inserted.id, "create", null, {
    name: input.name,
    unlock_level: input.unlockLevel,
  });

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

export async function updateAvatarUnlockLevel(avatarId: string, unlockLevel: number): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: avatar } = await supabase.from("avatars").select("id, family_id, unlock_level, is_default").eq("id", avatarId).maybeSingle();
  if (!avatar || avatar.family_id !== session.familyId) return { success: false, error: "Avatar tidak ditemukan." };

  await supabase.from("avatars").update({ unlock_level: unlockLevel }).eq("id", avatarId);
  await backfillAssetUnlock(supabase, session.familyId, "avatar", avatarId, unlockLevel);
  if (!avatar.is_default) await relockAssetForProfiles(supabase, session.familyId, "avatar", avatarId, unlockLevel);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "avatars",
    avatarId,
    "update_unlock_level",
    { unlock_level: avatar.unlock_level },
    { unlock_level: unlockLevel }
  );

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

export async function deleteAvatar(avatarId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: avatar } = await supabase.from("avatars").select("id, family_id, name, image_url, is_default").eq("id", avatarId).maybeSingle();
  if (!avatar || avatar.family_id !== session.familyId) return { success: false, error: "Avatar tidak ditemukan." };
  if (avatar.is_default) return { success: false, error: "Avatar default tidak bisa dihapus." };

  // Lepas dulu relasi yang menunjuk ke avatar ini supaya tidak terblokir foreign key
  await supabase.from("profile_avatars").delete().eq("avatar_id", avatarId);
  await supabase.from("profiles").update({ active_avatar_id: null }).eq("active_avatar_id", avatarId);

  const { error } = await supabase.from("avatars").delete().eq("id", avatarId);
  if (error) {
    console.error("deleteAvatar error", error);
    return { success: false, error: "Gagal menghapus avatar." };
  }

  await deleteStorageObject(supabase, avatar.image_url);

  await logAudit(supabase, session.familyId, session.profileId, "avatars", avatarId, "delete", { name: avatar.name }, null);

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

export async function createPet(input: PetInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("pets")
    .insert({
      family_id: session.familyId,
      name: input.name,
      style: input.style ?? null,
      image_url: input.imageUrl,
      sound_url: null,
      unlock_level: input.unlockLevel,
      generated_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createPet error", error);
    return { success: false, error: "Gagal menyimpan pet." };
  }

  await backfillAssetUnlock(supabase, session.familyId, "pet", inserted.id, input.unlockLevel);

  await logAudit(supabase, session.familyId, session.profileId, "pets", inserted.id, "create", null, {
    name: input.name,
    unlock_level: input.unlockLevel,
  });

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

export async function updatePetUnlockLevel(petId: string, unlockLevel: number): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: pet } = await supabase.from("pets").select("id, family_id, unlock_level").eq("id", petId).maybeSingle();
  if (!pet || pet.family_id !== session.familyId) return { success: false, error: "Pet tidak ditemukan." };

  await supabase.from("pets").update({ unlock_level: unlockLevel }).eq("id", petId);
  await backfillAssetUnlock(supabase, session.familyId, "pet", petId, unlockLevel);
  await relockAssetForProfiles(supabase, session.familyId, "pet", petId, unlockLevel);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "pets",
    petId,
    "update_unlock_level",
    { unlock_level: pet.unlock_level },
    { unlock_level: unlockLevel }
  );

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

export async function deletePet(petId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: pet } = await supabase.from("pets").select("id, family_id, name, image_url, sound_url").eq("id", petId).maybeSingle();
  if (!pet || pet.family_id !== session.familyId) return { success: false, error: "Pet tidak ditemukan." };

  // Lepas dulu relasi yang menunjuk ke pet ini supaya tidak terblokir foreign key
  await supabase.from("profile_pets").delete().eq("pet_id", petId);
  await supabase.from("profiles").update({ active_pet_id: null }).eq("active_pet_id", petId);

  const { error } = await supabase.from("pets").delete().eq("id", petId);
  if (error) {
    console.error("deletePet error", error);
    return { success: false, error: "Gagal menghapus pet." };
  }

  await deleteStorageObject(supabase, pet.image_url);
  await deleteStorageObject(supabase, pet.sound_url);

  await logAudit(supabase, session.familyId, session.profileId, "pets", petId, "delete", { name: pet.name }, null);

  revalidatePath("/admin/dunia-anak/assets");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Upload foto profil anak
// ---------------------------------------------------------------------------

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadProfilePhoto(profileId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Pilih file foto terlebih dahulu." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: "Format foto harus PNG, JPG, atau WEBP." };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { success: false, error: "Ukuran foto maksimal 2MB." };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("id, family_id").eq("id", profileId).maybeSingle();
  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil tidak ditemukan." };

  const ext = file.type.split("/")[1];
  const path = `profiles/${profileId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("uploadProfilePhoto error", uploadError);
    return { success: false, error: "Gagal mengunggah foto." };
  }

  const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  await supabase.from("profiles").update({ photo_url: publicUrl.publicUrl }).eq("id", profileId);

  await logAudit(supabase, session.familyId, session.profileId, "profiles", profileId, "upload_photo", null, { photo_url: publicUrl.publicUrl });

  revalidatePath("/admin/dunia-anak/settings");
  revalidatePath(`/admin/dunia-anak/${profileId}`);
  revalidatePath("/");
  return { success: true };
}

export async function uploadChildPhoto(childId: string, formData: FormData): Promise<ActionResult> {
  return uploadProfilePhoto(childId, formData);
}

// ---------------------------------------------------------------------------
// Background dunia anak (AI generate, 1280x720)
// ---------------------------------------------------------------------------

export async function generateChildBackground(childId: string, description: string): Promise<GenerateAssetImageResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!hasOpenAIKey()) {
    return { success: false, error: "OPENAI_API_KEY belum diisi di .env.local." };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, background_url")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const prompt = `A wide scenic background illustration: ${description}. Sky adventure theme, bright and cheerful colors, cartoon style, no characters, no text or letters in the image.`;

  const imageUrl = await generateAndStoreBackground(prompt, "backgrounds");
  if (!imageUrl) return { success: false, error: "Gagal generate background." };

  const { error } = await supabase.from("profiles").update({ background_url: imageUrl }).eq("id", childId);
  if (error) {
    console.error("generateChildBackground update error", error);
    return { success: false, error: "Gagal menyimpan background." };
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "profiles",
    childId,
    "generate_background",
    { background_url: profile.background_url },
    { background_url: imageUrl }
  );

  revalidatePath("/admin/dunia-anak/settings");
  revalidatePath(`/child/${childId}`);
  return { success: true, imageUrl };
}

export async function removeChildBackground(childId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, background_url")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };
  if (!profile.background_url) return { success: true };

  await supabase.from("profiles").update({ background_url: null }).eq("id", childId);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "profiles",
    childId,
    "remove_background",
    { background_url: profile.background_url },
    { background_url: null }
  );

  revalidatePath("/admin/dunia-anak/settings");
  revalidatePath(`/child/${childId}`);
  return { success: true };
}
