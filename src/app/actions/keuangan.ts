"use server";

import { revalidatePath } from "next/cache";
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
  type AdminClient,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { syncChildSaldoFromPocket } from "@/lib/server/child-savings";
import { normalizeProductName, currentMonth, monthRange, lastMonths } from "@/lib/finance";
import type { PocketType } from "@/lib/supabase/types";

export type { ActionResult };

/** Jika pocket bernama "Tabungan {Nama Anak}", revalidate halaman beranda anak terkait. */
async function revalidateChildSavingsPocket(supabase: AdminClient, familyId: string, pocketName: string) {
  const match = pocketName.match(/^Tabungan (.+)$/i);
  if (!match) return;

  const { data: child } = await supabase
    .from("profiles")
    .select("id")
    .eq("family_id", familyId)
    .eq("role", "child")
    .ilike("name", match[1])
    .maybeSingle();

  if (child) revalidatePath(`/child/${child.id}`);
}

// ---------------------------------------------------------------------------
// Ringkasan saldo
// ---------------------------------------------------------------------------

export interface PocketSummary {
  id: string;
  name: string;
  type: PocketType;
  balance: number;
  totalSpent: number;
}

export interface FinanceSummary {
  saldoUtama: number;
  totalPockets: number;
  totalKeluarga: number;
  totalIncome: number;
  totalExpenseThisMonth: number;
  pockets: PocketSummary[];
}

/**
 * Saldo Utama dibaca dari families.main_balance (kolom tersimpan sejak
 * migration 0017), bukan dihitung ulang dari riwayat seperti sebelumnya.
 * Inilah yang membuat penghapusan riwayat transfer tidak lagi mengubah saldo.
 */
export async function getFinanceSummary(): Promise<FinanceSummary | null> {
  const session = await requireFinanceSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { start, end } = monthRange(currentMonth());

  const [familyRes, pocketsRes, incomeRes, monthExpenseRes, pocketExpenseRes] = await Promise.all([
    supabase.from("families").select("main_balance").eq("id", session.familyId).maybeSingle(),
    supabase
      .from("pockets")
      .select("id, name, type, balance")
      .eq("family_id", session.familyId)
      .order("created_at", { ascending: true }),
    supabase.from("income").select("amount").eq("family_id", session.familyId),
    supabase
      .from("shopping_transactions")
      .select("total")
      .eq("family_id", session.familyId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("shopping_transactions")
      .select("pocket_id, total")
      .eq("family_id", session.familyId)
      .not("pocket_id", "is", null),
  ]);

  const spentByPocket = new Map<string, number>();
  for (const row of pocketExpenseRes.data ?? []) {
    const pocketId = row.pocket_id as string;
    spentByPocket.set(pocketId, (spentByPocket.get(pocketId) ?? 0) + Number(row.total));
  }

  const pockets: PocketSummary[] = (pocketsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    balance: Number(p.balance),
    totalSpent: spentByPocket.get(p.id) ?? 0,
  }));

  const saldoUtama = Number(familyRes.data?.main_balance ?? 0);
  const totalPockets = pockets.reduce((acc, p) => acc + p.balance, 0);

  return {
    saldoUtama,
    totalPockets,
    totalKeluarga: saldoUtama + totalPockets,
    totalIncome: (incomeRes.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0),
    totalExpenseThisMonth: (monthExpenseRes.data ?? []).reduce((acc, r) => acc + Number(r.total), 0),
    pockets,
  };
}

// ---------------------------------------------------------------------------
// Tren bulanan (grafik analitik)
// ---------------------------------------------------------------------------

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
}

/**
 * Ringkasan pendapatan & pengeluaran beberapa bulan terakhir.
 *
 * Dua query rentang penuh lalu diagregasi di memori — jauh lebih murah
 * daripada 2×N query per bulan yang dipakai dashboard lama.
 */
export async function getMonthlyTrend(months = 6, endMonth?: string): Promise<MonthlyTrendPoint[]> {
  const session = await requireFinanceSession();
  const span = Math.min(12, Math.max(1, months));
  const list = lastMonths(span, endMonth ?? currentMonth());
  const empty = list.map((month) => ({ month, income: 0, expense: 0 }));
  if (!session) return empty;

  const start = monthRange(list[0]).start;
  const end = monthRange(list[list.length - 1]).end;

  const supabase = createAdminClient();
  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from("income")
      .select("amount, date")
      .eq("family_id", session.familyId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("shopping_transactions")
      .select("total, date")
      .eq("family_id", session.familyId)
      .gte("date", start)
      .lte("date", end),
  ]);

  const byMonth = new Map(empty.map((point) => [point.month, { ...point }]));
  for (const row of incomeRes.data ?? []) {
    const bucket = byMonth.get(String(row.date).slice(0, 7));
    if (bucket) bucket.income += Number(row.amount);
  }
  for (const row of expenseRes.data ?? []) {
    const bucket = byMonth.get(String(row.date).slice(0, 7));
    if (bucket) bucket.expense += Number(row.total);
  }

  return list.map((month) => byMonth.get(month)!);
}

