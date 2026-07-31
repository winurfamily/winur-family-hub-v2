"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireFinanceSession, isUuid } from "@/lib/server/finance-helpers";
import {
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORY_LABELS,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/lib/supabase/types";

export type LedgerKind = "income" | "expense" | "transfer";

export interface LedgerEntry {
  /** "income:<uuid>" dsb. — unik lintas jenis. */
  key: string;
  id: string;
  kind: LedgerKind;
  title: string;
  /** Akun terkait: "Saldo Utama", nama pocket, atau "Saldo Utama → Pocket Belanja". */
  account: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  /** Selalu positif; arah ditentukan oleh `kind`. */
  amount: number;
  date: string;
  note: string | null;
  createdByName: string;
  hasReceipt: boolean;
}

export interface LedgerFilter {
  search?: string;
  kinds?: LedgerKind[];
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  /** "main" atau UUID pocket. */
  account?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
}

export interface LedgerResult {
  entries: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totals: { income: number; expense: number; transfer: number };
}

const ALL_KINDS: LedgerKind[] = ["income", "expense", "transfer"];

/**
 * Riwayat terpadu. Ketiga sumber (pendapatan, belanja, transfer) tersimpan di
 * tabel berbeda tanpa kolom yang seragam, jadi digabungkan di sisi aplikasi:
 * setiap sumber diambil dengan filter yang sama, disatukan, diurutkan, lalu
 * dipotong per halaman. Batas 500 baris per sumber menjaga query tetap ringan;
 * penelusuran lebih jauh dipersempit lewat filter tanggal.
 */
export async function getLedger(filter: LedgerFilter = {}): Promise<LedgerResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filter.pageSize ?? 25));
  const empty: LedgerResult = {
    entries: [],
    total: 0,
    page,
    pageSize,
    totals: { income: 0, expense: 0, transfer: 0 },
  };

  const session = await requireFinanceSession();
  if (!session) return empty;

  const kinds = filter.kinds?.length ? filter.kinds.filter((k) => ALL_KINDS.includes(k)) : ALL_KINDS;
  const search = filter.search?.trim().replace(/[%,]/g, "") ?? "";
  const wantsAccount = filter.account && filter.account !== "all";
  const accountIsMain = filter.account === "main";
  const accountPocketId = isUuid(filter.account) ? filter.account : null;
  const CAP = 500;

  const supabase = createAdminClient();

  const [incomeRows, expenseRows, transferRows, pocketsRes, profilesRes] = await Promise.all([
    kinds.includes("income") ? fetchIncome() : Promise.resolve([]),
    kinds.includes("expense") ? fetchExpense() : Promise.resolve([]),
    kinds.includes("transfer") ? fetchTransfer() : Promise.resolve([]),
    supabase.from("pockets").select("id, name").eq("family_id", session.familyId),
    supabase.from("profiles").select("id, name").eq("family_id", session.familyId),
  ]);

  const pocketNames = new Map((pocketsRes.data ?? []).map((p) => [p.id, p.name]));
  const profileNames = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name]));
  const nameOf = (id: string | null) => (id ? profileNames.get(id) ?? "—" : "—");
  const accountOf = (id: string | null) => (id ? pocketNames.get(id) ?? "Pocket" : "Saldo Utama");

  const expenseIds = expenseRows.map((r) => r.id);
  const { data: receiptRows } =
    expenseIds.length > 0
      ? await supabase
          .from("receipt_attachments")
          .select("transaction_id")
          .eq("family_id", session.familyId)
          .in("transaction_id", expenseIds)
      : { data: [] as { transaction_id: string | null }[] };
  const withReceipt = new Set((receiptRows ?? []).map((r) => r.transaction_id).filter(isUuid));

  const entries: LedgerEntry[] = [
    ...incomeRows.map((r) => ({
      key: `income:${r.id}`,
      id: r.id,
      kind: "income" as const,
      title: r.source,
      account: accountOf(r.pocket_id),
      categoryKey: r.category,
      categoryLabel: INCOME_CATEGORY_LABELS[(r.category ?? "lainnya") as IncomeCategory] ?? "Lainnya",
      amount: Number(r.amount),
      date: r.date,
      note: r.note,
      createdByName: nameOf(r.created_by),
      hasReceipt: false,
    })),
    ...expenseRows.map((r) => ({
      key: `expense:${r.id}`,
      id: r.id,
      kind: "expense" as const,
      title: r.merchant ?? r.name,
      account: accountOf(r.pocket_id),
      categoryKey: r.category,
      categoryLabel:
        EXPENSE_CATEGORY_LABELS[
          EXPENSE_CATEGORY_ALIASES[(r.category ?? "lainnya") as ExpenseCategory] ??
            ((r.category ?? "lainnya") as ExpenseCategory)
        ] ?? "Lainnya",
      amount: Number(r.total),
      date: r.date,
      note: r.note,
      createdByName: nameOf(r.created_by),
      hasReceipt: withReceipt.has(r.id),
    })),
    ...transferRows.map((r) => ({
      key: `transfer:${r.id}`,
      id: r.id,
      kind: "transfer" as const,
      title: r.note || "Transfer dana",
      account: `${r.from_type === "main" ? "Saldo Utama" : accountOf(r.from_pocket_id)} → ${
        r.to_type === "main"
          ? "Saldo Utama"
          : r.to_type === "external"
            ? "Luar Pocket"
            : accountOf(r.to_pocket_id)
      }`,
      categoryKey: null,
      categoryLabel: null,
      amount: Number(r.amount),
      date: String(r.created_at).slice(0, 10),
      note: r.note,
      createdByName: nameOf(r.created_by),
      hasReceipt: false,
    })),
  ].sort((a, b) => (a.date === b.date ? b.key.localeCompare(a.key) : b.date.localeCompare(a.date)));

  const totals = entries.reduce(
    (acc, e) => ({ ...acc, [e.kind]: acc[e.kind] + e.amount }),
    { income: 0, expense: 0, transfer: 0 }
  );

  const from = (page - 1) * pageSize;

  return {
    entries: entries.slice(from, from + pageSize),
    total: entries.length,
    page,
    pageSize,
    totals,
  };

  // --- pengambil per sumber -------------------------------------------

  async function fetchIncome() {
    if (filter.category && filter.category !== "all" && !(filter.category in INCOME_CATEGORY_LABELS)) {
      return [];
    }
    if (wantsAccount && accountPocketId === null && !accountIsMain) return [];

    let q = supabase
      .from("income")
      .select("id, source, amount, date, category, note, pocket_id, created_by")
      .eq("family_id", session!.familyId);

    if (search) q = q.or(`source.ilike.%${search}%,note.ilike.%${search}%`);
    if (filter.dateFrom) q = q.gte("date", filter.dateFrom);
    if (filter.dateTo) q = q.lte("date", filter.dateTo);
    if (filter.category && filter.category !== "all") q = q.eq("category", filter.category);
    if (accountIsMain) q = q.is("pocket_id", null);
    else if (accountPocketId) q = q.eq("pocket_id", accountPocketId);
    if (isUuid(filter.createdBy)) q = q.eq("created_by", filter.createdBy);

    const { data } = await q.order("date", { ascending: false }).limit(CAP);
    return data ?? [];
  }

  async function fetchExpense() {
    if (filter.category && filter.category !== "all" && !(filter.category in EXPENSE_CATEGORY_LABELS)) {
      return [];
    }
    if (wantsAccount && accountPocketId === null && !accountIsMain) return [];

    let q = supabase
      .from("shopping_transactions")
      .select("id, merchant, name, total, date, category, note, pocket_id, created_by")
      .eq("family_id", session!.familyId);

    if (search) q = q.or(`merchant.ilike.%${search}%,name.ilike.%${search}%,note.ilike.%${search}%`);
    if (filter.dateFrom) q = q.gte("date", filter.dateFrom);
    if (filter.dateTo) q = q.lte("date", filter.dateTo);
    if (filter.category && filter.category !== "all") q = q.eq("category", filter.category);
    if (accountIsMain) q = q.is("pocket_id", null);
    else if (accountPocketId) q = q.eq("pocket_id", accountPocketId);
    if (isUuid(filter.createdBy)) q = q.eq("created_by", filter.createdBy);

    const { data } = await q.order("date", { ascending: false }).limit(CAP);
    return data ?? [];
  }

  async function fetchTransfer() {
    // Transfer tidak berkategori, jadi otomatis kosong bila filter kategori aktif.
    if (filter.category && filter.category !== "all") return [];

    let q = supabase
      .from("pocket_transfers")
      .select("id, from_type, from_pocket_id, to_type, to_pocket_id, amount, note, created_at, created_by")
      .eq("family_id", session!.familyId);

    if (search) q = q.ilike("note", `%${search}%`);
    if (filter.dateFrom) q = q.gte("created_at", `${filter.dateFrom}T00:00:00Z`);
    if (filter.dateTo) q = q.lte("created_at", `${filter.dateTo}T23:59:59Z`);
    if (isUuid(filter.createdBy)) q = q.eq("created_by", filter.createdBy);
    if (accountPocketId) {
      q = q.or(`from_pocket_id.eq.${accountPocketId},to_pocket_id.eq.${accountPocketId}`);
    } else if (accountIsMain) {
      q = q.or("from_type.eq.main,to_type.eq.main");
    }

    const { data } = await q.order("created_at", { ascending: false }).limit(CAP);
    return data ?? [];
  }
}

