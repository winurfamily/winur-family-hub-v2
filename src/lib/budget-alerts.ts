/**
 * Status anggaran & peringatan keuangan — murni, tanpa database.
 *
 * Dipisahkan dari server action supaya aturan ambangnya bisa diuji langsung
 * dan dipakai ulang oleh komponen klien tanpa membawa serta klien Supabase.
 *
 * Prinsip tampilannya: peringatan adalah KARTU DI DALAM HALAMAN, bukan popup.
 * Popup menghalangi pekerjaan dan — karena anggaran dihitung ulang setiap
 * halaman dimuat — akan muncul lagi setiap kali menu dibuka sampai orangnya
 * berhenti membaca. Kartu bisa dibaca sekilas, ditutup, dan tetap bisa
 * ditemukan lagi di tab Anggaran.
 */

import { formatRupiah } from "@/lib/format";

/** Ambang peringatan pemakaian anggaran, dari yang paling ringan. */
export const BUDGET_THRESHOLDS = [75, 90, 100] as const;

/**
 * Kunci baris anggaran TOTAL di `monthly_budgets`.
 *
 * Tabel itu unik pada (family_id, month, category_key), dan Postgres tidak
 * menganggap dua `NULL` bentrok — memakai NULL sebagai "total" akan diam-diam
 * mengizinkan baris total ganda. Sentinel teks menutup celah itu tanpa index
 * parsial baru, dan tidak mungkin bertabrakan dengan kategori sungguhan.
 *
 * Tinggal di sini (bukan di berkas "use server") karena form anggaran adalah
 * komponen klien dan butuh nilainya tanpa memanggil server.
 */
export const TOTAL_BUDGET_KEY = "__total__";

export type BudgetStatus = "aman" | "mendekati" | "hampir" | "lewat";

/**
 * Status satu baris anggaran.
 *
 * "mendekati" (≥75%) sengaja berbeda dari "hampir" (≥90%): yang pertama masih
 * informatif, yang kedua sudah menuntut tindakan. Menyatukannya membuat
 * peringatan dini kehilangan arti pada pertengahan bulan.
 */
export function budgetStatus(percent: number): BudgetStatus {
  if (percent >= 100) return "lewat";
  if (percent >= 90) return "hampir";
  if (percent >= 75) return "mendekati";
  return "aman";
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  aman: "Aman",
  mendekati: "Mendekati batas",
  hampir: "Hampir habis",
  lewat: "Melewati batas",
};

/** Persentase pemakaian, dibatasi 999 agar angka ekstrem tidak merusak tata letak. */
export function usagePercent(spent: number, budget: number): number {
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  return Math.min(999, Math.round((spent / budget) * 100));
}

