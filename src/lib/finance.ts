import "server-only";

/**
 * Normalisasi nama produk untuk pencocokan anti-duplicate
 * (lowercase, trim, & rapikan spasi ganda).
 */
export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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

export function sumBy<T extends Record<string, unknown>>(rows: T[] | null | undefined, key: keyof T): number {
  return (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}
