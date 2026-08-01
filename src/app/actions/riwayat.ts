"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireFinanceSession,
  isUuid,
  isMissingSchema,
  type AdminClient,
} from "@/lib/server/finance-helpers";
import { parseSearchQuery, sanitizeSearchTerm } from "@/lib/search-query";
import { todayISODate } from "@/lib/format";
import {
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORY_LABELS,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/lib/supabase/types";

export type LedgerKind = "income" | "expense" | "transfer" | "adjustment";

/** Urutan hasil pencarian. */
export type LedgerSort = "newest" | "oldest" | "largest" | "smallest";

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
  /** Selalu positif; arahnya dibaca dari `direction`. */
  amount: number;
  /**
   * Arah uang. Untuk pendapatan/pengeluaran selalu tetap, tetapi penyesuaian
   * saldo bisa menambah ATAU mengurangi — jadi arah tidak boleh disimpulkan
   * dari `kind` saja seperti sebelumnya.
   */
  direction: "in" | "out" | "neutral";
  date: string;
  note: string | null;
  createdByName: string;
  hasReceipt: boolean;
  /** Nama barang di dalam transaksi yang cocok dengan pencarian. */
  matchedItems?: string[];
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
  sort?: LedgerSort;
  page?: number;
  pageSize?: number;
}

export interface LedgerResult {
  entries: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totals: { income: number; expense: number; transfer: number; adjustment: number };
  /**
   * Sisa kata kunci setelah nominal & tanggal diangkat — dipakai UI untuk
   * menyorot kata yang cocok, sehingga sorotan tidak salah menandai "50rb".
   */
  searchText: string;
  /** Ringkasan apa yang sedang dicari, mis. ["bulan agustus 2026"]. */
  searchHints: string[];
}

const ALL_KINDS: LedgerKind[] = ["income", "expense", "transfer", "adjustment"];

/** Batas baris per sumber. Penelusuran lebih jauh dipersempit lewat filter. */
const CAP = 500;

/**
 * Riwayat terpadu + pencarian.
 *
 * Keempat sumber (pendapatan, belanja, transfer, penyesuaian) tersimpan di
 * tabel berbeda tanpa kolom yang seragam, jadi digabungkan di sisi aplikasi:
 * setiap sumber diambil dengan filter yang sama, disatukan, diurutkan, lalu
 * dipotong per halaman.
 *
 * Pencarian sengaja melebar jauh dari sekadar "judul mengandung kata":
 * satu kotak yang sama menerima nama transaksi, nama toko, NAMA BARANG di
 * dalam struk, kategori, catatan, nominal ("50rb"), bulan ("agustus"),
 * nama pencatat, dan nama sumber dana. Alasannya sederhana — orang mencari
 * "beras" atau "50rb", bukan "pengeluaran kategori makanan di Indomaret".
 * Kata kunci diurai lebih dulu oleh `parseSearchQuery` sehingga bagian yang
 * jelas berupa nominal/tanggal menjadi filter sungguhan, bukan teks.
 */
