"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { BUILTIN_THEMES, deriveKind, getDefaultThemeKey, getThemesForKind } from "@/components/child/world/theme-config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOM_THEME_BUCKET = "room-themes";

export interface RoomThemeOption {
  key: string;
  name: string;
  dayImage: string;
  isCustom: boolean;
}

export interface AvailableThemes {
  activeThemeKey: string;
  themes: RoomThemeOption[];
}

/** Tema bawaan (sesuai jenis dunia anak) + tema custom milik anak (upload admin, future). */
export async function getAvailableThemes(childId: string): Promise<AvailableThemes | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, age, active_theme_key")
    .eq("id", childId)
    .maybeSingle();
  if (!profile) return null;

  const kind = deriveKind(profile.name, profile.age);
  const builtin: RoomThemeOption[] = getThemesForKind(kind).map((t) => ({
    key: t.key,
    name: t.name,
    dayImage: t.dayImage,
    isCustom: false,
  }));

  const { data: custom } = await supabase
    .from("room_themes")
    .select("id, name, day_image_url")
    .eq("owner_profile_id", childId);

  const customThemes: RoomThemeOption[] = (custom ?? []).map((c) => ({
    key: c.id,
    name: c.name,
    dayImage: c.day_image_url,
    isCustom: true,
  }));

  return {
    activeThemeKey: profile.active_theme_key ?? getDefaultThemeKey(),
    themes: [...builtin, ...customThemes],
  };
}

/** Ganti tema kamar aktif anak. */
export async function setActiveTheme(childId: string, themeKey: string): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, active_theme_key")
    .eq("id", childId)
    .maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  const { error } = await supabase.from("profiles").update({ active_theme_key: themeKey }).eq("id", childId);
  if (error) {
    console.error("setActiveTheme error", error);
    return { success: false, error: "Gagal mengganti tema." };
  }

  await logAudit(
    supabase,
    profile.family_id,
    childId,
    "profiles",
    childId,
    "select_theme",
    { active_theme_key: profile.active_theme_key },
    { active_theme_key: themeKey }
  );

  revalidatePath(`/child/${childId}`);
  return { success: true };
}

// ===========================================================================
// ADMIN — kelola background/tema kamar custom (upload gambar siang/malam).
// Tema custom memakai layout hotspot BERSAMA (makeRoomTheme) supaya area klik
// tetap presisi seperti Docs/ROOM_DAFFA_FINAL.html. Tabel `room_themes` & bucket
// `room-themes` sudah disiapkan di migration 0011.
// ===========================================================================

