"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/app/actions/auth";
import { normalizeProductName, currentMonth, monthRange, sumBy } from "@/lib/finance";
import { formatRupiah } from "@/lib/format";
import type { PocketType, ShoppingTransactionSource } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

async function logAudit(
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

function revalidateKeuangan() {
  revalidatePath("/admin/keuangan");
  revalidatePath("/admin/keuangan/pockets");
  revalidatePath("/admin/keuangan/transfer");
  revalidatePath("/admin/keuangan/belanja");
}

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
// Dashboard
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
  totalIncome: number;
  totalExpenseThisMonth: number;
  pockets: PocketSummary[];
}

export async function getFinanceSummary(): Promise<FinanceSummary | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { start, end } = monthRange(currentMonth());

  const [pocketsRes, incomeRes, mainTransfersOutRes, mainTransfersInRes, directExpenseRes, monthExpenseRes, pocketExpenseRes] = await Promise.all([
    supabase
      .from("pockets")
      .select("id, name, type, balance")
      .eq("family_id", session.familyId)
      .order("created_at", { ascending: true }),
    supabase.from("income").select("amount").eq("family_id", session.familyId),
    supabase.from("pocket_transfers").select("amount").eq("family_id", session.familyId).eq("from_type", "main"),
    supabase.from("pocket_transfers").select("amount").eq("family_id", session.familyId).eq("to_type", "main"),
    supabase.from("shopping_transactions").select("total").eq("family_id", session.familyId).is("pocket_id", null),
    supabase
      .from("shopping_transactions")
      .select("total")
      .eq("family_id", session.familyId)
      .gte("date", start)
      .lte("date", end),
    supabase.from("shopping_transactions").select("pocket_id, total").eq("family_id", session.familyId).not("pocket_id", "is", null),
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

  const totalIncome = sumBy(incomeRes.data, "amount");
  const totalDistributed = sumBy(mainTransfersOutRes.data, "amount");
  const totalReturnedToMain = sumBy(mainTransfersInRes.data, "amount");
  const totalDirectExpense = sumBy(directExpenseRes.data, "total");

  return {
    saldoUtama: totalIncome - totalDistributed + totalReturnedToMain - totalDirectExpense,
    totalIncome,
    totalExpenseThisMonth: sumBy(monthExpenseRes.data, "total"),
    pockets,
  };
}

// ---------------------------------------------------------------------------
// Pendapatan (income) + auto-split ke pocket
// ---------------------------------------------------------------------------

export interface IncomeHistoryItem {
  id: string;
  source: string;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export async function getIncomeHistory(limit = 10): Promise<IncomeHistoryItem[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("income")
    .select("id, source, amount, date, note, created_at")
    .eq("family_id", session.familyId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    amount: Number(row.amount),
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export interface AddIncomeInput {
  source: string;
  amount: number;
  date: string;
  note?: string;
}

export async function addIncome(input: AddIncomeInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const source = input.source.trim();
  if (!source) return { success: false, error: "Sumber pendapatan wajib diisi." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Nominal harus lebih dari 0." };
  }

  const supabase = createAdminClient();

  const { data: income, error } = await supabase
    .from("income")
    .insert({
      family_id: session.familyId,
      source,
      amount: input.amount,
      date: input.date,
      note: input.note?.trim() || null,
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !income) return { success: false, error: "Gagal menyimpan pendapatan." };

  await logAudit(supabase, session.familyId, session.profileId, "income", income.id, "create", null, {
    source,
    amount: input.amount,
    date: input.date,
  });

  revalidateKeuangan();
  return { success: true };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: income } = await supabase
    .from("income")
    .select("id, source, amount, date")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!income) return { success: false, error: "Pendapatan tidak ditemukan." };

  // Batalkan auto-split yang dibuat saat pendapatan ini dicatat
  const { data: splits } = await supabase
    .from("pocket_transfers")
    .select("id, to_pocket_id, amount")
    .eq("family_id", session.familyId)
    .eq("income_id", id);

  for (const split of splits ?? []) {
    if (!split.to_pocket_id) continue;

    const { data: pocket } = await supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("id", split.to_pocket_id)
      .maybeSingle();

    if (!pocket) continue;

    const balanceBefore = Number(pocket.balance);
    const balanceAfter = Math.max(0, balanceBefore - Number(split.amount));
    await supabase.from("pockets").update({ balance: balanceAfter }).eq("id", pocket.id);

    await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "auto_split_revert", {
      balance: balanceBefore,
    }, { balance: balanceAfter });

    await revalidateChildSavingsPocket(supabase, session.familyId, pocket.name);
  }

  if (splits && splits.length > 0) {
    await supabase.from("pocket_transfers").delete().eq("income_id", id);
  }

  const { error } = await supabase.from("income").delete().eq("id", id).eq("family_id", session.familyId);
  if (error) return { success: false, error: "Gagal menghapus pendapatan." };

  await logAudit(supabase, session.familyId, session.profileId, "income", id, "delete", {
    source: income.source,
    amount: Number(income.amount),
    date: income.date,
  }, null);

  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Pocket manager
// ---------------------------------------------------------------------------

export interface CreatePocketInput {
  name: string;
}

export async function createPocket(input: CreatePocketInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama pocket wajib diisi." };

  const supabase = createAdminClient();

  const { data: pocket, error } = await supabase
    .from("pockets")
    .insert({
      family_id: session.familyId,
      name,
      type: "custom",
    })
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
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama pocket wajib diisi." };

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

  await logAudit(supabase, session.familyId, session.profileId, "pocket", input.id, "update", { name: before.name }, { name });

  revalidateKeuangan();
  return { success: true };
}

export async function deletePocket(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

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

  const { error } = await supabase.from("pockets").delete().eq("id", id);
  if (error) return { success: false, error: "Gagal menghapus pocket." };

  await logAudit(supabase, session.familyId, session.profileId, "pocket", id, "delete", { name: pocket.name }, null);

  revalidateKeuangan();
  return { success: true };
}

/** Tarik seluruh saldo pocket dan kembalikan ke Saldo Utama. */
export async function withdrawPocketBalance(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

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

  const { error } = await supabase.from("pocket_transfers").insert({
    family_id: session.familyId,
    from_type: "pocket",
    from_pocket_id: pocket.id,
    to_type: "main",
    amount,
    note: `Tarik saldo pocket "${pocket.name}" ke Saldo Utama`,
    created_by: session.profileId,
  });

  if (error) return { success: false, error: "Gagal menarik saldo pocket." };

  await supabase.from("pockets").update({ balance: 0 }).eq("id", pocket.id);

  await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "withdraw_to_main", {
    balance: amount,
  }, { balance: 0 });

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
  toType: "pocket" | "external";
  toPocketId?: string;
  amount: number;
  note?: string;
}

export async function transferPocket(input: TransferPocketInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Nominal harus lebih dari 0." };
  }
  if (input.toType === "external" && !input.note?.trim()) {
    return { success: false, error: "Isi untuk apa transfer ini." };
  }
  if (input.toType === "pocket" && !input.toPocketId) {
    return { success: false, error: "Pilih pocket tujuan." };
  }
  if (
    input.toType === "pocket" &&
    input.fromType === "pocket" &&
    (!input.fromPocketId || input.fromPocketId === input.toPocketId)
  ) {
    return { success: false, error: "Pocket asal dan tujuan tidak boleh sama." };
  }

  const supabase = createAdminClient();

  let fromPocket: { id: string; name: string; balance: number } | null = null;
  if (input.fromType === "pocket") {
    const { data } = await supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("id", input.fromPocketId!)
      .eq("family_id", session.familyId)
      .maybeSingle();

    if (!data) return { success: false, error: "Pocket asal tidak ditemukan." };
    if (Number(data.balance) < input.amount) {
      return { success: false, error: `Saldo pocket asal tidak cukup (tersisa ${formatRupiah(Number(data.balance))}).` };
    }
    fromPocket = { id: data.id, name: data.name, balance: Number(data.balance) };
  } else {
    const summary = await getFinanceSummary();
    if (!summary || summary.saldoUtama < input.amount) {
      return { success: false, error: "Saldo utama tidak cukup." };
    }
  }

  let toPocket: { id: string; name: string; balance: number } | null = null;
  if (input.toType === "pocket") {
    const { data: toPocketData } = await supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("id", input.toPocketId!)
      .eq("family_id", session.familyId)
      .maybeSingle();

    if (!toPocketData) return { success: false, error: "Pocket tujuan tidak ditemukan." };
    toPocket = { id: toPocketData.id, name: toPocketData.name, balance: Number(toPocketData.balance) };
  }

  const { data: transfer, error } = await supabase
    .from("pocket_transfers")
    .insert({
      family_id: session.familyId,
      from_type: input.fromType,
      from_pocket_id: input.fromType === "pocket" ? input.fromPocketId : null,
      to_type: input.toType,
      to_pocket_id: input.toType === "pocket" ? input.toPocketId : null,
      amount: input.amount,
      note: input.note?.trim() || null,
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !transfer) return { success: false, error: "Gagal membuat transfer." };

  if (fromPocket) {
    const newBalance = fromPocket.balance - input.amount;
    await supabase.from("pockets").update({ balance: newBalance }).eq("id", fromPocket.id);
    await logAudit(supabase, session.familyId, session.profileId, "pocket", fromPocket.id, "transfer_out", {
      balance: fromPocket.balance,
    }, { balance: newBalance });
  }

  if (toPocket) {
    const newToBalance = toPocket.balance + input.amount;
    await supabase.from("pockets").update({ balance: newToBalance }).eq("id", toPocket.id);
    await logAudit(supabase, session.familyId, session.profileId, "pocket", toPocket.id, "transfer_in", {
      balance: toPocket.balance,
    }, { balance: newToBalance });
  }

  revalidateKeuangan();
  if (fromPocket) await revalidateChildSavingsPocket(supabase, session.familyId, fromPocket.name);
  if (toPocket) await revalidateChildSavingsPocket(supabase, session.familyId, toPocket.name);
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
  const session = await getCurrentSession();
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

  const { data: pockets } = await supabase.from("pockets").select("id, name").in("id", Array.from(pocketIds));
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

/** Hapus riwayat transfer & kembalikan saldo pocket terkait seperti sebelum transfer terjadi. */
export async function deletePocketTransfer(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: transfer } = await supabase
    .from("pocket_transfers")
    .select("id, from_type, from_pocket_id, to_type, to_pocket_id, amount")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!transfer) return { success: false, error: "Riwayat transfer tidak ditemukan." };

  const amount = Number(transfer.amount);

  if (transfer.from_type === "pocket" && transfer.from_pocket_id) {
    const { data: pocket } = await supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("id", transfer.from_pocket_id)
      .maybeSingle();

    if (pocket) {
      const balanceBefore = Number(pocket.balance);
      const balanceAfter = balanceBefore + amount;
      await supabase.from("pockets").update({ balance: balanceAfter }).eq("id", pocket.id);
      await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "transfer_delete_revert", {
        balance: balanceBefore,
      }, { balance: balanceAfter });
      await revalidateChildSavingsPocket(supabase, session.familyId, pocket.name);
    }
  }

  if (transfer.to_type === "pocket" && transfer.to_pocket_id) {
    const { data: pocket } = await supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("id", transfer.to_pocket_id)
      .maybeSingle();

    if (pocket) {
      const balanceBefore = Number(pocket.balance);
      const balanceAfter = Math.max(0, balanceBefore - amount);
      await supabase.from("pockets").update({ balance: balanceAfter }).eq("id", pocket.id);
      await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "transfer_delete_revert", {
        balance: balanceBefore,
      }, { balance: balanceAfter });
      await revalidateChildSavingsPocket(supabase, session.familyId, pocket.name);
    }
  }

  const { error } = await supabase.from("pocket_transfers").delete().eq("id", id).eq("family_id", session.familyId);
  if (error) return { success: false, error: "Gagal menghapus riwayat transfer." };

  await logAudit(supabase, session.familyId, session.profileId, "pocket_transfer", id, "delete", { amount }, null);

  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Produk anti-duplicate
