"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, type ActionResult } from "@/lib/server/admin-helpers";
import type { NotificationType } from "@/lib/server/notifications";

export interface AdminNotificationItem {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

/** Ambil notifikasi terbaru milik admin yang sedang login (max 30, terbaru dulu). */
export async function getAdminNotifications(): Promise<AdminNotificationItem[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, message, data, read, created_at")
    .eq("profile_id", session.profileId)
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: n.data,
    read: n.read,
    createdAt: n.created_at,
  }));
}

export async function getUnreadAdminNotificationCount(): Promise<number> {
  const session = await requireAdmin();
  if (!session) return 0;

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", session.profileId)
    .eq("read", false);

  return count ?? 0;
}

/** Tandai semua notifikasi admin sebagai sudah dibaca. */
export async function markAdminNotificationsRead(): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  await supabase.from("notifications").update({ read: true }).eq("profile_id", session.profileId).eq("read", false);

  revalidatePath("/admin", "layout");
  return { success: true };
}
