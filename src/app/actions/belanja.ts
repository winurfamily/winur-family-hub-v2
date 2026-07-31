"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  rpcError,
  toRupiah,
  safeToken,
  isUuid,
  FORBIDDEN,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { syncChildSaldoFromPocket } from "@/lib/server/child-savings";
import { resolveProducts } from "@/lib/server/products";
import { attachReceiptToTransaction, removeReceiptFiles } from "@/lib/server/receipts";
import { currentMonth, monthRange } from "@/lib/finance";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ShoppingTransactionSource,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Bentuk data
// ---------------------------------------------------------------------------

export interface ShoppingItemInput {
  name: string;
  qty: number;
  price: number;
}

export interface ShoppingItemView extends ShoppingItemInput {
  id: string;
  subtotal: number;
}

export interface ShoppingReceiptView {
  id: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ShoppingTransactionView {
  id: string;
  merchant: string;
  date: string;
  total: number;
  category: ExpenseCategory;
  note: string | null;
  source: ShoppingTransactionSource;
  pocketId: string | null;
  pocketName: string;
  planId: string | null;
  createdByName: string;
  createdAt: string;
  items: ShoppingItemView[];
  receipts: ShoppingReceiptView[];
}

function normalizeCategory(value: unknown): ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : "lainnya";
}

/** Bersihkan & validasi daftar item dari client. Nominal selalu dibulatkan. */
function sanitizeItems(items: ShoppingItemInput[]): { items: ShoppingItemInput[]; error?: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], error: "Tambahkan minimal satu barang." };
  }
  if (items.length > 100) {
    return { items: [], error: "Maksimal 100 barang per transaksi." };
  }

  const clean: ShoppingItemInput[] = [];
  for (const raw of items) {
    const name = String(raw?.name ?? "").trim();
    const qty = Number(raw?.qty);
    const price = toRupiah(raw?.price);

    if (!name) return { items: [], error: "Nama barang wajib diisi." };
    if (name.length > 80) return { items: [], error: `Nama barang "${name.slice(0, 20)}…" terlalu panjang.` };
    if (!Number.isFinite(qty) || qty <= 0) return { items: [], error: `Kuantitas "${name}" harus lebih dari 0.` };
    if (!Number.isFinite(price) || price < 0) return { items: [], error: `Harga "${name}" tidak valid.` };

    clean.push({ name, qty, price });
  }

  return { items: clean };
}

// ---------------------------------------------------------------------------
// Simpan transaksi belanja
// ---------------------------------------------------------------------------

export interface SaveShoppingInput {
  merchant: string;
  date: string;
  /** "main" atau UUID pocket. */
  source: string;
  category: string;
  note?: string;
  items: ShoppingItemInput[];
  /** id receipt_attachments hasil upload; ditautkan setelah transaksi tersimpan. */
  receiptIds?: string[];
  origin?: ShoppingTransactionSource;
  planId?: string | null;
  clientToken?: string;
}

