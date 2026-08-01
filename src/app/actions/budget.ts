"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireFinanceSession,
  revalidateKeuangan,
  toRupiah,
  FORBIDDEN,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { monthRange, shiftMonth } from "@/lib/finance";
import { todayISODate } from "@/lib/format";
import { shiftDate, RECURRING_LEAD_DAYS } from "@/lib/recurring";
import {
  buildFinanceAlerts,
  budgetStatus,
  monthOverMonth,
  usagePercent,
  TOTAL_BUDGET_KEY,
  type BudgetStatus,
  type FinanceAlert,
} from "@/lib/budget-alerts";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/supabase/types";

/**
 * Anggaran bulanan + peringatan keuangan.
 *
 * Tabel `monthly_budgets` datang dari migration 0022. Bila migration itu belum
 * diterapkan ke proyek Supabase, seluruh fungsi di sini mengembalikan
 * `ready: false` alih-alih melempar error — sisa menu Keuangan tetap berjalan
 * penuh dan UI menampilkan satu instruksi jelas untuk menjalankan migration.
 */
const MISSING_TABLE = "42P01";

function isMissingTable(error: PostgrestError | null): boolean {
  return error?.code === MISSING_TABLE || /monthly_budgets.*does not exist/i.test(error?.message ?? "");
}

/**
 * Kategori yang bisa dianggarkan — alias lama dilipat ke kategori kanonik.
 * Sengaja TIDAK diekspor: berkas "use server" hanya boleh mengekspor fungsi async.
 */
const BUDGET_CATEGORIES = EXPENSE_CATEGORIES.filter(
  (key) => !(key in EXPENSE_CATEGORY_ALIASES)
) as readonly ExpenseCategory[];

export interface BudgetLine {
  categoryKey: ExpenseCategory;
  label: string;
  amount: number;
  spent: number;
  /** 0–999. >100 berarti melebihi anggaran. */
  percent: number;
  status: BudgetStatus;
  /** Sisa anggaran; negatif berarti terlampaui. */
  remaining: number;
  /** Nominal terpakai pada bulan sebelumnya. */
  previousSpent: number;
  /** Perubahan terhadap bulan lalu dalam persen. null = tak ada pembanding. */
  changePercent: number | null;
}

export interface BudgetOverview {
  ready: boolean;
  month: string;
  /** Anggaran total yang berlaku: yang diisi manual, atau jumlah per kategori. */
  totalBudget: number;
  /** true bila total diisi manual, bukan hasil penjumlahan kategori. */
  totalIsExplicit: boolean;
  totalSpent: number;
  totalRemaining: number;
  totalPercent: number;
  totalStatus: BudgetStatus;
  /** Pengeluaran bulan sebelumnya, untuk perbandingan. */
  previousSpent: number;
  changePercent: number | null;
  /** Pendapatan bulan ini — dasar peringatan "pengeluaran > pendapatan". */
  income: number;
  lines: BudgetLine[];
  /** Anggaran khusus kategori Belanja, ditonjolkan di menu Belanja. */
  belanja: BudgetLine | null;
  alerts: FinanceAlert[];
}

function canonical(value: unknown): ExpenseCategory {
  const key = EXPENSE_CATEGORIES.includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : "lainnya";
  return EXPENSE_CATEGORY_ALIASES[key] ?? key;
}

function emptyOverview(month: string): BudgetOverview {
  return {
    ready: false,
    month,
    totalBudget: 0,
    totalIsExplicit: false,
    totalSpent: 0,
    totalRemaining: 0,
    totalPercent: 0,
    totalStatus: "aman",
    previousSpent: 0,
    changePercent: null,
    income: 0,
    lines: [],
    belanja: null,
    alerts: [],
  };
}

