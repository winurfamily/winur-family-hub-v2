/**
 * Pengurai kata kunci pencarian transaksi — murni, tanpa database.
 *
 * Orang tidak mengetik "filter tanggal = Agustus 2026". Mereka mengetik
 * "agustus", "50rb", atau "1/8". Modul ini menerjemahkan ketikan apa adanya
 * menjadi tiga hal yang bisa dipakai query: sisa teks bebas, nominal, dan
 * rentang tanggal — sehingga satu kotak pencarian sudah cukup untuk mencari
 * nama, toko, barang, catatan, nominal, maupun bulan.
 *
 * Semua fungsi di sini murni supaya bisa diuji tanpa Supabase dan dipakai
 * bersama oleh server (membangun query) dan klien (menyorot kata yang cocok).
 */

import { monthRange } from "@/lib/period";

const MONTH_NAMES = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

/** Singkatan yang lazim ditulis orang Indonesia. */
const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  feb: 2,
  peb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  ags: 8,
  agt: 8,
  sep: 9,
  sept: 9,
  okt: 10,
  nov: 11,
  des: 12,
};

export interface ParsedSearch {
  /** Sisa kata kunci setelah nominal & tanggal diangkat. Boleh kosong. */
  text: string;
  /** Nominal yang dicari, bila ketikannya berupa angka/uang. */
  amount?: number;
  /**
   * Toleransi pencocokan nominal. "50rb" mencari 50.000 ± toleransi supaya
   * transaksi 49.900 tetap ketemu — orang mengingat harga secara bulat.
   */
  amountTolerance?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Label ringkas untuk ditampilkan sebagai chip "yang sedang dicari". */
  hints: string[];
}

const RUPIAH_SUFFIX: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000,
};

function monthIndexFrom(word: string): number | null {
  const clean = word.toLowerCase();
  const exact = MONTH_NAMES.indexOf(clean as (typeof MONTH_NAMES)[number]);
  if (exact >= 0) return exact + 1;
  return MONTH_ALIASES[clean] ?? null;
}

function isoMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Baca ketikan pencarian menjadi bagian-bagian yang bisa di-query.
 *
 * `today` diinjeksikan (bukan dibaca dari jam sistem) supaya hasilnya
 * deterministik dan bisa diuji: "agustus" tanpa tahun berarti Agustus pada
 * tahun berjalan.
 */
export function parseSearchQuery(raw: string, today = ""): ParsedSearch {
  const input = (raw ?? "").trim();
  const hints: string[] = [];
  if (!input) return { text: "", hints };

  const currentYear = /^\d{4}/.test(today) ? Number(today.slice(0, 4)) : new Date().getFullYear();

  let rest = input;
  let amount: number | undefined;
  let amountTolerance: number | undefined;
  let dateFrom: string | undefined;
  let dateTo: string | undefined;

  // --- Tanggal penuh: 2026-08-01, 1/8/2026, 01-08-2026 ----------------
  const isoDate = rest.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const localDate = rest.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);

  if (isoDate) {
    dateFrom = dateTo = isoDate[0];
    rest = rest.replace(isoDate[0], " ");
    hints.push(`tanggal ${dateFrom}`);
  } else if (localDate) {
    const day = String(Number(localDate[1])).padStart(2, "0");
    const month = String(Number(localDate[2])).padStart(2, "0");
    dateFrom = dateTo = `${localDate[3]}-${month}-${day}`;
    rest = rest.replace(localDate[0], " ");
    hints.push(`tanggal ${dateFrom}`);
  } else {
    // --- Bulan: "2026-08", "agustus", "agustus 2026" ------------------
    const isoMonthMatch = rest.match(/\b(\d{4})-(\d{2})\b/);
    if (isoMonthMatch) {
      const range = monthRange(isoMonthMatch[0]);
      dateFrom = range.start;
      dateTo = range.end;
      rest = rest.replace(isoMonthMatch[0], " ");
      hints.push(`bulan ${isoMonthMatch[0]}`);
    } else {
      for (const word of rest.split(/\s+/)) {
        const month = monthIndexFrom(word);
        if (month === null) continue;

        // Tahun opsional tepat setelah nama bulan.
        const yearMatch = rest.match(new RegExp(`${word}\\s+(\\d{4})`, "i"));
        const year = yearMatch ? Number(yearMatch[1]) : currentYear;
        const key = isoMonth(year, month);
        const range = monthRange(key);

        dateFrom = range.start;
        dateTo = range.end;
        rest = rest.replace(new RegExp(`${word}(\\s+\\d{4})?`, "i"), " ");
        hints.push(`bulan ${MONTH_NAMES[month - 1]} ${year}`);
        break;
      }
    }
  }

  // --- Nominal: "50rb", "1,5jt", "Rp 250.000", "250000" ---------------
  // Dijalankan SETELAH tanggal supaya "2026" pada "agustus 2026" sudah
  // terangkat dan tidak salah dibaca sebagai nominal Rp 2.026.
  const amountMatch = rest.match(/(?:rp\s*)?(\d[\d.,]*)\s*(rb|ribu|jt|juta|k|m)?\b/i);
  if (amountMatch) {
    const suffix = amountMatch[2]?.toLowerCase();
    const digits = amountMatch[1];

    // "1.500" adalah seribu lima ratus; "1,5jt" adalah satu setengah juta.
    // Titik selalu pemisah ribuan di Indonesia, koma selalu desimal.
    const numeric = suffix
      ? Number(digits.replace(/\./g, "").replace(",", "."))
      : Number(digits.replace(/[.,]/g, ""));

    if (Number.isFinite(numeric) && numeric > 0) {
      const value = Math.round(numeric * (suffix ? RUPIAH_SUFFIX[suffix] ?? 1 : 1));
      // Nominal hanya diperlakukan sebagai nominal bila memang terlihat seperti
      // uang: bersufiks, atau minimal ratusan. Angka "2" pada "beras 2" lebih
      // mungkin kuantitas daripada Rp 2.
      if (suffix || value >= 100) {
        amount = value;
        // Toleransi 1% (minimal Rp 500) menutup pembulatan dan harga ganjil.
        amountTolerance = Math.max(500, Math.round(value * 0.01));
        rest = rest.replace(amountMatch[0], " ");
        hints.push(`nominal ${value.toLocaleString("id-ID")}`);
      }
    }
  }

  return {
    text: rest.replace(/\s+/g, " ").trim(),
    amount,
    amountTolerance,
    dateFrom,
    dateTo,
    hints,
  };
}

/**
 * Buang karakter yang punya arti khusus di filter PostgREST.
 *
 * `%` dan `_` adalah wildcard `ilike`; koma, tanda kurung, dan titik memisahkan
 * argumen di dalam `.or(...)`. Membiarkannya lewat bukan cuma memberi hasil
 * aneh — satu tanda kurung bisa membuat seluruh ekspresi filter gagal parse.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_,().*:"'\\]/g, " ").replace(/\s+/g, " ").trim();
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Pecah teks menjadi potongan cocok / tidak cocok untuk disorot di UI.
 *
 * Pencocokan tidak peka huruf besar-kecil dan mempertahankan huruf asli teks
 * sumber, sehingga "beras" menyorot "Beras Premium" tanpa mengubah tampilannya.
 */
export function highlightParts(text: string, term: string): HighlightPart[] {
  const needle = (term ?? "").trim().toLowerCase();
  if (!needle || !text) return [{ text: text ?? "", match: false }];

  const parts: HighlightPart[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;

  for (;;) {
    const index = haystack.indexOf(needle, cursor);
    if (index === -1) break;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
