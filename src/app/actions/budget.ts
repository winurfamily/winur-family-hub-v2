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
import { monthRange } from "@/lib/finance";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/supabase/types";

/**
 * Anggaran bulanan per kategori pengeluaran.
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
}

export interface BudgetOverview {
  ready: boolean;
  month: string;
  totalBudget: number;
  totalSpent: number;
  lines: BudgetLine[];
}

function canonical(value: unknown): ExpenseCategory {
  const key = EXPENSE_CATEGORIES.includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : "lainnya";
  return EXPENSE_CATEGORY_ALIASES[key] ?? key;
}

export async function getBudgetOverview(month: string): Promise<BudgetOverview> {
  const empty: BudgetOverview = { ready: false, month, totalBudget: 0, totalSpent: 0, lines: [] };

  const session = await requireFinanceSession();
  if (!session) return empty;

  const supabase = createAdminClient();
  const { start, end } = monthRange(month);

  const [budgetRes, spendRes] = await Promise.all([
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
  ]);

  if (isMissingTable(budgetRes.error)) return empty;

  const budgets = new Map<string, number>();
  for (const row of budgetRes.data ?? []) {
    if (row.category_key) budgets.set(canonical(row.category_key), Number(row.amount));
  }

  const spent = new Map<string, number>();
  for (const row of spendRes.data ?? []) {
    const key = canonical(row.category);
    spent.set(key, (spent.get(key) ?? 0) + Number(row.total));
  }

  const lines: BudgetLine[] = BUDGET_CATEGORIES.map((key) => {
    const amount = budgets.get(key) ?? 0;
    const used = spent.get(key) ?? 0;
    return {
      categoryKey: key,
      label: EXPENSE_CATEGORY_LABELS[key],
      amount,
      spent: used,
      percent: amount > 0 ? Math.min(999, Math.round((used / amount) * 100)) : 0,
    };
  })
    // Kategori yang dianggarkan atau sudah terpakai tampil lebih dulu.
    .sort((a, b) => Number(b.amount > 0 || b.spent > 0) - Number(a.amount > 0 || a.spent > 0));

  return {
    ready: true,
    month,
    totalBudget: lines.reduce((acc, line) => acc + line.amount, 0),
    totalSpent: lines.reduce((acc, line) => acc + line.spent, 0),
    lines,
  };
}

export async function setBudget(
  month: string,
  categoryKey: string,
  amount: number
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  if (!/^\d{4}-\d{2}$/.test(month)) return { success: false, error: "Bulan tidak valid." };

  const key = canonical(categoryKey);
  if (!BUDGET_CATEGORIES.includes(key)) return { success: false, error: "Kategori tidak dikenal." };

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