// ---------------------------------------------------------------------------

async function resolveProduct(supabase: AdminClient, familyId: string, name: string, price: number): Promise<string | null> {
  const normalized = normalizeProductName(name);

  const { data: existing } = await supabase
    .from("products")
    .select("id, last_price, avg_price, buy_count")
    .eq("family_id", familyId)
    .eq("name_normalized", normalized)
    .maybeSingle();

  if (existing) {
    const buyCount = existing.buy_count + 1;
    const avgPrice = (Number(existing.avg_price) * existing.buy_count + price) / buyCount;
    await supabase
      .from("products")
      .update({ last_price: price, avg_price: avgPrice, buy_count: buyCount, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from("products")
    .insert({
      family_id: familyId,
      name: name.trim(),
      name_normalized: normalized,
      last_price: price,
      avg_price: price,
      buy_count: 1,
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

export interface ProductSuggestion {
  id: string;
  name: string;
  lastPrice: number;
  avgPrice: number;
  buyCount: number;
}

export async function searchProducts(query: string): Promise<ProductSuggestion[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  if (!query.trim()) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, last_price, avg_price, buy_count")
    .eq("family_id", session.familyId)
    .ilike("name", `%${query.trim()}%`)
    .order("buy_count", { ascending: false })
    .limit(8);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    lastPrice: Number(p.last_price),
    avgPrice: Number(p.avg_price),
    buyCount: p.buy_count,
  }));
}

// ---------------------------------------------------------------------------
// Belanja: manual / scan
// ---------------------------------------------------------------------------

export interface AddShoppingTransactionInput {
  name: string;
  qty: number;
  price: number;
  date: string;
  pocketId: string | null;
  source?: ShoppingTransactionSource;
}

export async function addShoppingTransaction(input: AddShoppingTransactionInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama barang wajib diisi." };
  if (!Number.isFinite(input.qty) || input.qty <= 0) return { success: false, error: "Qty tidak valid." };
  if (!Number.isFinite(input.price) || input.price < 0) return { success: false, error: "Harga tidak valid." };

  const supabase = createAdminClient();
  const total = Math.round(input.qty * input.price);

  let pocket: { id: string; balance: number } | null = null;
  if (input.pocketId) {
    const { data } = await supabase
      .from("pockets")
      .select("id, balance")
      .eq("id", input.pocketId)
      .eq("family_id", session.familyId)
      .maybeSingle();

    if (!data) return { success: false, error: "Pocket tidak ditemukan." };
    if (Number(data.balance) < total) {
      return { success: false, error: `Saldo pocket tidak cukup (tersisa ${formatRupiah(Number(data.balance))}).` };
    }
    pocket = { id: data.id, balance: Number(data.balance) };
  }

  const productId = await resolveProduct(supabase, session.familyId, name, input.price);

  const { error } = await supabase.from("shopping_transactions").insert({
    family_id: session.familyId,
    plan_id: null,
    pocket_id: input.pocketId,
    product_id: productId,
    name,
    qty: input.qty,
    price: input.price,
    total,
    date: input.date,
    source: input.source ?? "manual",
    created_by: session.profileId,
  });

  if (error) return { success: false, error: "Gagal menyimpan transaksi belanja." };

  if (pocket) {
    const newBalance = pocket.balance - total;
    await supabase.from("pockets").update({ balance: newBalance }).eq("id", pocket.id);
    await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "shopping_expense", {
      balance: pocket.balance,
    }, { balance: newBalance });
  }

  revalidateKeuangan();
  return { success: true };
}

export interface AddShoppingTransactionsBatchInput {
  pocketId: string | null;
  date: string;
  source: ShoppingTransactionSource;
  items: { name: string; qty: number; price: number }[];
}

export async function addShoppingTransactionsBatch(input: AddShoppingTransactionsBatchInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const items = input.items
    .map((item) => ({ name: item.name.trim(), qty: Number(item.qty) || 1, price: Number(item.price) || 0 }))
    .filter((item) => item.name.length > 0);

  if (items.length === 0) return { success: false, error: "Tidak ada item untuk disimpan." };

  const total = items.reduce((acc, item) => acc + Math.round(item.qty * item.price), 0);

  const supabase = createAdminClient();

  let pocket: { id: string; balance: number } | null = null;
  if (input.pocketId) {
    const { data } = await supabase
      .from("pockets")
      .select("id, balance")
      .eq("id", input.pocketId)
      .eq("family_id", session.familyId)
      .maybeSingle();

    if (!data) return { success: false, error: "Pocket tidak ditemukan." };
    if (Number(data.balance) < total) {
      return { success: false, error: `Saldo pocket tidak cukup (tersisa ${formatRupiah(Number(data.balance))}).` };
    }
    pocket = { id: data.id, balance: Number(data.balance) };
  }

  for (const item of items) {
    const productId = await resolveProduct(supabase, session.familyId, item.name, item.price);
    await supabase.from("shopping_transactions").insert({
      family_id: session.familyId,
      plan_id: null,
      pocket_id: input.pocketId,
      product_id: productId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      total: Math.round(item.qty * item.price),
      date: input.date,
      source: input.source,
      created_by: session.profileId,
    });
  }

  if (pocket) {
    const newBalance = pocket.balance - total;
    await supabase.from("pockets").update({ balance: newBalance }).eq("id", pocket.id);
    await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "shopping_expense", {
      balance: pocket.balance,
    }, { balance: newBalance });
  }

  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Riwayat belanja per bulan
// ---------------------------------------------------------------------------

export interface ShoppingHistoryItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  date: string;
  source: ShoppingTransactionSource;
  pocketName: string | null;
}

export interface ShoppingHistoryResult {
  items: ShoppingHistoryItem[];
  total: number;
}

export async function getShoppingHistory(month?: string): Promise<ShoppingHistoryResult> {
  const session = await getCurrentSession();
  if (!session) return { items: [], total: 0 };

  const targetMonth = month ?? currentMonth();
  const { start, end } = monthRange(targetMonth);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shopping_transactions")
    .select("id, name, qty, price, total, date, source, pocket_id")
    .eq("family_id", session.familyId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return { items: [], total: 0 };

  const pocketIds = Array.from(new Set(data.map((d) => d.pocket_id).filter((id): id is string => Boolean(id))));
  const { data: pockets } =
    pocketIds.length > 0 ? await supabase.from("pockets").select("id, name").in("id", pocketIds) : { data: [] };
  const nameMap = new Map((pockets ?? []).map((p) => [p.id, p.name]));

  const items: ShoppingHistoryItem[] = data.map((d) => ({
    id: d.id,
    name: d.name,
    qty: d.qty,
    price: Number(d.price),
    total: Number(d.total),
    date: d.date,
    source: d.source,
    pocketName: d.pocket_id ? nameMap.get(d.pocket_id) ?? null : null,
  }));

  return { items, total: items.reduce((acc, i) => acc + i.total, 0) };
}

// ---------------------------------------------------------------------------
// Rencana belanja + checklist
// ---------------------------------------------------------------------------

export interface ShoppingPlanItem {
  id: string;
  name: string;
  qty: number;
  estimatedPrice: number;
  actualPrice: number | null;
  checked: boolean;
}

export interface ShoppingPlanWithItems {
  id: string;
  name: string;
  plannedDate: string | null;
  status: string;
  totalEstimated: number;
  totalActual: number;
  items: ShoppingPlanItem[];
}

export async function getShoppingPlans(): Promise<ShoppingPlanWithItems[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data: plans } = await supabase
    .from("shopping_plans")
    .select("id, name, planned_date, status, total_estimated, total_actual")
    .eq("family_id", session.familyId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (!plans || plans.length === 0) return [];

  const { data: items } = await supabase
    .from("shopping_plan_items")
    .select("id, plan_id, name, qty, estimated_price, actual_price, checked")
    .in("plan_id", plans.map((p) => p.id))
    .order("created_at", { ascending: true });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    plannedDate: p.planned_date,
    status: p.status,
    totalEstimated: Number(p.total_estimated),
    totalActual: Number(p.total_actual),
    items: (items ?? [])
      .filter((i) => i.plan_id === p.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        estimatedPrice: Number(i.estimated_price),
        actualPrice: i.actual_price !== null ? Number(i.actual_price) : null,
        checked: i.checked,
      })),
  }));
}