// ---------------------------------------------------------------------------
// Pocket manager
// ---------------------------------------------------------------------------

export interface CreatePocketInput {
  name: string;
}

export async function createPocket(input: CreatePocketInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama pocket wajib diisi." };

  const supabase = createAdminClient();
  const { data: pocket, error } = await supabase
    .from("pockets")
    .insert({ family_id: session.familyId, name, type: "custom" })
    .select("id")
    .single();

  if (error || !pocket) return { success: false, error: "Gagal membuat pocket." };

  await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "create", null, { name });
  revalidateKeuangan();
  return { success: true };
}

export interface UpdatePocketInput {
  id: string;
  name: string;
}

export async function updatePocket(input: UpdatePocketInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama pocket wajib diisi." };
  if (!isUuid(input.id)) return { success: false, error: "Pocket tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("pockets")
    .select("name")
    .eq("id", input.id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!before) return { success: false, error: "Pocket tidak ditemukan." };

  const { error } = await supabase
    .from("pockets")
    .update({ name })
    .eq("id", input.id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal memperbarui pocket." };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "pocket",
    input.id,
    "update",
    { name: before.name },
    { name }
  );
  revalidateKeuangan();
  return { success: true };
}

export async function deletePocket(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Pocket tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: pocket } = await supabase
    .from("pockets")
    .select("id, name, balance")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!pocket) return { success: false, error: "Pocket tidak ditemukan." };
  if (Number(pocket.balance) > 0) {
    return { success: false, error: "Pindahkan saldo pocket ini ke pocket lain sebelum menghapus." };
  }

  // Pocket "Tabungan {nama anak}" adalah cermin celengan Dunia Anak.
  // Menghapusnya memutus sinkronisasi saldo anak, jadi ditolak walau saldonya
  // sedang nol.
  const childMatch = pocket.name.match(/^Tabungan (.+)$/i);
  if (childMatch) {
    const { data: child } = await supabase
      .from("profiles")
      .select("id")
      .eq("family_id", session.familyId)
      .eq("role", "child")
      .ilike("name", childMatch[1])
      .maybeSingle();

    if (child) {
      return { success: false, error: `"${pocket.name}" dipakai Dunia Anak dan tidak bisa dihapus.` };
    }
  }

  // family_id ikut difilter di DELETE, bukan hanya di SELECT pengecekan.
  const { error } = await supabase.from("pockets").delete().eq("id", id).eq("family_id", session.familyId);
  if (error) return { success: false, error: "Gagal menghapus pocket. Pastikan tidak ada transaksi terkait." };

  await logAudit(supabase, session.familyId, session.profileId, "pocket", id, "delete", { name: pocket.name }, null);
  revalidateKeuangan();
  return { success: true };
}

