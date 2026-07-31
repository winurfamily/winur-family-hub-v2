"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  toRupiah,
  isUuid,
  FORBIDDEN,
  type AdminClient,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { createShoppingTransaction } from "@/app/actions/belanja";
import type { ShoppingPlanStatus, ShoppingPlanItemStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Bentuk data
// ---------------------------------------------------------------------------

export interface PlanItemView {
  id: string;
  name: string;
  qty: number;
  estimatedPrice: number;
  actualPrice: number | null;
  status: ShoppingPlanItemStatus;
  note: string | null;
  transactionId: string | null;
  estimatedSubtotal: number;
  actualSubtotal: number;
}

export interface PlanView {
  id: string;
  name: string;
  plannedDate: string | null;
  status: ShoppingPlanStatus;
  note: string | null;
  totalEstimated: number;
  totalActual: number;
  /** totalActual − totalEstimated. Positif = lebih mahal dari perkiraan. */
  variance: number;
  itemCount: number;
  boughtCount: number;
  cancelledCount: number;
  progressPercent: number;
  items: PlanItemView[];
  createdAt: string;
}

const PLAN_STATUSES: ShoppingPlanStatus[] = ["draft", "active", "done", "cancelled", "archived"];

function normalizeStatus(value: unknown): ShoppingPlanStatus {
  return PLAN_STATUSES.includes(value as ShoppingPlanStatus) ? (value as ShoppingPlanStatus) : "active";
}

/**
 * Verifikasi bahwa plan (atau item) benar-benar milik keluarga pemanggil.
 *
 * Versi lama memutasi shopping_plan_items hanya berbekal item id, tanpa
 * memeriksa family_id sama sekali — sehingga id tebakan dari keluarga lain
 * bisa diedit/dihapus. Semua mutasi rencana sekarang melewati fungsi ini.
 */
async function assertPlanOwnership(
  supabase: AdminClient,
  familyId: string,
  planId: string
): Promise<boolean> {
  if (!isUuid(planId)) return false;
  const { data } = await supabase
    .from("shopping_plans")
    .select("id")
    .eq("id", planId)
    .eq("family_id", familyId)
    .maybeSingle();
  return Boolean(data);
}

async function resolveOwnedItem(
  supabase: AdminClient,
  familyId: string,
  itemId: string
): Promise<{ id: string; plan_id: string; name: string; qty: number; estimated_price: number } | null> {
  if (!isUuid(itemId)) return null;

  const { data: item } = await supabase
    .from("shopping_plan_items")
    .select("id, plan_id, name, qty, estimated_price")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return null;
  if (!(await assertPlanOwnership(supabase, familyId, item.plan_id))) return null;

  return item;
}

async function recalcPlanTotals(supabase: AdminClient, planId: string) {
  const { data: items } = await supabase
    .from("shopping_plan_items")
    .select("qty, estimated_price, actual_price, status")
    .eq("plan_id", planId);

  const rows = items ?? [];
  const active = rows.filter((i) => i.status !== "cancelled");

  const totalEstimated = active.reduce((acc, i) => acc + Number(i.estimated_price) * Number(i.qty), 0);
  const totalActual = active.reduce(
    (acc, i) => acc + (i.actual_price !== null ? Number(i.actual_price) * Number(i.qty) : 0),
    0
  );

  await supabase
    .from("shopping_plans")
    .update({
      total_estimated: Math.round(totalEstimated),
      total_actual: Math.round(totalActual),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------

export async function getShoppingPlans(includeArchived = false): Promise<PlanView[]> {
  const session = await requireFinanceSession();
  if (!session) return [];

  const supabase = createAdminClient();
  let query = supabase
    .from("shopping_plans")
    .select("id, name, planned_date, status, note, total_estimated, total_actual, created_at")
    .eq("family_id", session.familyId);

  if (!includeArchived) query = query.neq("status", "archived");

  const { data: plans } = await query.order("created_at", { ascending: false });
  if (!plans || plans.length === 0) return [];

  const { data: items } = await supabase
    .from("shopping_plan_items")
    .select("id, plan_id, name, qty, estimated_price, actual_price, status, note, transaction_id, position")
    .in(
      "plan_id",
      plans.map((p) => p.id)
    )
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  return plans.map((p) => {
    const planItems: PlanItemView[] = (items ?? [])
      .filter((i) => i.plan_id === p.id)
      .map((i) => {
        const qty = Number(i.qty);
        const estimated = Number(i.estimated_price);
        const actual = i.actual_price !== null ? Number(i.actual_price) : null;
        return {
          id: i.id,
          name: i.name,
          qty,
          estimatedPrice: estimated,
          actualPrice: actual,
          status: i.status,
          note: i.note,
          transactionId: i.transaction_id,
          estimatedSubtotal: Math.round(estimated * qty),
          actualSubtotal: actual !== null ? Math.round(actual * qty) : 0,
        };
      });

    const counted = planItems.filter((i) => i.status !== "cancelled");
    const bought = planItems.filter((i) => i.status === "bought").length;
    const cancelled = planItems.filter((i) => i.status === "cancelled").length;
    const totalEstimated = Number(p.total_estimated);
    const totalActual = Number(p.total_actual);

    return {
      id: p.id,
      name: p.name,
      plannedDate: p.planned_date,
      status: normalizeStatus(p.status),
      note: p.note,
      totalEstimated,
      totalActual,
      variance: totalActual - totalEstimated,
      itemCount: planItems.length,
      boughtCount: bought,
      cancelledCount: cancelled,
      progressPercent: counted.length > 0 ? Math.round((bought / counted.length) * 100) : 0,
      items: planItems,
      createdAt: p.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Rencana
// ---------------------------------------------------------------------------

export interface PlanMutationInput {
  name: string;
  plannedDate?: string;
  note?: string;
  status?: ShoppingPlanStatus;
}

export async function createShoppingPlan(input: PlanMutationInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Nama rencana wajib diisi." };
  if (name.length > 60) return { success: false, error: "Nama rencana maksimal 60 karakter." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shopping_plans")
    .insert({
      family_id: session.familyId,
      name,
      planned_date: input.plannedDate || null,
      note: input.note?.trim() || null,
      status: normalizeStatus(input.status ?? "active"),
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: "Gagal membuat rencana belanja." };

  await logAudit(supabase, session.familyId, session.profileId, "shopping_plan", data.id, "create", null, { name });
  revalidateKeuangan();
  return { success: true, data: { id: data.id } };
}

export async function updateShoppingPlan(id: string, input: PlanMutationInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, id))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Nama rencana wajib diisi." };

  const { error } = await supabase
    .from("shopping_plans")
    .update({
      name,
      planned_date: input.plannedDate || null,
      note: input.note?.trim() || null,
      ...(input.status ? { status: normalizeStatus(input.status) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal memperbarui rencana." };

  revalidateKeuangan();
  return { success: true };
}

export async function setPlanStatus(id: string, status: ShoppingPlanStatus): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, id))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  const { error } = await supabase
    .from("shopping_plans")
    .update({ status: normalizeStatus(status), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal mengubah status rencana." };

  revalidateKeuangan();
  return { success: true };
}

/**
 * Hapus rencana beserta itemnya.
 *
 * Transaksi belanja yang sudah pernah dibuat dari rencana ini TIDAK ikut
 * terhapus dan saldonya tidak diutak-atik (G.9) — tautannya saja yang dilepas.
 */
export async function deleteShoppingPlan(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, id))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  await supabase.from("shopping_transactions").update({ plan_id: null }).eq("plan_id", id);
  await supabase.from("shopping_plan_items").delete().eq("plan_id", id);

  const { error } = await supabase
    .from("shopping_plans")
    .delete()
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal menghapus rencana." };

  await logAudit(supabase, session.familyId, session.profileId, "shopping_plan", id, "delete", null, null);
  revalidateKeuangan();
  return { success: true };
}

export async function duplicatePlan(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("shopping_plans")
    .select("name, planned_date, note")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!plan) return { success: false, error: "Rencana tidak ditemukan." };

  const { data: created, error } = await supabase
    .from("shopping_plans")
    .insert({
      family_id: session.familyId,
      name: `${plan.name} (salinan)`.slice(0, 60),
      planned_date: null,
      note: plan.note,
      status: "draft",
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !created) return { success: false, error: "Gagal menduplikasi rencana." };

  const { data: items } = await supabase
    .from("shopping_plan_items")
    .select("name, qty, estimated_price, note, position")
    .eq("plan_id", id)
    .neq("status", "cancelled")
    .order("position");

  if (items && items.length > 0) {
    await supabase.from("shopping_plan_items").insert(
      items.map((i, index) => ({
        plan_id: created.id,
        name: i.name,
        qty: i.qty,
        estimated_price: i.estimated_price,
        note: i.note,
        position: index,
        status: "pending" as const,
        checked: false,
      }))
    );
    await recalcPlanTotals(supabase, created.id);
  }

  revalidateKeuangan();
  return { success: true, data: { id: created.id } };
}

// ---------------------------------------------------------------------------
// Item rencana
// ---------------------------------------------------------------------------

export interface PlanItemMutationInput {
  name: string;
  qty: number;
  estimatedPrice: number;
  note?: string;
}

function validateItem(input: PlanItemMutationInput): string | null {
  const name = input.name?.trim();
  if (!name) return "Nama barang wajib diisi.";
  if (name.length > 80) return "Nama barang maksimal 80 karakter.";

  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) return "Kuantitas harus lebih dari 0.";

  const price = toRupiah(input.estimatedPrice);
  if (!Number.isFinite(price) || price < 0) return "Estimasi harga tidak valid.";

  return null;
}

export async function addPlanItem(planId: string, input: PlanItemMutationInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const invalid = validateItem(input);
  if (invalid) return { success: false, error: invalid };

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, planId))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  const { count } = await supabase
    .from("shopping_plan_items")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);

  const { error } = await supabase.from("shopping_plan_items").insert({
    plan_id: planId,
    name: input.name.trim(),
    qty: Number(input.qty),
    estimated_price: toRupiah(input.estimatedPrice),
    note: input.note?.trim() || null,
    position: count ?? 0,
    status: "pending",
    checked: false,
  });

  if (error) return { success: false, error: "Gagal menambah barang." };

  await recalcPlanTotals(supabase, planId);
  revalidateKeuangan();
  return { success: true };
}

export async function updatePlanItem(itemId: string, input: PlanItemMutationInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const invalid = validateItem(input);
  if (invalid) return { success: false, error: invalid };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { error } = await supabase
    .from("shopping_plan_items")
    .update({
      name: input.name.trim(),
      qty: Number(input.qty),
      estimated_price: toRupiah(input.estimatedPrice),
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { success: false, error: "Gagal memperbarui barang." };

  await recalcPlanTotals(supabase, item.plan_id);
  revalidateKeuangan();
  return { success: true };
}

export async function setPlanItemStatus(
  itemId: string,
  status: ShoppingPlanItemStatus
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { error } = await supabase
    .from("shopping_plan_items")
    .update({
      status,
      checked: status === "bought",
      ...(status === "pending" ? { actual_price: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { success: false, error: "Gagal memperbarui status barang." };

  await recalcPlanTotals(supabase, item.plan_id);
  revalidateKeuangan();
  return { success: true };
}

export async function deletePlanItem(itemId: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { error } = await supabase.from("shopping_plan_items").delete().eq("id", itemId);
  if (error) return { success: false, error: "Gagal menghapus barang." };

  await recalcPlanTotals(supabase, item.plan_id);
  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ubah item rencana menjadi transaksi belanja
// ---------------------------------------------------------------------------

export interface CheckoutPlanItemInput {
  itemId: string;
  actualPrice: number;
  /** "main" atau UUID pocket. */
  source: string;
  date: string;
  category?: string;
  merchant?: string;
  clientToken?: string;
}

/**
 * Tandai barang rencana sebagai sudah dibeli dan catat transaksi belanjanya.
 * Pemotongan saldo dilakukan oleh RPC belanja, jadi record + saldo tetap atomik.
 */
export async function checkoutPlanItem(input: CheckoutPlanItemInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const price = toRupiah(input.actualPrice);
  if (!Number.isFinite(price) || price < 0) return { success: false, error: "Harga aktual tidak valid." };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, input.itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { data: plan } = await supabase
    .from("shopping_plans")
    .select("name")
    .eq("id", item.plan_id)
    .maybeSingle();

  const result = await createShoppingTransaction({
    merchant: input.merchant?.trim() || plan?.name || "Belanja Rencana",
    date: input.date,
    source: input.source,
    category: input.category ?? "belanja_rumah",
    items: [{ name: item.name, qty: Number(item.qty), price }],
    origin: "plan",
    planId: item.plan_id,
    clientToken: input.clientToken,
  });

  if (!result.success) return { success: false, error: result.error };

  await supabase
    .from("shopping_plan_items")
    .update({
      status: "bought",
      checked: true,
      actual_price: price,
      transaction_id: result.data?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId);

  await recalcPlanTotals(supabase, item.plan_id);

  // Rencana otomatis selesai bila semua barang aktif sudah dibeli.
  const { data: siblings } = await supabase
    .from("shopping_plan_items")
    .select("status")
    .eq("plan_id", item.plan_id);

  const active = (siblings ?? []).filter((i) => i.status !== "cancelled");
  if (active.length > 0 && active.every((i) => i.status === "bought")) {
    await supabase.from("shopping_plans").update({ status: "done" }).eq("id", item.plan_id);
  }

  revalidateKeuangan();
  return { success: true };
}