/** Perubahan terhadap bulan sebelumnya, dalam persen. `null` = tidak ada pembanding. */
export function monthOverMonth(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type AlertLevel = "info" | "warning" | "danger";

export interface FinanceAlert {
  /** Stabil lintas render supaya penutupan oleh pengguna bisa diingat. */
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  /** Tab Keuangan yang dituju saat kartunya ditekan. */
  target?: "anggaran" | "transaksi" | "dompet" | "rutin";
}

export interface AlertInput {
  month: string;
  totalBudget: number;
  totalSpent: number;
  income: number;
  expense: number;
  lines: {
    categoryKey: string;
    label: string;
    amount: number;
    spent: number;
  }[];
  /** Akun bersaldo minus atau nol yang masih dipakai jadwal rutin. */
  lowAccounts?: { name: string; balance: number }[];
  /** Total tagihan rutin yang jatuh tempo dalam waktu dekat. */
  upcomingRecurring?: { total: number; count: number; available: number };
}

const rupiah = formatRupiah;

/**
 * Susun seluruh peringatan keuangan bulan berjalan.
 *
 * Urutannya sengaja: bahaya lebih dulu, lalu peringatan, lalu info — daftar
 * ini dirender apa adanya, jadi yang paling mendesak selalu terbaca pertama.
 * Satu kategori hanya menghasilkan SATU kartu (ambang tertinggi yang
 * terlampaui), supaya melewati 100% tidak memunculkan tiga kartu sekaligus
 * untuk hal yang sama.
 */
export function buildFinanceAlerts(input: AlertInput): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];

  // --- Pengeluaran melebihi pendapatan -------------------------------
  if (input.expense > input.income && input.expense > 0) {
    const gap = input.expense - input.income;
    alerts.push({
      id: `overspend:${input.month}`,
      level: "danger",
      title: "Pengeluaran melebihi pendapatan",
      message: `Bulan ini keluar ${rupiah(input.expense)} sementara masuk ${rupiah(
        input.income
      )} — selisih ${rupiah(gap)} diambil dari saldo yang sudah ada.`,
      target: "transaksi",
    });
  }

  // --- Anggaran total -------------------------------------------------
  if (input.totalBudget > 0) {
    const percent = usagePercent(input.totalSpent, input.totalBudget);
    const status = budgetStatus(percent);
    if (status !== "aman") {
      const sisa = input.totalBudget - input.totalSpent;
      alerts.push({
        id: `budget-total:${input.month}:${crossedThreshold(percent)}`,
        level: status === "lewat" ? "danger" : status === "hampir" ? "warning" : "info",
        title:
          status === "lewat"
            ? "Anggaran bulanan terlampaui"
            : `Anggaran bulanan terpakai ${percent}%`,
        message:
          status === "lewat"
            ? `Terpakai ${rupiah(input.totalSpent)} dari ${rupiah(input.totalBudget)} — lebih ${rupiah(
                Math.abs(sisa)
              )}.`
            : `Terpakai ${rupiah(input.totalSpent)} dari ${rupiah(input.totalBudget)}. Sisa ${rupiah(
                sisa
              )}.`,
        target: "anggaran",
      });
    }
  }

  // --- Anggaran per kategori -----------------------------------------
  for (const line of input.lines) {
    if (line.amount <= 0) continue;
    const percent = usagePercent(line.spent, line.amount);
    const status = budgetStatus(percent);
    if (status === "aman") continue;

    const sisa = line.amount - line.spent;
    // Kategori Belanja punya kalimatnya sendiri: uangnya dibelanjakan lewat
    // checklist di toko, jadi yang berguna diketahui adalah sisa yang masih
    // boleh dipakai — bukan sekadar persentase.
    const isBelanja = line.categoryKey === "belanja";

    alerts.push({
      id: `budget:${line.categoryKey}:${input.month}:${crossedThreshold(percent)}`,
      level: status === "lewat" ? "danger" : status === "hampir" ? "warning" : "info",
      title:
        status === "lewat"
          ? `Anggaran ${line.label} terlampaui`
          : `Anggaran ${line.label} tinggal ${Math.max(0, 100 - percent)}%`,
      message:
        status === "lewat"
          ? `Terpakai ${rupiah(line.spent)} dari ${rupiah(line.amount)} — lebih ${rupiah(Math.abs(sisa))}.`
          : isBelanja
            ? `Sisa ${rupiah(sisa)} untuk belanja bulan ini dari jatah ${rupiah(line.amount)}.`
            : `Terpakai ${rupiah(line.spent)} dari ${rupiah(line.amount)}. Sisa ${rupiah(sisa)}.`,
      target: "anggaran",
    });
  }

  // --- Saldo sumber dana tidak cukup ---------------------------------
  for (const account of input.lowAccounts ?? []) {
    if (account.balance > 0) continue;
    alerts.push({
      id: `low-account:${account.name}`,
      level: account.balance < 0 ? "danger" : "warning",
      title: `Saldo ${account.name} ${account.balance < 0 ? "minus" : "kosong"}`,
      message:
        account.balance < 0
          ? `${account.name} tercatat ${rupiah(account.balance)}. Periksa transaksinya atau pakai Penyesuaian Saldo bila angkanya memang keliru.`
          : `${account.name} sudah habis. Pindahkan dana sebelum memakainya lagi.`,
      target: "dompet",
    });
  }

  const upcoming = input.upcomingRecurring;
  if (upcoming && upcoming.count > 0 && upcoming.total > upcoming.available) {
    alerts.push({
      id: `recurring-short:${input.month}`,
      level: "warning",
      title: "Dana belum cukup untuk tagihan rutin",
      message: `${upcoming.count} tagihan rutin sebesar ${rupiah(
        upcoming.total
      )} akan jatuh tempo, sementara dana tersedia ${rupiah(upcoming.available)}.`,
      target: "rutin",
    });
  }

  const rank: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}

/**
 * Ambang tertinggi yang sudah terlampaui — menjadi bagian dari id kartu.
 *
 * Dengan begitu menutup kartu "75%" tidak ikut membungkam kartu "90%" yang
 * muncul kemudian: keduanya punya id berbeda, jadi kenaikan tingkat selalu
 * terlihat lagi meski peringatan sebelumnya sudah ditutup.
 */
function crossedThreshold(percent: number): number {
  let crossed = 0;
  for (const threshold of BUDGET_THRESHOLDS) {
    if (percent >= threshold) crossed = threshold;
  }
  return crossed;
}
