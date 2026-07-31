/**
 * Utilitas periode & bulan — murni, tanpa akses database.
 *
 * Dipisahkan dari `lib/finance.ts` (yang ditandai `server-only`) karena
 * filter periode di dashboard adalah komponen klien dan tetap membutuhkan
 * daftar serta label periodenya.
 */

/** Format "YYYY-MM" untuk bulan berjalan (waktu lokal). */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Rentang tanggal awal-akhir bulan dari format "YYYY-MM". */
export function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Geser "YYYY-MM" sebanyak `delta` bulan. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Daftar `count` bulan terakhir, terlama lebih dulu. */
export function lastMonths(count: number, endMonth = currentMonth()): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - (count - 1)));
}

export const PERIOD_KEYS = ["this_month", "last_month", "3m", "6m", "ytd"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: "Bulan ini",
  last_month: "Bulan lalu",
  "3m": "3 bulan",
  "6m": "6 bulan",
  ytd: "Tahun berjalan",
};

export interface PeriodRange {
  key: PeriodKey;
  label: string;
  start: string;
  end: string;
  /** Bulan yang tercakup, terlama lebih dulu — dipakai untuk grafik tren. */
  months: string[];
  /** Periode pembanding dengan panjang yang sama, tepat sebelum periode ini. */
  previous: { start: string; end: string };
}

export function resolvePeriod(key: PeriodKey, today = currentMonth()): PeriodRange {
  let months: string[];

  switch (key) {
    case "last_month":
      months = [shiftMonth(today, -1)];
      break;
    case "3m":
      months = lastMonths(3, today);
      break;
    case "6m":
      months = lastMonths(6, today);
      break;
    case "ytd": {
      const [year, upto] = today.split("-").map(Number);
      months = Array.from({ length: upto }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
      break;
    }
    default:
      months = [today];
  }

  const prevMonths = lastMonths(months.length, shiftMonth(months[0], -1));

  return {
    key,
    label: PERIOD_LABELS[key],
    start: monthRange(months[0]).start,
    end: monthRange(months[months.length - 1]).end,
    months,
    previous: {
      start: monthRange(prevMonths[0]).start,
      end: monthRange(prevMonths[prevMonths.length - 1]).end,
    },
  };
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return PERIOD_KEYS.includes(value as PeriodKey);
}
