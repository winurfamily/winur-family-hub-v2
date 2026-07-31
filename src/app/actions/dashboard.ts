"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireFinanceSession, isUuid } from "@/lib/server/finance-helpers";
import {
  currentMonth,
  monthRange,
  resolvePeriod,
  isPeriodKey,
  type PeriodKey,
} from "@/lib/finance";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/supabase/types";

export interface CategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  percent: number;
}

export interface TrendPoint {
  month: string;
  /** "Jan", "Feb", ... untuk sumbu grafik. */
  label: string;
  income: number;
  expense: number;
}

export interface PocketProgress {
  id: string;
  name: string;
  balance: number;
  spent: number;
  /** Porsi pocket ini terhadap seluruh dana pocket. */
  sharePercent: number;
  isLow: boolean;
}

export interface RecentTransaction {
  id: string;
  kind: "income" | "expense" | "transfer";
  title: string;
  subtitle: string;
  amount: number;
  date: string;
}

export interface ActivePlanSummary {
  id: string;
  name: string;
  plannedDate: string | null;
  totalEstimated: number;
  progressPercent: number;
  itemCount: number;
  boughtCount: number;
}

export interface DashboardAlert {
  id: string;
  level: "warning" | "danger";
  title: string;
  message: string;
}

export interface DashboardData {
  period: { key: PeriodKey; label: string; start: string; end: string };
  saldoUtama: number;
  totalPockets: number;
  totalKeluarga: number;
  income: number;
  expense: number;
  netCashFlow: number;
  previousExpense: number;
  /** Selisih pengeluaran vs periode sebelumnya, dalam persen. null bila tak ada pembanding. */
  expenseChangePercent: number | null;
  categories: CategoryBreakdown[];
  trend: TrendPoint[];
  pockets: PocketProgress[];
  activePlans: ActivePlanSummary[];
  recent: RecentTransaction[];
  alerts: DashboardAlert[];
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function monthLabel(month: string): string {
  const [, m] = month.split("-").map(Number);
  return MONTH_SHORT[(m - 1) % 12] ?? month;
}

function normalizeCategory(value: unknown): ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory) ? (value as ExpenseCategory) : "lainnya";
}

/**
 * Seluruh angka dashboard berasal dari Supabase. Tidak ada nilai contoh:
 * ketika keluarga belum punya data, semua agregat bernilai 0 dan UI
 * menampilkan empty state.
 */