export async function getLedger(filter: LedgerFilter = {}): Promise<LedgerResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filter.pageSize ?? 25));
  const empty: LedgerResult = {
    entries: [],
    total: 0,
    page,
    pageSize,
    totals: { income: 0, expense: 0, transfer: 0, adjustment: 0 },
    searchText: "",
    searchHints: [],
  };

  const session = await requireFinanceSession();
  if (!session) return empty;

  const kinds = filter.kinds?.length ? filter.kinds.filter((k) => ALL_KINDS.includes(k)) : ALL_KINDS;
  const sort: LedgerSort = filter.sort ?? "newest";

  const parsed = parseSearchQuery(filter.search ?? "", todayISODate());
  const search = sanitizeSearchTerm(parsed.text);
  const like = `%${search}%`;

  // Tanggal dari kata kunci mempersempit filter periode yang sedang aktif —
  // mengetik "agustus" saat cakupan "bulan ini" tidak boleh diam-diam
  // melebarkan rentang kembali.
  const dateFrom = maxDate(filter.dateFrom, parsed.dateFrom);
  const dateTo = minDate(filter.dateTo, parsed.dateTo);

  const amountLo =
    parsed.amount !== undefined ? Math.max(0, parsed.amount - (parsed.amountTolerance ?? 0)) : undefined;
  const amountHi =
    parsed.amount !== undefined ? parsed.amount + (parsed.amountTolerance ?? 0) : undefined;

  const wantsAccount = Boolean(filter.account && filter.account !== "all");
  const accountIsMain = filter.account === "main";
  const accountPocketId = isUuid(filter.account) ? filter.account : null;

  const supabase = createAdminClient();

  // Nama pocket & profil diambil lebih dulu: keduanya dipakai untuk MEMBANGUN
  // query (mencari "mamah" atau "pocket belanja") sekaligus memberi label
  // pada hasilnya, jadi mengambilnya dua kali tidak ada gunanya.
  const [pocketsRes, profilesRes] = await Promise.all([
    supabase.from("pockets").select("id, name").eq("family_id", session.familyId),
    supabase.from("profiles").select("id, name").eq("family_id", session.familyId),
  ]);

  const pocketRows = pocketsRes.data ?? [];
  const profileRows = profilesRes.data ?? [];
  const pocketNames = new Map(pocketRows.map((p) => [p.id, p.name]));
  const profileNames = new Map(profileRows.map((p) => [p.id, p.name]));

  const matchedPockets = search
    ? pocketRows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => p.id)
    : [];
  const matchedProfiles = search
    ? profileRows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => p.id)
    : [];
  const matchedExpenseCategories = search ? matchCategories(EXPENSE_CATEGORY_LABELS, search) : [];
  const matchedIncomeCategories = search ? matchCategories(INCOME_CATEGORY_LABELS, search) : [];

  // Nama barang: cari id transaksi yang punya barang cocok, lalu ikutkan
  // sebagai salah satu cabang OR pada query pengeluaran.
  const itemMatches = search ? await findTransactionsByItemName(supabase, session.familyId, search) : null;

  const [incomeRows, expenseRows, transferRows, adjustmentRows] = await Promise.all([
    kinds.includes("income") ? fetchIncome() : Promise.resolve([]),
    kinds.includes("expense") ? fetchExpense() : Promise.resolve([]),
    kinds.includes("transfer") ? fetchTransfer() : Promise.resolve([]),
    kinds.includes("adjustment") ? fetchAdjustment() : Promise.resolve([]),
  ]);

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
      direction: "in" as const,
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
      direction: "out" as const,
      date: r.date,
      note: r.note,
      createdByName: nameOf(r.created_by),
      hasReceipt: withReceipt.has(r.id),
      matchedItems: itemMatches?.get(r.id),
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
      direction: "neutral" as const,
      date: String(r.created_at).slice(0, 10),
      note: r.note,
      createdByName: nameOf(r.created_by),
      hasReceipt: false,
    })),
    ...adjustmentRows.map((r) => {
      const delta = Number(r.delta);
      return {
        key: `adjustment:${r.id}`,
        id: r.id,
        kind: "adjustment" as const,
        // Judul menyebut jenisnya secara eksplisit supaya baris koreksi tidak
        // pernah terbaca sebagai pendapatan atau pengeluaran biasa.
        title: `Penyesuaian ${accountOf(r.pocket_id)}`,
        account: accountOf(r.pocket_id),
        categoryKey: null,
        categoryLabel: "Penyesuaian",
        amount: Math.abs(delta),
        direction: delta >= 0 ? ("in" as const) : ("out" as const),
        date: r.date,
        note: r.reason,
        createdByName: nameOf(r.created_by),
        hasReceipt: false,
      };
    }),
  ];

  const sorted = sortEntries(entries, sort);

  const totals = sorted.reduce(
    (acc, e) => {
      if (e.kind === "adjustment") {
        acc.adjustment += e.direction === "in" ? e.amount : -e.amount;
      } else {
        acc[e.kind] += e.amount;
      }
      return acc;
    },
    { income: 0, expense: 0, transfer: 0, adjustment: 0 }
  );

  const from = (page - 1) * pageSize;

  return {
    entries: sorted.slice(from, from + pageSize),
    total: sorted.length,
    page,
    pageSize,
    totals,
    searchText: search,
    searchHints: parsed.hints,
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

    if (search) {
      q = q.or(
        orClause([
          `source.ilike.${like}`,
          `note.ilike.${like}`,
          inClause("category", matchedIncomeCategories),
          inClause("pocket_id", matchedPockets),
          inClause("created_by", matchedProfiles),
        ])
      );
    }
    if (amountLo !== undefined) q = q.gte("amount", amountLo).lte("amount", amountHi!);
    if (dateFrom) q = q.gte("date", dateFrom);
    if (dateTo) q = q.lte("date", dateTo);
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

    if (search) {
      q = q.or(
        orClause([
          `merchant.ilike.${like}`,
          `name.ilike.${like}`,
          `note.ilike.${like}`,
          inClause("category", matchedExpenseCategories),
          inClause("pocket_id", matchedPockets),
          inClause("created_by", matchedProfiles),
          inClause("id", Array.from(itemMatches?.keys() ?? []).slice(0, MAX_IN_IDS)),
        ])
      );
    }
    if (amountLo !== undefined) q = q.gte("total", amountLo).lte("total", amountHi!);
    if (dateFrom) q = q.gte("date", dateFrom);
    if (dateTo) q = q.lte("date", dateTo);
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

    if (search) {
      q = q.or(
        orClause([
          `note.ilike.${like}`,
          inClause("from_pocket_id", matchedPockets),
          inClause("to_pocket_id", matchedPockets),
          inClause("created_by", matchedProfiles),
        ])
      );
    }
    if (amountLo !== undefined) q = q.gte("amount", amountLo).lte("amount", amountHi!);
    if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00Z`);
    if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59Z`);
    if (isUuid(filter.createdBy)) q = q.eq("created_by", filter.createdBy);
    if (accountPocketId) {
      q = q.or(`from_pocket_id.eq.${accountPocketId},to_pocket_id.eq.${accountPocketId}`);
    } else if (accountIsMain) {
      q = q.or("from_type.eq.main,to_type.eq.main");
    }

    const { data } = await q.order("created_at", { ascending: false }).limit(CAP);
    return data ?? [];
  }

  async function fetchAdjustment() {
    // Penyesuaian tidak berkategori — filter kategori otomatis mengosongkannya.
    if (filter.category && filter.category !== "all") return [];
    if (wantsAccount && accountPocketId === null && !accountIsMain) return [];

    let q = supabase
      .from("balance_adjustments")
      .select("id, pocket_id, delta, reason, date, created_by")
      .eq("family_id", session!.familyId);

    if (search) {
      q = q.or(
        orClause([
          `reason.ilike.${like}`,
          inClause("pocket_id", matchedPockets),
          inClause("created_by", matchedProfiles),
        ])
      );
    }
    if (dateFrom) q = q.gte("date", dateFrom);
    if (dateTo) q = q.lte("date", dateTo);
    if (accountIsMain) q = q.is("pocket_id", null);
    else if (accountPocketId) q = q.eq("pocket_id", accountPocketId);
    if (isUuid(filter.createdBy)) q = q.eq("created_by", filter.createdBy);

    const { data, error } = await q.order("date", { ascending: false }).limit(CAP);

    // Migration 0025 belum jalan: riwayat tetap tampil tanpa baris penyesuaian
    // alih-alih menggagalkan seluruh halaman.
    if (isMissingSchema(error)) return [];

    const rows = data ?? [];
    // Nominal tidak bisa difilter di database karena `delta` boleh negatif dan
    // yang dicari orang adalah besarannya; saringannya dikerjakan di sini.
    if (amountLo === undefined) return rows;
    return rows.filter((row) => {
      const value = Math.abs(Number(row.delta));
      return value >= amountLo && value <= amountHi!;
    });
  }
}