/** Tarik seluruh saldo pocket dan kembalikan ke Saldo Utama. */
export async function withdrawPocketBalance(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Pocket tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: pocket } = await supabase
    .from("pockets")
    .select("id, name, balance")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!pocket) return { success: false, error: "Pocket tidak ditemukan." };

  const amount = Number(pocket.balance);
  if (amount <= 0) return { success: false, error: "Saldo pocket sudah kosong." };

  const { error } = await supabase.rpc("fin_create_transfer", {
    p_family_id: session.familyId,
    p_from_type: "pocket",
    p_from_pocket: pocket.id,
    p_to_type: "main",
    p_to_pocket: null,
    p_amount: amount,
    p_note: `Tarik saldo pocket "${pocket.name}" ke Saldo Utama`,
    p_created_by: session.profileId,
    p_client_token: null,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal menarik saldo pocket.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "pocket",
    pocket.id,
    "withdraw_to_main",
    { balance: amount },
    { balance: 0 }
  );
  await syncChildSaldoFromPocket(supabase, session.familyId, pocket.name, -amount);

  revalidateKeuangan();
  await revalidateChildSavingsPocket(supabase, session.familyId, pocket.name);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Transfer antar pocket
// ---------------------------------------------------------------------------

export interface TransferPocketInput {
  fromType: "main" | "pocket";
  fromPocketId?: string;
  toType: "main" | "pocket" | "external";
  toPocketId?: string;
  amount: number;
  note?: string;
  clientToken?: string;
}

export async function transferPocket(input: TransferPocketInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const amount = toRupiah(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Nominal harus lebih dari 0." };
  }
  if (input.toType === "external" && !input.note?.trim()) {
    return { success: false, error: "Isi untuk apa transfer ini." };
  }

  const fromPocketId = input.fromType === "pocket" ? input.fromPocketId : undefined;
  const toPocketId = input.toType === "pocket" ? input.toPocketId : undefined;

  if (input.fromType === "pocket" && !isUuid(fromPocketId)) {
    return { success: false, error: "Pilih pocket asal." };
  }
  if (input.toType === "pocket" && !isUuid(toPocketId)) {
    return { success: false, error: "Pilih pocket tujuan." };
  }

  const supabase = createAdminClient();

  // Validasi kepemilikan pocket sebelum menyentuh saldo.
  const pocketIds = [fromPocketId, toPocketId].filter(isUuid);
  const nameById = new Map<string, string>();
  if (pocketIds.length > 0) {
    const { data: owned } = await supabase
      .from("pockets")
      .select("id, name")
      .eq("family_id", session.familyId)
      .in("id", pocketIds);

    for (const p of owned ?? []) nameById.set(p.id, p.name);
    if (nameById.size !== new Set(pocketIds).size) {
      return { success: false, error: "Pocket tidak ditemukan." };
    }
  }

  const { data: transferId, error } = await supabase.rpc("fin_create_transfer", {
    p_family_id: session.familyId,
    p_from_type: input.fromType,
    p_from_pocket: fromPocketId ?? null,
    p_to_type: input.toType,
    p_to_pocket: toPocketId ?? null,
    p_amount: amount,
    p_note: input.note?.trim() || null,
    p_created_by: session.profileId,
    p_client_token: safeToken(input.clientToken),
  });

  if (error) return { success: false, error: rpcError(error, "Gagal membuat transfer.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "pocket_transfer",
    transferId ?? null,
    "create",
    null,
    { amount, fromType: input.fromType, toType: input.toType }
  );

  // Pocket "Tabungan {Nama}" adalah cermin dari celengan anak.
  if (fromPocketId) {
    const name = nameById.get(fromPocketId)!;
    await syncChildSaldoFromPocket(supabase, session.familyId, name, -amount);
    await revalidateChildSavingsPocket(supabase, session.familyId, name);
  }
  if (toPocketId) {
    const name = nameById.get(toPocketId)!;
    await syncChildSaldoFromPocket(supabase, session.familyId, name, amount);
    await revalidateChildSavingsPocket(supabase, session.familyId, name);
  }

  revalidateKeuangan();
  return { success: true };
}

export interface TransferHistoryItem {
  id: string;
  fromLabel: string;
  toLabel: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface TransferHistoryResult {
  items: TransferHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getTransferHistory(page = 1, pageSize = 20): Promise<TransferHistoryResult> {
  const session = await requireFinanceSession();
  if (!session) return { items: [], total: 0, page, pageSize };

  const supabase = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("pocket_transfers")
    .select("id, from_type, from_pocket_id, to_type, to_pocket_id, amount, note, created_at", { count: "exact" })
    .eq("family_id", session.familyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!data || data.length === 0) return { items: [], total: count ?? 0, page, pageSize };

  const pocketIds = new Set<string>();
  for (const row of data) {
    if (row.from_pocket_id) pocketIds.add(row.from_pocket_id);
    if (row.to_pocket_id) pocketIds.add(row.to_pocket_id);
  }

  const { data: pockets } = await supabase
    .from("pockets")
    .select("id, name")
    .eq("family_id", session.familyId)
    .in("id", Array.from(pocketIds));
  const nameMap = new Map((pockets ?? []).map((p) => [p.id, p.name]));

  const items: TransferHistoryItem[] = data.map((row) => ({
    id: row.id,
    fromLabel: row.from_type === "main" ? "Saldo Utama" : nameMap.get(row.from_pocket_id ?? "") ?? "Pocket",
    toLabel:
      row.to_type === "main"
        ? "Saldo Utama"
        : row.to_type === "external"
          ? "Luar Pocket"
          : nameMap.get(row.to_pocket_id ?? "") ?? "Pocket",
    amount: Number(row.amount),
    note: row.note,
    createdAt: row.created_at,
  }));

  return { items, total: count ?? 0, page, pageSize };
}

/**
 * HAPUS RIWAYAT TRANSFER — hanya menghapus record.
 *
 * Perilaku lama mengembalikan nominal ke saldo asal (dan mengurangi tujuan),
 * yang keliru: uang sudah benar-benar berpindah. Fungsi ini SENGAJA tidak
 * menyentuh saldo apa pun; RPC fin_delete_transfer hanya menjalankan DELETE.
 *
 * Untuk benar-benar memindahkan uang kembali, gunakan reverseTransfer() —
 * operasi terpisah yang membuat transaksi pembalik baru.
 */
export async function deletePocketTransfer(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Riwayat transfer tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: transfer } = await supabase
    .from("pocket_transfers")
    .select("id, from_type, from_pocket_id, to_type, to_pocket_id, amount, note, created_at")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!transfer) return { success: false, error: "Riwayat transfer tidak ditemukan." };

  const { error } = await supabase.rpc("fin_delete_transfer", {
    p_transfer_id: id,
    p_family_id: session.familyId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal menghapus riwayat transfer.") };

  // Jejak teknis tetap tersimpan di audit_logs (tidak tampil di riwayat pengguna).
  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "pocket_transfer",
    id,
    "delete_history",
    {
      amount: Number(transfer.amount),
      from_type: transfer.from_type,
      from_pocket_id: transfer.from_pocket_id,
      to_type: transfer.to_type,
      to_pocket_id: transfer.to_pocket_id,
      note: transfer.note,
      created_at: transfer.created_at,
    },
    null
  );

  revalidateKeuangan();
  return { success: true };
}

/** Batalkan transfer — membuat transaksi pembalik. Berbeda dari hapus riwayat. */
export async function reverseTransfer(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Transfer tidak ditemukan." };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("fin_reverse_transfer", {
    p_transfer_id: id,
    p_family_id: session.familyId,
    p_created_by: session.profileId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal membatalkan transfer.") };

  await logAudit(supabase, session.familyId, session.profileId, "pocket_transfer", id, "reverse", null, null);
  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Produk (anti-duplicate + autocomplete)
// ---------------------------------------------------------------------------

export interface ProductSuggestion {
  id: string;
  name: string;
  lastPrice: number;
  avgPrice: number;
  buyCount: number;
}

/**
 * Saran nama barang. Sumbernya digabung dari produk transaksi sebelumnya
 * (tabel products) dan nama barang pada rencana belanja sebelumnya (G.7).
 */
export async function searchProducts(query: string): Promise<ProductSuggestion[]> {
  const session = await requireFinanceSession();
  if (!session) return [];

  const term = query.trim();
  if (term.length < 2) return [];

  const supabase = createAdminClient();

  // Plan item difilter lewat daftar plan milik keluarga ini — bukan join
  // implisit — supaya batas family_id tetap eksplisit.
  const { data: familyPlans } = await supabase
    .from("shopping_plans")
    .select("id")
    .eq("family_id", session.familyId);
  const planIds = (familyPlans ?? []).map((p) => p.id);

  const [productsRes, planItemsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, last_price, avg_price, buy_count")
      .eq("family_id", session.familyId)
      .ilike("name", `%${term}%`)
      .order("buy_count", { ascending: false })
      .limit(8),
    planIds.length > 0
      ? supabase
          .from("shopping_plan_items")
          .select("id, name, estimated_price")
          .in("plan_id", planIds)
          .ilike("name", `%${term}%`)
          .limit(8)
      : Promise.resolve({ data: [] as { id: string; name: string; estimated_price: number }[] }),
  ]);

  const seen = new Set<string>();
  const suggestions: ProductSuggestion[] = [];

  for (const p of productsRes.data ?? []) {
    const key = normalizeProductName(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      id: p.id,
      name: p.name,
      lastPrice: Number(p.last_price),
      avgPrice: Number(p.avg_price),
      buyCount: p.buy_count,
    });
  }

  for (const i of planItemsRes.data ?? []) {
    const key = normalizeProductName(i.name);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      id: i.id,
      name: i.name,
      lastPrice: Number(i.estimated_price),
      avgPrice: Number(i.estimated_price),
      buyCount: 0,
    });
  }

  return suggestions.slice(0, 10);
}
