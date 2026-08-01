"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  toRupiah,
  isUuid,
  isMissingSchema,
  FORBIDDEN,
  type AdminClient,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { createShoppingTransaction } from "@/app/actions/belanja";
import { distributeTotal } from "@/lib/shopping-total";
import { MAX_ITEM_NAME_LENGTH, normalizeItemName, normalizeUnit } from "@/lib/shopping-item";
import { isShoppingCategory, resolveItemCategory, type ShoppingCategory } from "@/lib/shopping-category";
import { formatMonthLabel } from "@/lib/format";
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
  /**
   * Kelompok rak toko. Diambil dari kolom `category` bila sudah diisi manual,
   * selain itu DITEBAK dari nama barang — jadi checklist tetap terkelompok
   * rapi walau tidak ada yang pernah mengatur kategorinya satu per satu.
   */
  category: ShoppingCategory;
  /** Satuan barang ("kg", "kotak"). Disimpan di kolom `note`. */
  unit: string | null;
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

interface PlanItemRow {
  id: string;
  plan_id: string;
  name: string;
  qty: number | string;
  estimated_price: number | string;
  actual_price: number | string | null;
  status: ShoppingPlanItemStatus;
  category: string | null;
  note: string | null;
  transaction_id: string | null;
  position: number;
}

const PLAN_ITEM_COLUMNS =
  "id, plan_id, name, qty, estimated_price, actual_price, status, note, transaction_id, position";

/**
 * Ambil barang rencana beserta kolom `category`.
 *
 * `category` baru ada setelah migration 0025. Selama belum, PostgREST menolak
 * kolom itu (42703) — permintaan diulang tanpa `category` dan pengelompokan
 * jatuh ke tebakan dari nama barang. Pola cadangan yang sama sudah dipakai
 * untuk kolom `unit` (migration 0024); tanpa itu, seluruh menu Belanja gagal
 * dimuat di lingkungan yang tertinggal satu migration.
 */
async function selectPlanItems(supabase: AdminClient, planIds: string[]): Promise<PlanItemRow[]> {
  if (planIds.length === 0) return [];

  const withCategory = await supabase
    .from("shopping_plan_items")
    .select(`${PLAN_ITEM_COLUMNS}, category`)
    .in("plan_id", planIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (!withCategory.error) return (withCategory.data ?? []) as PlanItemRow[];

  const legacy = await supabase
    .from("shopping_plan_items")
    .select(PLAN_ITEM_COLUMNS)
    .in("plan_id", planIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  return ((legacy.data ?? []) as Omit<PlanItemRow, "category">[]).map((row) => ({
    ...row,
    category: null,
  }));
}

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

  const items = await selectPlanItems(
    supabase,
    plans.map((p) => p.id)
  );

  return plans.map((p) => {
    const planItems: PlanItemView[] = items
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
          category: resolveItemCategory(i.category, i.name),
          unit: i.note,
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
  /** Satuan barang. Disimpan di kolom `note` (belum ada kolom `unit`). */
  unit?: string;
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
    note: input.unit?.trim().slice(0, 20) || null,
    position: count ?? 0,
    status: "pending",
    checked: false,
  });

  if (error) return { success: false, error: "Gagal menambah barang." };

  await recalcPlanTotals(supabase, planId);
  revalidateKeuangan();
  return { success: true };
}

export interface BulkPlanItemInput {
  name: string;
  qty: number;
  estimatedPrice?: number;
  /** Satuan ("kg", "liter", ...). Disimpan di kolom `note`. */
  unit?: string;
}

/**
 * Tambah banyak barang sekaligus — hasil fitur "tempel daftar belanja".
 *
 * Satu INSERT untuk seluruh daftar supaya menempel 40 barang tetap satu
 * round-trip, dan posisinya melanjutkan barang yang sudah ada.
 *
 * Satuan disimpan di kolom `note` karena shopping_plan_items belum punya
 * kolom `unit`; UI menampilkannya sebagai chip satuan di samping kuantitas.
 */
export async function addPlanItemsBulk(
  planId: string,
  items: BulkPlanItemInput[]
): Promise<ActionResult<{ added: number }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: "Tidak ada barang untuk ditambahkan." };
  }
  if (items.length > 100) {
    return { success: false, error: "Maksimal 100 barang sekali tempel." };
  }

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, planId))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  const clean: { name: string; qty: number; price: number; unit: string | null }[] = [];
  for (const raw of items) {
    const name = String(raw?.name ?? "").trim();
    if (!name) continue; // baris kosong diabaikan, bukan menggagalkan seluruh tempelan
    if (name.length > 80) return { success: false, error: `Nama barang "${name.slice(0, 20)}…" terlalu panjang.` };

    const qty = Number(raw?.qty);
    const price = toRupiah(raw?.estimatedPrice ?? 0);
    clean.push({
      name,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      unit: raw?.unit?.trim() ? raw.unit.trim().slice(0, 20) : null,
    });
  }

  if (clean.length === 0) return { success: false, error: "Tidak ada barang yang bisa dibaca." };

  const { count } = await supabase
    .from("shopping_plan_items")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);

  const offset = count ?? 0;
  const { error } = await supabase.from("shopping_plan_items").insert(
    clean.map((item, index) => ({
      plan_id: planId,
      name: item.name,
      qty: item.qty,
      estimated_price: item.price,
      note: item.unit,
      position: offset + index,
      status: "pending" as const,
      checked: false,
    }))
  );

  if (error) return { success: false, error: "Gagal menambah barang." };

  await recalcPlanTotals(supabase, planId);
  await logAudit(supabase, session.familyId, session.profileId, "shopping_plan", planId, "bulk_add_items", null, {
    added: clean.length,
  });
  revalidateKeuangan();
  return { success: true, data: { added: clean.length } };
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
      note: input.unit?.trim().slice(0, 20) || null,
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

