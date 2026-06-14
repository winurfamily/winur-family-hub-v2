import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/app/actions/auth";

export type AdminClient = ReturnType<typeof createAdminClient>;

export interface ActionResult {
  success: boolean;
  error?: string;
}

/** Pastikan session aktif adalah admin. Mengembalikan null jika tidak. */
export async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

/** Catat audit log (Decision #38 — wajib untuk semua mutasi data anak/keuangan). */
export async function logAudit(
  supabase: AdminClient,
  familyId: string,
  actorId: string,
  entityType: string,
  entityId: string | null,
  action: string,
  beforeValue: Record<string, unknown> | null,
  afterValue: Record<string, unknown> | null
) {
  await supabase.from("audit_logs").insert({
    family_id: familyId,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_value: beforeValue,
    after_value: afterValue,
  });
}