/**
 * Transaksi yang punya barang bernama mirip kata kunci.
 *
 * Dua langkah (cari barang → saring transaksi) dipilih ketimbang satu join
 * PostgREST karena hasilnya juga dipakai untuk MENAMPILKAN barang yang cocok
 * di bawah baris transaksi — jadi datanya memang dibutuhkan, bukan sekadar
 * daftar id.
 */
async function findTransactionsByItemName(
  supabase: AdminClient,
  familyId: string,
  term: string
): Promise<Map<string, string[]>> {
  const matches = new Map<string, string[]>();

  // shopping_transaction_items tidak menyimpan family_id sendiri, jadi batas
  // keluarga ditegakkan lewat INNER JOIN ke transaksi induknya — bukan dengan
  // menyaring hasilnya belakangan. Menyaring belakangan bukan cuma soal
  // kebocoran: `limit` akan terpakai habis oleh baris milik keluarga lain
  // sebelum sempat sampai ke baris yang benar.
  const { data: items, error } = await supabase
    .from("shopping_transaction_items")
    .select("transaction_id, name, shopping_transactions!inner(family_id)")
    .eq("shopping_transactions.family_id", familyId)
    .ilike("name", `%${term}%`)
    .limit(CAP);

  if (error || !items || items.length === 0) return matches;

  for (const row of items as unknown as { transaction_id: string; name: string }[]) {
    const list = matches.get(row.transaction_id);
    if (list) {
      // Maksimal lima nama per transaksi: baris riwayat hanya punya satu
      // baris untuk menampilkannya.
      if (list.length < 5 && !list.includes(row.name)) list.push(row.name);
    } else {
      matches.set(row.transaction_id, [row.name]);
    }
  }

  return matches;
}

