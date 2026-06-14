"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/server/admin-helpers";
import type { SoundSettings } from "@/lib/supabase/types";

export async function getSoundSettings(): Promise<SoundSettings | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("sound_settings")
    .eq("id", session.profileId)
    .maybeSingle();

  return data?.sound_settings ?? null;
}

export async function updateSoundSettings(settings: SoundSettings): Promise<ActionResult> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ sound_settings: settings })
    .eq("id", session.profileId);

  if (error) {
    console.error("updateSoundSettings error", error);
    return { success: false, error: "Gagal menyimpan pengaturan suara." };
  }

  return { success: true };
}
