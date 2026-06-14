import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Foto profil > avatar aktif > null (AvatarDisplay fallback ke CSS circle + inisial).
 */
export async function resolveAvatarUrl(
  supabase: SupabaseClient<Database>,
  photoUrl: string | null,
  activeAvatarId: string | null
): Promise<string | null> {
  if (photoUrl) return photoUrl;
  if (!activeAvatarId) return null;

  const { data } = await supabase.from("avatars").select("image_url").eq("id", activeAvatarId).maybeSingle();
  return data?.image_url ?? null;
}