export async function getBudgetOverview(month: string): Promise<BudgetOverview> {
  const empty = emptyOverview(month);

  const session = await requireFinanceSession();
  if (!session) return empty;

  const supabase = createAdminClient();
  const { start, end } = monthRange(month);
  const previousMonth = shiftMonth(month, -1);
  const previousRange = monthRange(previousMonth);
  const today = todayISODate();

  const [budgetRes, spendRes, prevSpendRes, incomeRes, pocketsRes, familyRes, recurringRes] =
    await Promise.all([
      supabase
        .from("monthly_budgets")
        .select("category_key, amount")
        .eq("family_id", session.familyId)
        .eq("month", month),
      supabase
        .from("shopping_transactions")
        .select("category, total")
        .eq("family_id", session.familyId)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("shopping_transactions")
        .select("category, total")
        .eq("family_id", session.familyId)
        .gte("date", previousRange.start)
        .lte("date", previousRange.end),
      supabase
        .from("income")
        .select("amount")
        .eq("family_id", session.familyId)
        .gte("date", start)
        .lte("date", end),
      supabase.from("pockets").select("name, balance").eq("family_id", session.familyId),
      supabase.from("families").select("main_balance").eq("id", session.familyId).maybeSingle(),
      // Tagihan rutin yang menunggu — dipakai peringatan "dana belum cukup".
      // Tabelnya datang dari migration 0025; bila belum ada, error-nya
      // diabaikan dan peringatan itu saja yang tidak muncul.
      supabase
        .from("recurring_occurrences")
        .select("amount, recurring_id")
        .eq("family_id", session.familyId)
        .eq("status", "pending")
        .lte("due_date", shiftDate(today, RECURRING_LEAD_DAYS)),
    ]);

  if (isMissingTable(budgetRes.error)) return empty;

  const budgets = new Map<string, number>();
  let explicitTotal = 0;
  for (const row of budgetRes.data ?? []) {
    if (row.category_key === TOTAL_BUDGET_KEY) {
      explicitTotal = Number(row.amount);
      continue;
    }
    if (row.category_key) budgets.set(canonical(row.category_key), Number(row.amount));
  }

  const sumByCategory = (rows: { category: string | null; total: number | string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      const key = canonical(row.category);
      map.set(key, (map.get(key) ?? 0) + Number(row.total));
    }
    return map;
  };

  const spent = sumByCategory(spendRes.data);
  const previous = sumByCategory(prevSpendRes.data);

  const lines: BudgetLine[] = BUDGET_CATEGORIES.map((key) => {
    const amount = budgets.get(key) ?? 0;
    const used = spent.get(key) ?? 0;
    const previousUsed = previous.get(key) ?? 0;
    const percent = usagePercent(used, amount);

    return {
      categoryKey: key,
      label: EXPENSE_CATEGORY_LABELS[key],
      amount,
      spent: used,
      percent,
      status: budgetStatus(percent),
      remaining: amount - used,
      previousSpent: previousUsed,
      changePercent: monthOverMonth(used, previousUsed),
    };
  })
    // Kategori yang dianggarkan atau sudah terpakai tampil lebih dulu.
    .sort((a, b) => Number(b.amount > 0 || b.spent > 0) - Number(a.amount > 0 || a.spent > 0));

  const categorySum = lines.reduce((acc, line) => acc + line.amount, 0);
  const totalBudget = explicitTotal > 0 ? explicitTotal : categorySum;
  const totalSpent = lines.reduce((acc, line) => acc + line.spent, 0);
  const previousSpent = lines.reduce((acc, line) => acc + line.previousSpent, 0);
  const totalPercent = usagePercent(totalSpent, totalBudget);
  const income = (incomeRes.data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);

  const mainBalance = Number(familyRes.data?.main_balance ?? 0);
  const pockets = (pocketsRes.data ?? []).map((p) => ({ name: p.name, balance: Number(p.balance) }));
  const available = mainBalance + pockets.reduce((acc, p) => acc + p.balance, 0);

  const upcomingRows = recurringRes.error ? [] : recurringRes.data ?? [];
  const upcomingTotal = upcomingRows.reduce((acc, row) => acc + Number(row.amount), 0);

  const alerts = buildFinanceAlerts({
    month,
    totalBudget,
    totalSpent,
    income,
    expense: totalSpent,
    lines: lines.map((line) => ({
      categoryKey: line.categoryKey,
      label: line.label,
      amount: line.amount,
      spent: line.spent,
    })),
    lowAccounts: [
      ...(mainBalance <= 0 ? [{ name: "Saldo Utama", balance: mainBalance }] : []),
      ...pockets.filter((p) => p.balance < 0),
    ],
    upcomingRecurring:
      upcomingRows.length > 0
        ? { total: upcomingTotal, count: upcomingRows.length, available }
        : undefined,
  });

  return {
    ready: true,
    month,
    totalBudget,
    totalIsExplicit: explicitTotal > 0,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    totalPercent,
    totalStatus: budgetStatus(totalPercent),
    previousSpent,
    changePercent: monthOverMonth(totalSpent, previousSpent),
    income,
    lines,
    belanja: lines.find((line) => line.categoryKey === "belanja") ?? null,
    alerts,
  };
}

