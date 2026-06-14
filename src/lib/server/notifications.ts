import "server-only";
import type { AdminClient } from "@/lib/server/admin-helpers";

/**
 * Tipe notifikasi in-app (Decision #34/#38 — semua trigger penting harus
 * memunculkan notifikasi untuk anak).
 */
export type NotificationType =
  | "task_approved"
  | "tugas_approved"
  | "task_rejected"
  | "tugas_rejected"
  | "level_up"
  | "unlock_avatar"
  | "unlock_pet"
  | "investment_done"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "withdrawal_requested"
  | "point_request_approved"
  | "point_request_rejected"
  | "point_request_created"
  | "streak_complete";

/** Insert satu baris notifikasi untuk profile anak. */
export async function pushNotification(
  supabase: AdminClient,
  profileId: string,
  type: NotificationType,
  title: string,
  message?: string | null,
  data?: Record<string, unknown> | null
): Promise<void> {
  await supabase.from("notifications").insert({
    profile_id: profileId,
    type,
    title,
    message: message ?? null,
    data: data ?? null,
  });
}

/** Insert notifikasi untuk semua profil admin (Mamah/Ayah) dalam satu keluarga. */
export async function pushAdminNotification(
  supabase: AdminClient,
  familyId: string,
  type: NotificationType,
  title: string,
  message?: string | null,
  data?: Record<string, unknown> | null
): Promise<void> {
  const { data: admins } = await supabase.from("profiles").select("id").eq("family_id", familyId).eq("role", "admin");
  if (!admins || admins.length === 0) return;

  await supabase.from("notifications").insert(
    admins.map((a) => ({
      profile_id: a.id,
      type,
      title,
      message: message ?? null,
      data: data ?? null,
    }))
  );
}