export interface CreateShoppingPlanInput {
  name: string;
  plannedDate?: string;
}

export async function createShoppingPlan(input: CreateShoppingPlanInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama rencana wajib diisi." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("shopping_plans").insert({
    family_id: session.familyId,
    name,
    planned_date: input.plannedDate || null,
    created_by: session.profileId,
  });

  if (error) return { success: false, error: "Gagal membuat rencana belanja." };

  revalidateKeuangan();
  return { success: true };
}

export interface AddPlanItemInput {
  planId: string;
  name: string;
  qty: number;
  estimatedPrice: number;
}

async function recalcPlanTotals(supabase: AdminClient, planId: string) {
  const { data: items } = await supabase
    .from("shopping_plan_items")
    .select("qty, estimated_price, actual_price")
    .eq("plan_id", planId);

  const totalEstimated = (items ?? []).reduce((acc, i) => acc + Number(i.estimated_price) * i.qty, 0);
  const totalActual = (items ?? []).reduce(
    (acc, i) => acc + (i.actual_price !== null ? Number(i.actual_price) * i.qty : 0),
    0
  );

  await supabase.from("shopping_plans").update({ total_estimated: totalEstimated, total_actual: totalActual }).eq("id", planId);
}

export async function addPlanItem(input: AddPlanItemInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nama barang wajib diisi." };
  if (!Number.isFinite(input.qty) || input.qty <= 0) return { success: false, error: "Qty tidak valid." };
  if (!Number.isFinite(input.estimatedPrice) || input.estimatedPrice < 0) {
    return { success: false, error: "Estimasi harga tidak valid." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("shopping_plan_items").insert({
    plan_id: input.planId,
    name,
    qty: input.qty,
    estimated_price: input.estimatedPrice,
  });

  if (error) return { success: false, error: "Gagal menambah barang." };

  await recalcPlanTotals(supabase, input.planId);
  revalidateKeuangan();
  return { success: true };
}

export async function togglePlanItem(itemId: string, checked: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("shopping_plan_items").update({ checked }).eq("id", itemId);
  if (error) return { success: false, error: "Gagal memperbarui item." };

  revalidateKeuangan();
  return { success: true };
}

export async function deletePlanItem(itemId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: item } = await supabase.from("shopping_plan_items").select("plan_id").eq("id", itemId).maybeSingle();
  if (!item) return { success: false, error: "Item tidak ditemukan." };

  const { error } = await supabase.from("shopping_plan_items").delete().eq("id", itemId);
  if (error) return { success: false, error: "Gagal menghapus item." };

  await recalcPlanTotals(supabase, item.plan_id);
  revalidateKeuangan();
  return { success: true };
}

export interface CheckoutPlanItemInput {
  itemId: string;
  actualPrice: number;
  pocketId: string | null;
  date: string;
}

export async function checkoutPlanItem(input: CheckoutPlanItemInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!Number.isFinite(input.actualPrice) || input.actualPrice < 0) {
    return { success: false, error: "Harga aktual tidak valid." };
  }

  const supabase = createAdminClient();
  const { data: item } = await supabase
    .from("shopping_plan_items")
    .select("id, plan_id, name, qty")
    .eq("id", input.itemId)
    .maybeSingle();

  if (!item) return { success: false, error: "Item tidak ditemukan." };

  const total = Math.round(item.qty * input.actualPrice);

  let pocket: { id: string; balance: number } | null = null;
  if (input.pocketId) {
    const { data } = await supabase
      .from("pockets")
      .select("id, balance")
      .eq("id", input.pocketId)
      .eq("family_id", session.familyId)
      .maybeSingle();

    if (!data) return { success: false, error: "Pocket tidak ditemukan." };
    if (Number(data.balance) < total) {
      return { success: false, error: `Saldo pocket tidak cukup (tersisa ${formatRupiah(Number(data.balance))}).` };
    }
    pocket = { id: data.id, balance: Number(data.balance) };
  }

  const productId = await resolveProduct(supabase, session.familyId, item.name, input.actualPrice);

  const { error: trxError } = await supabase.from("shopping_transactions").insert({
    family_id: session.familyId,
    plan_id: item.plan_id,
    pocket_id: input.pocketId,
    product_id: productId,
    name: item.name,
    qty: item.qty,
    price: input.actualPrice,
    total,
    date: input.date,
    source: "plan",
    created_by: session.profileId,
  });

  if (trxError) return { success: false, error: "Gagal mencatat transaksi belanja." };

  if (pocket) {
    const newBalance = pocket.balance - total;
    await supabase.from("pockets").update({ balance: newBalance }).eq("id", pocket.id);
    await logAudit(supabase, session.familyId, session.profileId, "pocket", pocket.id, "shopping_expense", {
      balance: pocket.balance,
    }, { balance: newBalance });
  }

  await supabase.from("shopping_plan_items").update({ checked: true, actual_price: input.actualPrice }).eq("id", input.itemId);
  await recalcPlanTotals(supabase, item.plan_id);

  const { data: items } = await supabase.from("shopping_plan_items").select("checked").eq("plan_id", item.plan_id);
  if (items && items.length > 0 && items.every((i) => i.checked)) {
    await supabase.from("shopping_plans").update({ status: "done" }).eq("id", item.plan_id);
  }

  revalidateKeuangan();
  return { success: true };
}