export async function getDashboardData(periodKey: unknown = "this_month"): Promise<DashboardData | null> {
  const session = await requireFinanceSession();
  if (!session) return null;

  const key: PeriodKey = isPeriodKey(periodKey) ? periodKey : "this_month";
  const period = resolvePeriod(key, currentMonth());

  // Tren selalu 6 bulan terakhir (D.9), terlepas dari filter periode.
  const trendMonths = resolvePeriod("6m", currentMonth()).months;
  const trendStart = monthRange(trendMonths[0]).start;
  const trendEnd = monthRange(trendMonths[trendMonths.length - 1]).end;

  const supabase = createAdminClient();

  const [
    familyRes,
    pocketsRes,
    incomePeriodRes,
    expensePeriodRes,
    expensePrevRes,
    incomeTrendRes,
    expenseTrendRes,
    pocketSpentRes,
    plansRes,
    recentIncomeRes,
    recentExpenseRes,
    recentTransferRes,
  ] = await Promise.all([
    supabase.from("families").select("main_balance").eq("id", session.familyId).maybeSingle(),
    supabase
      .from("pockets")
      .select("id, name, balance")
      .eq("family_id", session.familyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("income")
      .select("amount")
      .eq("family_id", session.familyId)
      .gte("date", period.start)
      .lte("date", period.end),
    supabase
      .from("shopping_transactions")
      .select("total, category")
      .eq("family_id", session.familyId)
      .gte("date", period.start)
      .lte("date", period.end),
    supabase
      .from("shopping_transactions")
      .select("total")
      .eq("family_id", session.familyId)
      .gte("date", period.previous.start)
      .lte("date", period.previous.end),
    supabase
      .from("income")
      .select("amount, date")
      .eq("family_id", session.familyId)
      .gte("date", trendStart)
      .lte("date", trendEnd),
    supabase
      .from("shopping_transactions")
      .select("total, date")
      .eq("family_id", session.familyId)
      .gte("date", trendStart)
      .lte("date", trendEnd),
    supabase
      .from("shopping_transactions")
      .select("pocket_id, total")
      .eq("family_id", session.familyId)
      .not("pocket_id", "is", null),
    supabase
      .from("shopping_plans")
      .select("id, name, planned_date, total_estimated, status")
      .eq("family_id", session.familyId)
      .in("status", ["draft", "active"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("income")
      .select("id, source, amount, date, pocket_id")
      .eq("family_id", session.familyId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("shopping_transactions")
      .select("id, merchant, name, total, date, category")
      .eq("family_id", session.familyId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("pocket_transfers")
      .select("id, from_type, to_type, amount, note, created_at")
      .eq("family_id", session.familyId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // --- KPI utama -------------------------------------------------------
  const saldoUtama = Number(familyRes.data?.main_balance ?? 0);
  const pocketRows = pocketsRes.data ?? [];
  const totalPockets = pocketRows.reduce((acc, p) => acc + Number(p.balance), 0);

  const income = (incomePeriodRes.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0);
  const expenseRows = expensePeriodRes.data ?? [];
  const expense = expenseRows.reduce((acc, r) => acc + Number(r.total), 0);
  const previousExpense = (expensePrevRes.data ?? []).reduce((acc, r) => acc + Number(r.total), 0);

  // --- Kategori --------------------------------------------------------
  const byCategory = new Map<ExpenseCategory, number>();
  for (const row of expenseRows) {
    const cat = normalizeCategory(row.category);
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(row.total));
  }
  const categories: CategoryBreakdown[] = Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
      percent: expense > 0 ? (amount / expense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // --- Tren 6 bulan ----------------------------------------------------
  const incomeByMonth = new Map<string, number>();
  for (const row of incomeTrendRes.data ?? []) {
    const m = String(row.date).slice(0, 7);
    incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + Number(row.amount));
  }
  const expenseByMonth = new Map<string, number>();
  for (const row of expenseTrendRes.data ?? []) {
    const m = String(row.date).slice(0, 7);
    expenseByMonth.set(m, (expenseByMonth.get(m) ?? 0) + Number(row.total));
  }
  const trend: TrendPoint[] = trendMonths.map((month) => ({
    month,
    label: monthLabel(month),
    income: incomeByMonth.get(month) ?? 0,
    expense: expenseByMonth.get(month) ?? 0,
  }));

  // --- Progress pocket -------------------------------------------------
  const spentByPocket = new Map<string, number>();
  for (const row of pocketSpentRes.data ?? []) {
    const id = row.pocket_id as string;
    spentByPocket.set(id, (spentByPocket.get(id) ?? 0) + Number(row.total));
  }
  const pockets: PocketProgress[] = pocketRows.map((p) => {
    const balance = Number(p.balance);
    const spent = spentByPocket.get(p.id) ?? 0;
    // "Hampir habis" = tersisa di bawah 10% dari total yang pernah masuk
    // (saldo sekarang + yang sudah terpakai).
    const everHeld = balance + spent;
    return {
      id: p.id,
      name: p.name,
      balance,
      spent,
      sharePercent: totalPockets > 0 ? (balance / totalPockets) * 100 : 0,
      isLow: everHeld > 0 && balance / everHeld < 0.1,
    };
  });

  // --- Rencana aktif ---------------------------------------------------
  const planIds = (plansRes.data ?? []).map((p) => p.id);
  const { data: planItems } =
    planIds.length > 0
      ? await supabase.from("shopping_plan_items").select("plan_id, status").in("plan_id", planIds)
      : { data: [] as { plan_id: string; status: string }[] };

  const activePlans: ActivePlanSummary[] = (plansRes.data ?? []).map((p) => {
    const items = (planItems ?? []).filter((i) => i.plan_id === p.id && i.status !== "cancelled");
    const bought = items.filter((i) => i.status === "bought").length;
    return {
      id: p.id,
      name: p.name,
      plannedDate: p.planned_date,
      totalEstimated: Number(p.total_estimated),
      itemCount: items.length,
      boughtCount: bought,
      progressPercent: items.length > 0 ? Math.round((bought / items.length) * 100) : 0,
    };
  });

  // --- Transaksi terbaru (gabungan) ------------------------------------
  const pocketNames = new Map(pocketRows.map((p) => [p.id, p.name]));
  const recent: RecentTransaction[] = [
    ...(recentIncomeRes.data ?? []).map((r) => ({
      id: `income-${r.id}`,
      kind: "income" as const,
      title: r.source,
      subtitle: r.pocket_id ? pocketNames.get(r.pocket_id) ?? "Pocket" : "Saldo Utama",
      amount: Number(r.amount),
      date: r.date,
    })),
    ...(recentExpenseRes.data ?? []).map((r) => ({
      id: `expense-${r.id}`,
      kind: "expense" as const,
      title: r.merchant ?? r.name,
      subtitle: EXPENSE_CATEGORY_LABELS[normalizeCategory(r.category)],
      amount: Number(r.total),
      date: r.date,
    })),
    ...(recentTransferRes.data ?? []).map((r) => ({
      id: `transfer-${r.id}`,
      kind: "transfer" as const,
      title: r.note || "Transfer dana",
      subtitle: `${r.from_type === "main" ? "Saldo Utama" : "Pocket"} → ${
        r.to_type === "main" ? "Saldo Utama" : r.to_type === "external" ? "Luar Pocket" : "Pocket"
      }`,
      amount: Number(r.amount),
      date: String(r.created_at).slice(0, 10),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // --- Peringatan ------------------------------------------------------
  const alerts: DashboardAlert[] = [];

  if (expense > income) {
    alerts.push({
      id: "overspend",
      level: "danger",
      title: "Pengeluaran melebihi pendapatan",
      message: `Pada ${period.label.toLowerCase()}, pengeluaran lebih besar dari pendapatan. Selisihnya perlu diambil dari saldo yang ada.`,
    });
  }

  for (const pocket of pockets.filter((p) => p.isLow)) {
    alerts.push({
      id: `low-${pocket.id}`,
      level: "warning",
      title: `Pocket "${pocket.name}" hampir habis`,
      message: "Sisa saldo kurang dari 10% dari dana yang pernah masuk ke pocket ini.",
    });
  }

  // Rencana belanja yang estimasinya melampaui dana belanja yang tersedia.
  const belanjaPocket = pockets.find((p) => /belanja/i.test(p.name));
  const availableForPlan = belanjaPocket ? belanjaPocket.balance : saldoUtama;
  const plannedTotal = activePlans.reduce((acc, p) => acc + p.totalEstimated, 0);
  if (plannedTotal > 0 && plannedTotal > availableForPlan) {
    alerts.push({
      id: "plan-over-budget",
      level: "warning",
      title: "Rencana belanja melampaui saldo",
      message: `Total estimasi rencana aktif melebihi saldo ${
        belanjaPocket ? `pocket "${belanjaPocket.name}"` : "utama"
      }.`,
    });
  }

  return {
    period: { key, label: period.label, start: period.start, end: period.end },
    saldoUtama,
    totalPockets,
    totalKeluarga: saldoUtama + totalPockets,
    income,
    expense,
    netCashFlow: income - expense,
    previousExpense,
    expenseChangePercent:
      previousExpense > 0 ? ((expense - previousExpense) / previousExpense) * 100 : null,
    categories,
    trend,
    pockets,
    activePlans,
    recent,
    alerts,
  };
}

/** Dipakai halaman detail pocket untuk memastikan pocket milik keluarga ini. */
export async function pocketBelongsToFamily(pocketId: string): Promise<boolean> {
  const session = await requireFinanceSession();
  if (!session || !isUuid(pocketId)) return false;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pockets")
    .select("id")
    .eq("id", pocketId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  return Boolean(data);
}
