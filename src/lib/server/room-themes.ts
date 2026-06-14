import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeRoomTheme, type RoomTheme } from "@/components/child/world/theme-config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ambil tema kamar custom milik anak (untuk render di /child/[id]).
 * `themeKey` adalah id (uuid) tema custom; null jika bukan uuid / tema tidak ada /
 * bukan milik anak ini. Tema custom memakai layout hotspot BERSAMA (makeRoomTheme),
 * jadi area klik tetap presisi mengikuti Docs/ROOM_DAFFA_FINAL.html.
 */
export async function getCustomRoomTheme(childId: string, themeKey: string): Promise<RoomTheme | null> {
  if (!UUID_RE.test(themeKey)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("room_themes")
    .select("id, name, day_image_url, night_image_url")
    .eq("id", themeKey)
    .eq("owner_profile_id", childId)
    .maybeSingle();

  if (!data) return null;
  return makeRoomTheme(data.id, data.name, data.day_image_url, data.night_image_url);
}