export async function archivePlan(planId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("shopping_plans")
    .update({ status: "archived" })
    .eq("id", planId)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal mengarsipkan rencana." };

  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// AI Receipt Scan (GPT-4o Vision)
// ---------------------------------------------------------------------------

export interface ScannedItem {
  name: string;
  qty: number;
  price: number;
}

export interface ScanReceiptResult {
  success: boolean;
  error?: string;
  storeName?: string;
  date?: string;
  items?: ScannedItem[];
  total?: number;
}

export async function scanReceipt(imageBase64: string, mode: "quick" | "full"): Promise<ScanReceiptResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY belum diisi di .env.local. Tambahkan API key untuk mengaktifkan fitur scan AI.",
    };
  }

  if (!imageBase64.startsWith("data:image")) {
    return { success: false, error: "Format gambar tidak valid." };
  }

  const prompt =
    mode === "quick"
      ? 'Kamu adalah asisten yang membaca foto struk belanja. Baca foto ini dan kembalikan HANYA JSON dengan format: {"storeName": string, "date": "YYYY-MM-DD", "total": number}. "total" adalah total belanja dalam Rupiah (angka saja, tanpa titik/koma/simbol). Jika tanggal tidak terbaca, gunakan tanggal hari ini.'
      : 'Kamu adalah asisten yang membaca foto struk belanja. Baca foto ini dan kembalikan HANYA JSON dengan format: {"storeName": string, "date": "YYYY-MM-DD", "items": [{"name": string, "qty": number, "price": number}], "total": number}. "price" adalah harga satuan dalam Rupiah (angka saja, tanpa titik/koma/simbol). Jika tanggal tidak terbaca, gunakan tanggal hari ini.';

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { success: false, error: "AI tidak memberikan respons." };

    const parsed = JSON.parse(raw) as {
      storeName?: string;
      date?: string;
      total?: number;
      items?: { name?: string; qty?: number; price?: number }[];
    };

    if (mode === "quick") {
      return {
        success: true,
        storeName: parsed.storeName,
        date: parsed.date,
        total: Number(parsed.total) || 0,
      };
    }

    const items: ScannedItem[] = Array.isArray(parsed.items)
      ? parsed.items.map((i) => ({
          name: String(i.name ?? "").trim() || "Item",
          qty: Number(i.qty) || 1,
          price: Number(i.price) || 0,
        }))
      : [];

    return {
      success: true,
      storeName: parsed.storeName,
      date: parsed.date,
      items,
      total: Number(parsed.total) || items.reduce((acc, i) => acc + i.qty * i.price, 0),
    };
  } catch (err) {
    console.error("scanReceipt error", err);
    return { success: false, error: "Gagal membaca struk. Coba foto ulang dengan pencahayaan lebih baik." };
  }
}