const ROOM_BG_WIDTH = 1280;
const ROOM_BG_HEIGHT = 960; // rasio 4:3, sama dengan panggung kamar
const MAX_ROOM_BG_SIZE = 5 * 1024 * 1024; // 5MB
const ROOM_BG_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface UploadRoomBgResult {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

export interface CustomRoomThemeItem {
  id: string;
  name: string;
  dayImageUrl: string;
  nightImageUrl: string;
}

export interface ChildRoomThemes {
  childId: string;
  childName: string;
  kind: "daffa" | "dio";
  activeThemeKey: string;
  defaultThemeKey: string;
  builtinThemes: { key: string; name: string; dayImage: string }[];
  customThemes: CustomRoomThemeItem[];
}

export interface CreateRoomThemeInput {
  childId: string;
  name: string;
  dayImageUrl: string;
  nightImageUrl?: string | null;
  setActive?: boolean;
}

// Hapus file di bucket room-themes berdasarkan public URL-nya (best-effort).
async function deleteRoomThemeObject(supabase: ReturnType<typeof createAdminClient>, fileUrl: string) {
  const marker = `/object/public/${ROOM_THEME_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;
  const path = fileUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(ROOM_THEME_BUCKET).remove([path]);
  if (error) console.error("deleteRoomThemeObject error", error);
}

/** Daftar tema (bawaan + custom) per anak, untuk panel admin. */
export async function getRoomThemesByChild(): Promise<ChildRoomThemes[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data: children } = await supabase
    .from("profiles")
    .select("id, name, age, active_theme_key")
    .eq("family_id", session.familyId)
    .eq("role", "child")
    .order("name", { ascending: true });
  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);
  const { data: themes } = await supabase
    .from("room_themes")
    .select("id, owner_profile_id, name, day_image_url, night_image_url")
    .in("owner_profile_id", childIds)
    .order("created_at", { ascending: true });

  return children.map((c) => {
    const kind = deriveKind(c.name, c.age);
    const defaultThemeKey = getDefaultThemeKey();
    return {
      childId: c.id,
      childName: c.name,
      kind,
      activeThemeKey: c.active_theme_key ?? defaultThemeKey,
      defaultThemeKey,
      builtinThemes: getThemesForKind(kind).map((t) => ({ key: t.key, name: t.name, dayImage: t.dayImage })),
      customThemes: (themes ?? [])
        .filter((t) => t.owner_profile_id === c.id)
        .map((t) => ({ id: t.id, name: t.name, dayImageUrl: t.day_image_url, nightImageUrl: t.night_image_url })),
    };
  });
}

/** Upload satu gambar background (siang atau malam), di-resize ke 1280x960 webp. */
export async function uploadRoomThemeImage(formData: FormData): Promise<UploadRoomBgResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Pilih file gambar terlebih dahulu." };
  if (!ROOM_BG_TYPES.includes(file.type)) return { success: false, error: "Format harus PNG, JPG, atau WEBP." };
  if (file.size > MAX_ROOM_BG_SIZE) return { success: false, error: "Ukuran gambar maksimal 5MB." };

  try {
    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer).resize(ROOM_BG_WIDTH, ROOM_BG_HEIGHT, { fit: "cover" }).webp({ quality: 82 }).toBuffer();

    const path = `custom/${session.familyId}/${crypto.randomUUID()}.webp`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(ROOM_THEME_BUCKET).upload(path, resized, {
      contentType: "image/webp",
      upsert: false,
    });
    if (error) {
      console.error("uploadRoomThemeImage error", error);
      return { success: false, error: "Gagal mengunggah gambar." };
    }
    const { data } = supabase.storage.from(ROOM_THEME_BUCKET).getPublicUrl(path);
    return { success: true, imageUrl: data.publicUrl };
  } catch (err) {
    console.error("uploadRoomThemeImage error", err);
    return { success: false, error: "Gagal memproses gambar." };
  }
}

/** Simpan tema kamar custom baru untuk seorang anak. */
export async function createRoomTheme(input: CreateRoomThemeInput): Promise<{ success: boolean; error?: string; themeId?: string }> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (name.length < 2) return { success: false, error: "Nama tema minimal 2 karakter." };
  if (!input.dayImageUrl) return { success: false, error: "Upload gambar siang dulu." };

  const supabase = createAdminClient();
  const { data: child } = await supabase.from("profiles").select("id, family_id").eq("id", input.childId).eq("role", "child").maybeSingle();
  if (!child || child.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const nightImageUrl = input.nightImageUrl || input.dayImageUrl;
  const { data: inserted, error } = await supabase
    .from("room_themes")
    .insert({
      owner_profile_id: input.childId,
      name,
      day_image_url: input.dayImageUrl,
      night_image_url: nightImageUrl,
      config: { layout: "shared-v1" },
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createRoomTheme error", error);
    return { success: false, error: "Gagal menyimpan tema." };
  }

  if (input.setActive) {
    await supabase.from("profiles").update({ active_theme_key: inserted.id }).eq("id", input.childId);
  }

  await logAudit(supabase, session.familyId, session.profileId, "room_themes", inserted.id, "create", null, { name, owner: input.childId });

  revalidatePath("/admin/dunia-anak/assets");
  revalidatePath(`/child/${input.childId}`);
  return { success: true, themeId: inserted.id };
}

/** Hapus tema custom; jika sedang aktif, kembalikan anak ke tema default. */
export async function deleteRoomTheme(themeId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: theme } = await supabase
    .from("room_themes")
    .select("id, owner_profile_id, name, day_image_url, night_image_url")
    .eq("id", themeId)
    .maybeSingle();
  if (!theme) return { success: false, error: "Tema tidak ditemukan." };

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, family_id, active_theme_key")
    .eq("id", theme.owner_profile_id)
    .maybeSingle();
  if (!owner || owner.family_id !== session.familyId) return { success: false, error: "Tema tidak ditemukan." };

  const { error } = await supabase.from("room_themes").delete().eq("id", themeId);
  if (error) {
    console.error("deleteRoomTheme error", error);
    return { success: false, error: "Gagal menghapus tema." };
  }

  if (owner.active_theme_key === themeId) {
    await supabase.from("profiles").update({ active_theme_key: null }).eq("id", owner.id);
  }

  const urls = Array.from(new Set([theme.day_image_url, theme.night_image_url].filter(Boolean) as string[]));
  await Promise.all(urls.map((u) => deleteRoomThemeObject(supabase, u)));

  await logAudit(supabase, session.familyId, session.profileId, "room_themes", themeId, "delete", { name: theme.name }, null);

  revalidatePath("/admin/dunia-anak/assets");
  revalidatePath(`/child/${owner.id}`);
  return { success: true };
}

/** Admin set tema aktif seorang anak (key bawaan atau id tema custom). */
export async function adminSetActiveTheme(childId: string, themeKey: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: child } = await supabase
    .from("profiles")
    .select("id, family_id, active_theme_key")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();
  if (!child || child.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  if (!(themeKey in BUILTIN_THEMES)) {
    if (!UUID_RE.test(themeKey)) return { success: false, error: "Tema tidak ditemukan." };
    const { data: t } = await supabase.from("room_themes").select("id").eq("id", themeKey).eq("owner_profile_id", childId).maybeSingle();
    if (!t) return { success: false, error: "Tema tidak ditemukan." };
  }

  const { error } = await supabase.from("profiles").update({ active_theme_key: themeKey }).eq("id", childId);
  if (error) {
    console.error("adminSetActiveTheme error", error);
    return { success: false, error: "Gagal mengganti tema." };
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "profiles",
    childId,
    "admin_select_theme",
    { active_theme_key: child.active_theme_key },
    { active_theme_key: themeKey }
  );

  revalidatePath("/admin/dunia-anak/assets");
  revalidatePath(`/child/${childId}`);
  return { success: true };
}