/**
 * Simpan anggaran satu kategori — atau anggaran TOTAL bulan itu bila
 * `categoryKey` adalah sentinel total.
 */
export async function setBudget(
  month: string,
  categoryKey: string,
  amount: number
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  if (!/^\d{4}-\d{2}$/.test(month)) return { success: false, error: "Bulan tidak valid." };

  const isTotal = categoryKey === TOTAL_BUDGET_KEY;
  const key = isTotal ? TOTAL_BUDGET_KEY : canonical(categoryKey);
  if (!isTotal && !BUDGET_CATEGORIES.includes(key as ExpenseCategory)) {
    return { success: false, error: "Kategori tidak dikenal." };
  }

  const value = toRupiah(amount);
  if (!Number.isFinite(value) || value < 0) return { success: false, error: "Nominal anggaran tidak valid." };

  const supabase = createAdminClient();

  // Nominal 0 berarti "tidak dianggarkan" — barisnya dihapus, bukan disimpan 0,
  // agar daftar anggaran tidak penuh baris kosong.
  const { error } =
    value === 0
      ? await supabase
          .from("monthly_budgets")
          .delete()
          .eq("family_id", session.familyId)
          .eq("month", month)
          .eq("category_key", key)
      : await supabase
          .from("monthly_budgets")
          .upsert(
            { family_id: session.familyId, month, category_key: key, amount: value },
            { onConflict: "family_id,month,category_key" }
          );

  if (isMissingTable(error)) {
    return { success: false, error: "Fitur anggaran butuh migration 0022 dijalankan lebih dulu." };
  }
  if (error) return { success: false, error: "Gagal menyimpan anggaran." };

  revalidateKeuangan();
  return { success: true };
}

/**
 * Salin seluruh anggaran bulan sebelumnya ke bulan ini.
 *
 * Menyusun ulang dua belas kategori setiap awal bulan adalah pekerjaan yang
 * membuat fitur anggaran ditinggalkan. Baris yang SUDAH diisi di bulan tujuan
 * tidak ditimpa — menyalin tidak boleh menghapus keputusan yang sudah dibuat.
 */
export async function copyBudgetFromPreviousMonth(
  month: string
): Promise<ActionResult<{ copied: number }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!/^\d{4}-\d{2}$/.test(month)) return { success: false, error: "Bulan tidak valid." };

  const supabase = createAdminClient();
  const previous = shiftMonth(month, -1);

  const [{ data: source, error }, { data: existing }] = await Promise.all([
    supabase
      .from("monthly_budgets")
      .select("category_key, amount")
      .eq("family_id", session.familyId)
      .eq("month", previous),
    supabase
      .from("monthly_budgets")
      .select("category_key")
      .eq("family_id", session.familyId)
      .eq("month", month),
  ]);

  if (isMissingTable(error)) {
    return { success: false, error: "Fitur anggaran butuh migration 0022 dijalankan lebih dulu." };
  }
  if (!source || source.length === 0) {
    return { success: false, error: "Bulan sebelumnya belum punya anggaran untuk disalin." };
  }

  const taken = new Set((existing ?? []).map((row) => row.category_key));
  const rows = source
    .filter((row) => row.category_key && !taken.has(row.category_key) && Number(row.amount) > 0)
    .map((row) => ({
      family_id: session.familyId,
      month,
      category_key: row.category_key,
      amount: Number(row.amount),
    }));

  if (rows.length === 0) {
    return { success: false, error: "Semua anggaran bulan ini sudah diisi." };
  }

  const { error: insertError } = await supabase.from("monthly_budgets").insert(rows);
  if (insertError) return { success: false, error: "Gagal menyalin anggaran." };

  revalidateKeuangan();
  return { success: true, data: { copied: rows.length } };
}
