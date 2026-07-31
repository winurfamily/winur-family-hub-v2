export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Zona waktu tunggal aplikasi ini. Keluarganya di Indonesia, servernya UTC. */
export const APP_TIME_ZONE = "Asia/Jakarta";

/**
 * "YYYY-MM-DD" untuk sebuah instan, dibaca di zona waktu Indonesia.
 *
 * Memakai Intl (`en-CA` menghasilkan persis YYYY-MM-DD) dan BUKAN
 * `toISOString()`, karena toISOString selalu UTC: di browser WIB pukul 00:30
 * tanggal 1 Agustus ia mengembalikan 31 Juli. Hasil fungsi ini sama persis
 * di browser (WIB) maupun di server Vercel (UTC), sehingga tanggal default
 * form tidak pernah bergeser satu hari antara render server dan hidrasi.
 *
 * Ada cadangan offset tetap +07:00 kalau-kalau runtime tidak membawa data
 * zona waktu (Node build minimal tanpa full-icu) — WIB tidak mengenal DST,
 * jadi cadangan itu memberi hasil yang sama.
 */
export function toJakartaISODate(value: Date | number = Date.now()): string {
  const date = typeof value === "number" ? new Date(value) : value;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
  }
}

/**
 * Tanggal hari ini ("YYYY-MM-DD") menurut waktu Indonesia — nilai default
 * untuk seluruh form pencatatan (pendapatan, pengeluaran, transfer, rencana
 * belanja, selesaikan belanja, belanja manual, scan struk).
 *
 * Selalu dihitung dari jam sekarang, tidak pernah dari seed atau tanggal
 * transaksi terakhir, sehingga ikut berganti begitu harinya berganti.
 */
export function todayISODate(): string {
  return toJakartaISODate();
}

/** Bulan berjalan ("YYYY-MM") menurut waktu Indonesia. */
export function currentMonthISO(): string {
  return todayISODate().slice(0, 7);
}

/**
 * Susun "YYYY-MM-DD" dari komponen tanggal LOKAL sebuah Date.
 *
 * Dipakai oleh perhitungan yang menggeser tanggal dengan `setDate()`: hasilnya
 * harus dibaca kembali dengan komponen lokal juga, bukan lewat toISOString()
 * yang memindahkannya ke UTC dan bisa mundur sehari.
 */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

/** "2026-08-01" → 1 Agustus 2026. Tanggal polos TIDAK digeser zona waktu. */
export function formatDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Dibaca sebagai tanggal kalender apa adanya: `new Date("2026-08-01")`
    // adalah tengah malam UTC dan akan tampil sebagai 31 Juli di zona waktu
    // barat UTC. Tanggal transaksi tidak punya jam, jadi tidak boleh digeser.
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Cap waktu penuh (punya jam) — ditampilkan dalam waktu Indonesia. */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("id-ID", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-08" → "Agustus 2026". Dipakai label periode asal rekomendasi. */
export function formatMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}
