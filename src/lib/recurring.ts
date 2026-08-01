/**
 * Aritmetika jadwal transaksi rutin — murni, tanpa database.
 *
 * Ditulis agar hasilnya PERSIS SAMA dengan `fin_recurring_next_date` di
 * migration 0025. Postgres menjepit `date + interval '1 month'` ke akhir bulan
 * (31 Januari → 28/29 Februari); JavaScript tidak, jadi penjepitannya
 * dikerjakan manual di sini. Kalau keduanya berbeda, pratinjau "jatuh tempo
 * berikutnya" di layar akan meleset dari yang benar-benar dibuat generator.
 */

export const RECURRING_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

/** Deskripsi frekuensi yang berdiri sendiri di kartu jadwal. */
export const FREQUENCY_HINTS: Record<RecurringFrequency, string> = {
  weekly: "Setiap 7 hari",
  monthly: "Setiap bulan pada tanggal yang sama",
  yearly: "Setiap tahun pada tanggal yang sama",
};

export function isRecurringFrequency(value: unknown): value is RecurringFrequency {
  return RECURRING_FREQUENCIES.includes(value as RecurringFrequency);
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function toIso(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Jatuh tempo berikutnya setelah `date`.
 *
 * Bulanan & tahunan mempertahankan TANGGAL ASLI kapan pun memungkinkan: cicilan
 * tanggal 31 yang lewat Februari kembali ke 31 pada bulan berikutnya, bukan
 * terkunci di 28 selamanya. Itu berbeda dari menambahkan interval berulang kali
 * ke hasil terakhir, dan sesuai harapan orang terhadap "tanggal 31 tiap bulan".
 */
export function nextRecurringDate(
  date: string,
  frequency: RecurringFrequency,
  anchorDay?: number
): string {
  if (!isIsoDate(date)) return date;

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));

  if (frequency === "weekly") {
    const shifted = new Date(year, month - 1, day + 7);
    return toIso(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
  }

  const wanted = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : day;

  if (frequency === "yearly") {
    const nextYear = year + 1;
    return toIso(nextYear, month, Math.min(wanted, daysInMonth(nextYear, month)));
  }

  const nextMonthIndex = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return toIso(nextYear, nextMonthIndex, Math.min(wanted, daysInMonth(nextYear, nextMonthIndex)));
}

/**
 * Daftar jatuh tempo dari `start` sampai `horizon` (inklusif).
 *
 * Dipakai pratinjau UI dan uji generator. Batas 60 iterasi menyamai penjaga
 * yang sama di RPC supaya keduanya tidak pernah berbeda hasil.
 */
export function dueDatesUntil(
  start: string,
  frequency: RecurringFrequency,
  horizon: string,
  endDate?: string | null
): string[] {
  if (!isIsoDate(start) || !isIsoDate(horizon)) return [];

  const anchorDay = Number(start.slice(8, 10));
  const dates: string[] = [];
  let cursor = start;

  for (let i = 0; i < 60 && cursor <= horizon; i++) {
    if (endDate && isIsoDate(endDate) && cursor > endDate) break;
    dates.push(cursor);
    cursor = nextRecurringDate(cursor, frequency, anchorDay);
  }

  return dates;
}

/** Selisih hari kalender (b − a). Positif = `b` di masa depan. */
export function daysBetween(a: string, b: string): number {
  if (!isIsoDate(a) || !isIsoDate(b)) return 0;
  const toUtc = (iso: string) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** "Jatuh tempo hari ini", "3 hari lagi", "Terlambat 2 hari". */
export function dueLabel(dueDate: string, today: string): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "Jatuh tempo hari ini";
  if (diff === 1) return "Besok";
  if (diff > 1) return `${diff} hari lagi`;
  if (diff === -1) return "Terlambat 1 hari";
  return `Terlambat ${Math.abs(diff)} hari`;
}

/** Geser tanggal ISO sebanyak `days` hari. */
export function shiftDate(date: string, days: number): string {
  if (!isIsoDate(date)) return date;
  const shifted = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)) + days
  );
  return toIso(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate());
}

/**
 * Berapa hari sebelum jatuh tempo sebuah tagihan mulai ditampilkan.
 *
 * Tujuh hari cukup untuk menyiapkan dana tanpa membuat daftar "akan datang"
 * penuh oleh tagihan yang masih jauh.
 */
export const RECURRING_LEAD_DAYS = 7;