/**
 * Batas jumlah id transaksi yang boleh ikut ke dalam klausa `id.in.(…)`.
 *
 * Filter PostgREST dikirim lewat query string, jadi daftar id yang terlalu
 * panjang membuat URL-nya ditolak server sebelum query sempat berjalan.
 */
const MAX_IN_IDS = 200;

/** Kunci kategori yang labelnya mengandung kata kunci. */
function matchCategories(labels: Record<string, string>, term: string): string[] {
  const needle = term.toLowerCase();
  return Object.entries(labels)
    .filter(([, label]) => label.toLowerCase().includes(needle))
    .map(([key]) => key);
}

/** `column.in.(a,b,c)` — dilewati bila daftarnya kosong. */
function inClause(column: string, values: string[]): string | null {
  return values.length > 0 ? `${column}.in.(${values.join(",")})` : null;
}

function orClause(parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(",");
}

function maxDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function minDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function sortEntries(entries: LedgerEntry[], sort: LedgerSort): LedgerEntry[] {
  const byDateDesc = (a: LedgerEntry, b: LedgerEntry) =>
    a.date === b.date ? b.key.localeCompare(a.key) : b.date.localeCompare(a.date);

  switch (sort) {
    case "oldest":
      return [...entries].sort((a, b) => -byDateDesc(a, b));
    case "largest":
      return [...entries].sort((a, b) => b.amount - a.amount || byDateDesc(a, b));
    case "smallest":
      return [...entries].sort((a, b) => a.amount - b.amount || byDateDesc(a, b));
    default:
      return [...entries].sort(byDateDesc);
  }
}

const KIND_LABELS: Record<LedgerKind, string> = {
  income: "Pendapatan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  adjustment: "Penyesuaian",
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
      // Arah dibaca dari `direction`, bukan dari jenisnya: penyesuaian bisa
      // menambah maupun mengurangi, jadi tandanya tidak boleh ditebak.
      e.direction === "out" ? -e.amount : e.amount,
      e.note ?? "",
      e.createdByName,
    ]
      .map(csvCell)
      .join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}