/**
 * Ubah kuantitas satu barang saja.
 *
 * Dipakai checklist di toko: pengguna hanya menekan −/+ dan tidak boleh
 * dipaksa mengisi ulang nama & harga seperti pada updatePlanItem().
 */
export async function setPlanItemQty(itemId: string, qty: number): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const nextQty = Number(qty);
  if (!Number.isFinite(nextQty) || nextQty <= 0) return { success: false, error: "Kuantitas harus lebih dari 0." };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { error } = await supabase
    .from("shopping_plan_items")
    .update({ qty: nextQty, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return { success: false, error: "Gagal memperbarui kuantitas." };

  await recalcPlanTotals(supabase, item.plan_id);
  revalidateKeuangan();
  return { success: true };
}

/**
 * Timpa kelompok rak sebuah barang.
 *
 * Hanya dipakai ketika tebakan otomatis meleset — mayoritas barang tidak
 * pernah menyentuh fungsi ini, karena kategorinya sudah benar sejak diketik.
 */
export async function setPlanItemCategory(itemId: string, category: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isShoppingCategory(category)) return { success: false, error: "Kategori tidak dikenal." };

  const supabase = createAdminClient();
  const item = await resolveOwnedItem(supabase, session.familyId, itemId);
  if (!item) return { success: false, error: "Barang tidak ditemukan." };

  const { error } = await supabase
    .from("shopping_plan_items")
    .update({ category, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (isMissingSchema(error)) {
    return {
      success: false,
      error:
        "Mengatur kategori manual butuh migration 0025. Sementara ini kelompoknya ditebak dari nama barang.",
    };
  }
  if (error) return { success: false, error: "Gagal mengubah kategori barang." };

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
// Rekomendasi rencana bulan berikutnya
// ---------------------------------------------------------------------------

export interface PlanTemplateItem {
  name: string;
  qty: number;
  unit: string;
  estimatedPrice: number;
}

export interface ShoppingSource {
  id: string;
  kind: "transaction";
  label: string;
  /** "YYYY-MM-DD" tanggal belanja. */
  date: string;
  total: number;
  itemCount: number;
}

/**
 * Transaksi belanja yang layak dijadikan sumber rekomendasi.
 *
 * Rencana yang sudah ada TIDAK ikut di sini: halaman Belanja sudah memegang
 * seluruh rencana beserta barangnya lewat props, jadi memakainya sebagai
 * sumber tidak memerlukan query sama sekali. Dua query di bawah hanya berjalan
 * sekali, saat panel rekomendasi dibuka.
 */
export async function getShoppingSources(limit = 12): Promise<ShoppingSource[]> {
  const session = await requireFinanceSession();
  if (!session) return [];

  const supabase = createAdminClient();
  // HANYA kategori belanja. Pengeluaran umum dari Keuangan (listrik, sekolah)
  // menumpang tabel yang sama, dan menawarkannya sebagai "daftar barang bulan
  // lalu" hanya akan membingungkan.
  const { data: rows } = await supabase
    .from("shopping_transactions")
    .select("id, merchant, name, date, total")
    .eq("family_id", session.familyId)
    .eq("category", "belanja")
    .order("date", { ascending: false })
    .limit(limit);

  const transactions = rows ?? [];
  if (transactions.length === 0) return [];

  const { data: itemRows } = await supabase
    .from("shopping_transaction_items")
    .select("transaction_id")
    .in(
      "transaction_id",
      transactions.map((t) => t.id)
    );

  const counts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    counts.set(row.transaction_id, (counts.get(row.transaction_id) ?? 0) + 1);
  }

  return transactions.map((t) => ({
    id: t.id,
    kind: "transaction" as const,
    label: t.merchant ?? t.name ?? "Belanja",
    date: t.date,
    total: Number(t.total),
    itemCount: counts.get(t.id) ?? 0,
  }));
}

/** Barang satu transaksi belanja, sudah berbentuk usulan item rencana. */
export async function getSourceItems(transactionId: string): Promise<PlanTemplateItem[]> {
  const session = await requireFinanceSession();
  if (!session || !isUuid(transactionId)) return [];

  const supabase = createAdminClient();
  const { data: owner } = await supabase
    .from("shopping_transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!owner) return [];

  // `unit` baru ada setelah migration 0024; bila belum, ambil tanpa kolom itu.
  const withUnit = await supabase
    .from("shopping_transaction_items")
    .select("name, qty, price, unit")
    .eq("transaction_id", transactionId)
    .order("position");

  const rows = withUnit.error
    ? (
        await supabase
          .from("shopping_transaction_items")
          .select("name, qty, price")
          .eq("transaction_id", transactionId)
          .order("position")
      ).data ?? []
    : withUnit.data ?? [];

  return (rows as { name: string; qty: number | string; price: number | string; unit?: string | null }[])
    .map((row) => ({
      name: normalizeItemName(row.name),
      qty: Number(row.qty) > 0 ? Number(row.qty) : 1,
      unit: normalizeUnit(row.unit),
      estimatedPrice: Math.max(0, Math.round(Number(row.price) || 0)),
    }))
    .filter((item) => item.name.length > 0);
}

export interface CreatePlanFromTemplateInput {
  name: string;
  plannedDate?: string;
  note?: string;
  items: PlanTemplateItem[];
  /** Label sumber rekomendasi, disimpan di catatan agar asal-usulnya jelas. */
  sourceLabel?: string;
  /** "YYYY-MM" periode asal. */
  sourceMonth?: string;
}

/**
 * Simpan draft rekomendasi menjadi satu rencana belanja baru.
 *
 * TIDAK membuat transaksi dan TIDAK menyentuh saldo — ini murni daftar
 * rencana; uang baru berkurang lewat "Selesaikan Belanja".
 *
 * Penjaga rencana ganda: bila rencana dengan nama + tanggal yang sama sudah
 * dibuat keluarga ini dalam 10 menit terakhir, id rencana itu yang
 * dikembalikan alih-alih membuat rencana kedua. Itu menutup celah klik ganda
 * dan pengiriman ulang setelah jaringan putus, tanpa perlu kolom token baru.
 */
export async function createPlanFromTemplate(
  input: CreatePlanFromTemplateInput
): Promise<ActionResult<{ id: string; added: number; reused: boolean }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const name = normalizeItemName(input.name).slice(0, 60);
  if (!name) return { success: false, error: "Nama rencana wajib diisi." };

  const plannedDate = /^\d{4}-\d{2}-\d{2}$/.test(input.plannedDate ?? "") ? input.plannedDate! : null;

  const clean = (Array.isArray(input.items) ? input.items : [])
    .map((raw) => ({
      name: normalizeItemName(raw?.name),
      qty: Number(raw?.qty) > 0 ? Number(raw.qty) : 1,
      unit: normalizeUnit(raw?.unit),
      price: Math.max(0, Math.round(Number(raw?.estimatedPrice) || 0)),
    }))
    .filter((item) => item.name.length > 0 && item.name.length <= MAX_ITEM_NAME_LENGTH)
    .slice(0, 100);

  if (clean.length === 0) return { success: false, error: "Tidak ada barang untuk disimpan." };

  const supabase = createAdminClient();

  const sinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("shopping_plans")
    .select("id")
    .eq("family_id", session.familyId)
    .eq("name", name)
    .gte("created_at", sinceIso)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return { success: true, data: { id: recent.id, added: 0, reused: true } };
  }

  const noteParts = [input.note?.trim()].filter(Boolean) as string[];
  if (input.sourceLabel) {
    const period = input.sourceMonth ? ` (${formatMonthLabel(input.sourceMonth)})` : "";
    noteParts.push(`Rekomendasi dari ${input.sourceLabel}${period}`);
  }

  const { data: plan, error } = await supabase
    .from("shopping_plans")
    .insert({
      family_id: session.familyId,
      name,
      planned_date: plannedDate,
      note: noteParts.join(" · ").slice(0, 200) || null,
      status: "draft",
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !plan) return { success: false, error: "Gagal membuat rencana." };

  const { error: itemError } = await supabase.from("shopping_plan_items").insert(
    clean.map((item, index) => ({
      plan_id: plan.id,
      name: item.name,
      qty: item.qty,
      estimated_price: item.price,
      note: item.unit || null,
      position: index,
      status: "pending" as const,
      checked: false,
    }))
  );

  if (itemError) {
    // Rencana kosong lebih membingungkan daripada tidak ada rencana sama sekali.
    await supabase.from("shopping_plans").delete().eq("id", plan.id);
    return { success: false, error: "Gagal menyimpan daftar barang." };
  }

  await recalcPlanTotals(supabase, plan.id);
  await logAudit(supabase, session.familyId, session.profileId, "shopping_plan", plan.id, "create_from_template", null, {
    name,
    items: clean.length,
    source: input.sourceLabel ?? null,
  });
  revalidateKeuangan();

  return { success: true, data: { id: plan.id, added: clean.length, reused: false } };
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

export interface ExtraShoppingItemInput {
  name: string;
  qty: number;
  price?: number;
  unit?: string;
}

export interface CompleteShoppingPlanInput {
  planId: string;
  source: string;
  date: string;
  merchant: string;
  note?: string;
  actualPrices?: Record<string, number>;
  /** Barang yang dibeli di luar rencana (barang tambahan). */
  extraItems?: ExtraShoppingItemInput[];
  /**
   * Total yang benar-benar dibayar di kasir. Bila diisi dan berbeda dari
   * jumlah rincian, selisihnya dicatat sebagai satu baris penyesuaian agar
   * total transaksi persis sama dengan struk.
   */
  totalPaid?: number;
  receiptIds?: string[];
  clientToken?: string;
}

export async function completeShoppingPlan(input: CompleteShoppingPlanInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return { success: false, error: "Tanggal tidak valid." };
  const merchant = input.merchant?.trim();
  if (!merchant) return { success: false, error: "Nama toko wajib diisi." };

  const supabase = createAdminClient();
  if (!(await assertPlanOwnership(supabase, session.familyId, input.planId))) {
    return { success: false, error: "Rencana tidak ditemukan." };
  }

  // Penjaga transaksi ganda #1: satu rencana hanya boleh punya satu transaksi.
  // (Penjaga #2 adalah client_token idempotency di dalam RPC fin_create_shopping.)
  const { data: existingTx } = await supabase
    .from("shopping_transactions")
    .select("id")
    .eq("family_id", session.familyId)
    .eq("plan_id", input.planId)
    .limit(1);

  if ((existingTx ?? []).length > 0) {
    return { success: false, error: "Rencana ini sudah memiliki transaksi belanja." };
  }

  const { data: rows } = await supabase
    .from("shopping_plan_items")
    .select("id, name, qty, estimated_price, actual_price, status, note, transaction_id")
    .eq("plan_id", input.planId)
    .order("position");

  const active = (rows ?? []).filter((item) => item.status !== "cancelled");
  const extras = (input.extraItems ?? [])
    .map((raw) => {
      const name = String(raw?.name ?? "").trim();
      const qty = Number(raw?.qty);
      const price = toRupiah(raw?.price ?? 0);
      return {
        name,
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        unit: normalizeUnit(raw?.unit),
      };
    })
    .filter((item) => item.name.length > 0 && item.name.length <= MAX_ITEM_NAME_LENGTH);

  if (active.length === 0 && extras.length === 0) {
    return { success: false, error: "Tidak ada barang aktif untuk diselesaikan." };
  }
  if (active.some((item) => item.transaction_id)) {
    return { success: false, error: "Sebagian barang sudah pernah dicatat sebagai transaksi." };
  }

  const prices = input.actualPrices ?? {};
  const items = active.map((item) => {
    const actual = toRupiah(prices[item.id] ?? item.actual_price ?? item.estimated_price);
    return {
      name: item.name,
      qty: Number(item.qty),
      price: Number.isFinite(actual) && actual >= 0 ? actual : Number(item.estimated_price),
      // Satuan checklist ikut ke transaksi, supaya detail transaksi menulis
      // "5 kg" persis seperti barisnya di checklist.
      unit: normalizeUnit(item.note),
    };
  });

  items.push(...extras);

  // Total yang dibayar di kasir adalah kebenaran akhir: harga rincian
  // diselaraskan agar jumlahnya persis sama (lihat lib/shopping-total.ts).
  const totalPaid = toRupiah(input.totalPaid ?? 0);
  const finalItems =
    Number.isFinite(totalPaid) && totalPaid > 0 ? distributeTotal(items, totalPaid) : items;

  const result = await createShoppingTransaction({
    merchant,
    date: input.date,
    source: input.source,
    category: "belanja",
    note: input.note,
    items: finalItems,
    origin: "plan",
    planId: input.planId,
    receiptIds: input.receiptIds,
    clientToken: input.clientToken,
  });

  if (!result.success || !result.data) return result;

  // `finalItems` diawali oleh barang rencana dengan urutan yang sama dengan
  // `active`, jadi harga hasil penyelarasan bisa dipetakan balik per barang.
  for (const [index, item] of active.entries()) {
    await supabase
      .from("shopping_plan_items")
      .update({
        status: "bought",
        checked: true,
        actual_price: finalItems[index]?.price ?? Number(item.estimated_price),
        transaction_id: result.data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  await recalcPlanTotals(supabase, input.planId);
  await supabase
    .from("shopping_plans")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", input.planId)
    .eq("family_id", session.familyId);

  revalidateKeuangan();
  return { success: true, data: { id: result.data.id } };
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
    category: input.category ?? "belanja",
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
