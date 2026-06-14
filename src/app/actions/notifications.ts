"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import type { ActionResult } from "@/lib/server/admin-helpers";
import type { NotificationType } from "@/lib/server/notifications";

export interface NotificationItem {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

/** Ambil notifikasi terbaru milik anak (max 30, terbaru dulu). */
export async function getNotifications(childId: string): Promise<NotificationItem[]> {
  const session = await requireChild(childId);
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, message, data, read, created_at")
    .eq("profile_id", childId)
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

/** Tipe notifikasi yang memicu modal perayaan (confetti + suara) di Beranda. */
const CELEBRATION_TYPES: NotificationType[] = [
  "task_approved",
  "tugas_approved",
  "level_up",
  "unlock_avatar",
  "unlock_pet",
  "investment_done",
  "withdrawal_approved",
  "point_request_approved",
  "streak_complete",
];

/** Ambil notifikasi belum dibaca yang layak dirayakan (max 5, terlama dulu). */
export async function getCelebratableNotifications(childId: string): Promise<NotificationItem[]> {
  const session = await requireChild(childId);
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, message, data, read, created_at")
    .eq("profile_id", childId)
    .eq("read", false)
    .in("type", CELEBRATION_TYPES)
    .order("created_at", { ascending: true })
    .limit(5);

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

export async function getUnreadNotificationCount(childId: string): Promise<number> {
  const session = await requireChild(childId);
  if (!session) return 0;

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", childId)
    .eq("read", false);

  return count ?? 0;
}

/** Tandai semua (atau id tertentu) sebagai sudah dibaca. */
export async function markNotificationsRead(childId: string, ids?: string[]): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  let query = supabase.from("notifications").update({ read: true }).eq("profile_id", childId).eq("read", false);
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }
  await query;

  revalidatePath(`/child/${childId}`);
  return { success: true };
}