const KIND_LABELS: Record<LedgerKind, string> = {
  income: "Pendapatan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

/** Escape sesuai RFC 4180 supaya koma/kutip di catatan tidak merusak kolom. */
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Export riwayat terfilter ke CSV (H.13). Dikembalikan sebagai string ke client. */
export async function exportLedgerCsv(filter: LedgerFilter = {}): Promise<string> {
  const result = await getLedger({ ...filter, page: 1, pageSize: 100 });
  if (result.total === 0) return "";

  const pages = Math.ceil(result.total / 100);
  const all: LedgerEntry[] = [...result.entries];
  for (let p = 2; p <= pages; p++) {
    const next = await getLedger({ ...filter, page: p, pageSize: 100 });
    all.push(...next.entries);
  }

  const header = ["Tanggal", "Jenis", "Keterangan", "Akun", "Kategori", "Nominal", "Catatan", "Dibuat oleh"];
  const rows = all.map((e) =>
    [
      e.date,
      KIND_LABELS[e.kind],
      e.title,
      e.account,
      e.categoryLabel ?? "",
      // Pengeluaran diberi tanda negatif agar langsung bisa dijumlahkan di spreadsheet.
      e.kind === "expense" ? -e.amount : e.amount,
      e.note ?? "",
      e.createdByName,
    ]
      .map(csvCell)
      .join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}
