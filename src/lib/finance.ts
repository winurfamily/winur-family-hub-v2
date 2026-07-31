import "server-only";

/**
 * Helper keuangan sisi server.
 *
 * Utilitas periode/bulan yang murni tinggal di `lib/period.ts` (tanpa
 * `server-only`) agar bisa dipakai komponen klien seperti filter periode,
 * lalu di-ekspor ulang dari sini supaya impor lama tetap berfungsi.
 */
export {
  currentMonth,
  monthRange,
  shiftMonth,
  lastMonths,
  resolvePeriod,
  isPeriodKey,
  PERIOD_KEYS,
  PERIOD_LABELS,
  type PeriodKey,
  type PeriodRange,
} from "@/lib/period";

/**
 * Normalisasi nama produk untuk pencocokan anti-duplicate
 * (lowercase, trim, & rapikan spasi ganda).
 */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sumBy<T extends Record<string, unknown>>(rows: T[] | null | undefined, key: keyof T): number {
  return (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}