export async function createShoppingTransaction(
  input: SaveShoppingInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const merchant = input.merchant?.trim();
  if (!merchant) return { success: false, error: "Nama toko wajib diisi." };
  if (merchant.length > 80) return { success: false, error: "Nama toko maksimal 80 karakter." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return { success: false, error: "Tanggal tidak valid." };

  const { items, error: itemError } = sanitizeItems(input.items);
  if (itemError) return { success: false, error: itemError };

  const pocketId = input.source === "main" ? null : input.source;
  if (pocketId !== null && !isUuid(pocketId)) return { success: false, error: "Sumber dana tidak valid." };

  const planId = isUuid(input.planId) ? input.planId : null;

  const supabase = createAdminClient();

  if (planId) {
    const { data: plan } = await supabase
      .from("shopping_plans")
      .select("id")
      .eq("id", planId)
      .eq("family_id", session.familyId)
      .maybeSingle();
    if (!plan) return { success: false, error: "Rencana belanja tidak ditemukan." };
  }

  const { data: id, error } = await supabase.rpc("fin_create_shopping", {
    p_family_id: session.familyId,
    p_merchant: merchant,
    p_date: input.date,
    p_pocket_id: pocketId,
    p_category: normalizeCategory(input.category),
    p_note: input.note?.trim() || null,
    p_source: input.origin ?? "manual",
    p_plan_id: planId,
    p_items: items,
    p_created_by: session.profileId,
    p_client_token: safeToken(input.clientToken),
  });

  if (error || !id) return { success: false, error: rpcError(error, "Gagal menyimpan transaksi belanja.") };

  const total = items.reduce((acc, i) => acc + Math.round(i.qty * i.price), 0);

  // Tautkan struk yang sudah terunggah. Dilakukan setelah transaksi tersimpan
  // agar tidak ada file yatim saat penyimpanan transaksi gagal.
  if (input.receiptIds?.length) {
    await attachReceiptToTransaction(supabase, session.familyId, input.receiptIds, id);
  }

  await resolveProducts(supabase, session.familyId, items);
  await logAudit(supabase, session.familyId, session.profileId, "shopping_transaction", id, "create", null, {
    merchant,
    total,
    pocket_id: pocketId,
    items: items.length,
  });

  await syncPocketMirror(supabase, session.familyId, pocketId, -total);
  revalidateKeuangan();
  return { success: true, data: { id } };
}

export async function updateShoppingTransaction(
  id: string,
  input: SaveShoppingInput
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Transaksi tidak ditemukan." };

  const merchant = input.merchant?.trim();
  if (!merchant) return { success: false, error: "Nama toko wajib diisi." };

  const { items, error: itemError } = sanitizeItems(input.items);
  if (itemError) return { success: false, error: itemError };

  const pocketId = input.source === "main" ? null : input.source;
  if (pocketId !== null && !isUuid(pocketId)) return { success: false, error: "Sumber dana tidak valid." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("shopping_transactions")
    .select("merchant, total, pocket_id, category, date")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!before) return { success: false, error: "Transaksi tidak ditemukan." };

  const { error } = await supabase.rpc("fin_update_shopping", {
    p_transaction_id: id,
    p_family_id: session.familyId,
    p_merchant: merchant,
    p_date: input.date,
    p_pocket_id: pocketId,
    p_category: normalizeCategory(input.category),
    p_note: input.note?.trim() || null,
    p_items: items,
    p_updated_by: session.profileId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal memperbarui transaksi.") };

  if (input.receiptIds?.length) {
    await attachReceiptToTransaction(supabase, session.familyId, input.receiptIds, id);
  }

  const newTotal = items.reduce((acc, i) => acc + Math.round(i.qty * i.price), 0);
  const oldTotal = Number(before.total);

  await resolveProducts(supabase, session.familyId, items);
  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "shopping_transaction",
    id,
    "update",
    { ...before, total: oldTotal },
    { merchant, total: newTotal, pocket_id: pocketId }
  );

  if (before.pocket_id !== pocketId) {
    await syncPocketMirror(supabase, session.familyId, before.pocket_id, oldTotal);
    await syncPocketMirror(supabase, session.familyId, pocketId, -newTotal);
  } else {
    await syncPocketMirror(supabase, session.familyId, pocketId, oldTotal - newTotal);
  }

  revalidateKeuangan();
  return { success: true };
}

/**
 * Hapus transaksi belanja. Dana dikembalikan ke sumbernya (berbeda dari hapus
 * riwayat transfer). `deleteReceipts` menentukan apakah file struk ikut dihapus
 * atau dilepas menjadi file lepas yang bisa dibersihkan lewat Storage Manager.
 */
export async function deleteShoppingTransaction(
  id: string,
  deleteReceipts = false
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Transaksi tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("shopping_transactions")
    .select("merchant, total, pocket_id, date, category")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!before) return { success: false, error: "Transaksi tidak ditemukan." };

  const { data: receipts } = await supabase
    .from("receipt_attachments")
    .select("id")
    .eq("family_id", session.familyId)
    .eq("transaction_id", id);

  const { error } = await supabase.rpc("fin_delete_shopping", {
    p_transaction_id: id,
    p_family_id: session.familyId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal menghapus transaksi.") };

  if (deleteReceipts && receipts?.length) {
    await removeReceiptFiles(
      supabase,
      session.familyId,
      receipts.map((r) => r.id)
    );
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "shopping_transaction",
    id,
    "delete",
    { ...before, total: Number(before.total) },
    null
  );

  await syncPocketMirror(supabase, session.familyId, before.pocket_id, Number(before.total));
  revalidateKeuangan();
  return { success: true };
}

async function syncPocketMirror(
  supabase: ReturnType<typeof createAdminClient>,
  familyId: string,
  pocketId: string | null,
  delta: number
) {
  if (!pocketId || !delta) return;
  const { data: pocket } = await supabase.from("pockets").select("name").eq("id", pocketId).maybeSingle();
  if (pocket) await syncChildSaldoFromPocket(supabase, familyId, pocket.name, delta);
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------

export async function getShoppingTransaction(id: string): Promise<ShoppingTransactionView | null> {
  const session = await requireFinanceSession();
  if (!session || !isUuid(id)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shopping_transactions")
    .select(
      "id, merchant, name, date, total, category, note, source, pocket_id, plan_id, created_by, created_at"
    )
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!data) return null;

  const [itemsRes, receiptsRes, pocketRes, profileRes] = await Promise.all([
    supabase
      .from("shopping_transaction_items")
      .select("id, name, qty, price, subtotal")
      .eq("transaction_id", id)
      .order("position"),
    supabase
      .from("receipt_attachments")
      .select("id, storage_path, file_size, mime_type, width, height, created_at")
      .eq("family_id", session.familyId)
      .eq("transaction_id", id)
      .order("created_at"),
    data.pocket_id
      ? supabase.from("pockets").select("name").eq("id", data.pocket_id).maybeSingle()
      : Promise.resolve({ data: null }),
    data.created_by
      ? supabase.from("profiles").select("name").eq("id", data.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: data.id,
    merchant: data.merchant ?? data.name,
    date: data.date,
    total: Number(data.total),
    category: normalizeCategory(data.category),
    note: data.note,
    source: data.source,
    pocketId: data.pocket_id,
    pocketName: data.pocket_id ? pocketRes.data?.name ?? "Pocket" : "Saldo Utama",
    planId: data.plan_id,
    createdByName: profileRes.data?.name ?? "—",
    createdAt: data.created_at,
    items: (itemsRes.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      qty: Number(i.qty),
      price: Number(i.price),
      subtotal: Number(i.subtotal),
    })),
    receipts: (receiptsRes.data ?? []).map((r) => ({
      id: r.id,
      storagePath: r.storage_path,
      fileSize: Number(r.file_size),
      mimeType: r.mime_type,
      width: r.width,
      height: r.height,
      createdAt: r.created_at,
    })),
  };
}

export interface ShoppingHistoryItem {
  id: string;
  merchant: string;
  date: string;
  total: number;
  category: ExpenseCategory;
  source: ShoppingTransactionSource;
  pocketName: string;
  itemCount: number;
  hasReceipt: boolean;
}

export interface ShoppingHistoryResult {
  items: ShoppingHistoryItem[];
  total: number;
  count: number;
}

export async function getShoppingHistory(month?: string): Promise<ShoppingHistoryResult> {
  const session = await requireFinanceSession();
  if (!session) return { items: [], total: 0, count: 0 };

  const targetMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : currentMonth();
  const { start, end } = monthRange(targetMonth);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shopping_transactions")
    .select("id, merchant, name, date, total, category, source, pocket_id")
    .eq("family_id", session.familyId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  if (rows.length === 0) return { items: [], total: 0, count: 0 };

  const ids = rows.map((r) => r.id);
  const pocketIds = Array.from(new Set(rows.map((r) => r.pocket_id).filter(isUuid)));

  const [itemCountRes, receiptRes, pocketsRes] = await Promise.all([
    supabase.from("shopping_transaction_items").select("transaction_id").in("transaction_id", ids),
    supabase
      .from("receipt_attachments")
      .select("transaction_id")
      .eq("family_id", session.familyId)
      .in("transaction_id", ids),
    pocketIds.length > 0
      ? supabase.from("pockets").select("id, name").eq("family_id", session.familyId).in("id", pocketIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const counts = new Map<string, number>();
  for (const row of itemCountRes.data ?? []) {
    counts.set(row.transaction_id, (counts.get(row.transaction_id) ?? 0) + 1);
  }
  const withReceipt = new Set((receiptRes.data ?? []).map((r) => r.transaction_id).filter(isUuid));
  const pocketNames = new Map((pocketsRes.data ?? []).map((p) => [p.id, p.name]));

  const items: ShoppingHistoryItem[] = rows.map((r) => ({
    id: r.id,
    merchant: r.merchant ?? r.name,
    date: r.date,
    total: Number(r.total),
    category: normalizeCategory(r.category),
    source: r.source,
    pocketName: r.pocket_id ? pocketNames.get(r.pocket_id) ?? "Pocket" : "Saldo Utama",
    itemCount: counts.get(r.id) ?? 0,
    hasReceipt: withReceipt.has(r.id),
  }));

  return {
    items,
    total: items.reduce((acc, i) => acc + i.total, 0),
    count: items.length,
  };
}
