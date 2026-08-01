import { describe, it, expect } from "vitest";
import { parseSearchQuery, sanitizeSearchTerm, highlightParts } from "@/lib/search-query";

/** Tanggal acuan tetap supaya "agustus" tanpa tahun bisa diuji deterministik. */
const TODAY = "2026-08-15";

describe("mengurai nominal dari kata kunci", () => {
  it("membaca singkatan ribuan dan jutaan", () => {
    expect(parseSearchQuery("50rb", TODAY).amount).toBe(50_000);
    expect(parseSearchQuery("50 ribu", TODAY).amount).toBe(50_000);
    expect(parseSearchQuery("50k", TODAY).amount).toBe(50_000);
    expect(parseSearchQuery("2jt", TODAY).amount).toBe(2_000_000);
    expect(parseSearchQuery("2 juta", TODAY).amount).toBe(2_000_000);
  });

  it("membaca koma sebagai desimal pada singkatan", () => {
    expect(parseSearchQuery("1,5jt", TODAY).amount).toBe(1_500_000);
  });

  it("membaca titik sebagai pemisah ribuan", () => {
    expect(parseSearchQuery("Rp 250.000", TODAY).amount).toBe(250_000);
    expect(parseSearchQuery("1.500", TODAY).amount).toBe(1_500);
  });

  it("memberi toleransi minimal Rp 500 agar harga ganjil tetap ketemu", () => {
    const parsed = parseSearchQuery("50rb", TODAY);
    expect(parsed.amountTolerance).toBe(500);
    const besar = parseSearchQuery("2jt", TODAY);
    expect(besar.amountTolerance).toBe(20_000);
  });

  /**
   * Angka kecil tanpa sufiks lebih mungkin kuantitas ("beras 2") daripada
   * nominal Rp 2 — memperlakukannya sebagai uang membuat pencarian nama
   * barang yang mengandung angka menjadi kosong.
   */
  it("tidak memperlakukan angka kecil sebagai nominal", () => {
    const parsed = parseSearchQuery("beras 2", TODAY);
    expect(parsed.amount).toBeUndefined();
    expect(parsed.text).toBe("beras 2");
  });

  it("mengangkat nominal dan menyisakan teksnya", () => {
    const parsed = parseSearchQuery("indomaret 50rb", TODAY);
    expect(parsed.amount).toBe(50_000);
    expect(parsed.text).toBe("indomaret");
  });
});

describe("mengurai bulan & tanggal", () => {
  it("membaca nama bulan tanpa tahun sebagai tahun berjalan", () => {
    const parsed = parseSearchQuery("agustus", TODAY);
    expect(parsed.dateFrom).toBe("2026-08-01");
    expect(parsed.dateTo).toBe("2026-08-31");
    expect(parsed.text).toBe("");
  });

  it("membaca nama bulan beserta tahunnya", () => {
    const parsed = parseSearchQuery("agustus 2025", TODAY);
    expect(parsed.dateFrom).toBe("2025-08-01");
    expect(parsed.dateTo).toBe("2025-08-31");
  });

  it("membaca singkatan bulan", () => {
    expect(parseSearchQuery("des", TODAY).dateFrom).toBe("2026-12-01");
    expect(parseSearchQuery("feb", TODAY).dateTo).toBe("2026-02-28");
  });

  it("membaca bulan format ISO", () => {
    const parsed = parseSearchQuery("2026-02", TODAY);
    expect(parsed.dateFrom).toBe("2026-02-01");
    expect(parsed.dateTo).toBe("2026-02-28");
  });

  it("membaca tanggal penuh format ISO", () => {
    const parsed = parseSearchQuery("2026-08-17", TODAY);
    expect(parsed.dateFrom).toBe("2026-08-17");
    expect(parsed.dateTo).toBe("2026-08-17");
  });

  it("membaca tanggal gaya Indonesia", () => {
    const parsed = parseSearchQuery("17/08/2026", TODAY);
    expect(parsed.dateFrom).toBe("2026-08-17");
    expect(parsed.dateTo).toBe("2026-08-17");
  });

  /**
   * Tanggal diangkat SEBELUM nominal. Tanpa urutan itu, "agustus 2026" akan
   * membaca "2026" sebagai nominal Rp 2.026 dan hasilnya selalu kosong.
   */
  it("tidak salah membaca tahun sebagai nominal", () => {
    const parsed = parseSearchQuery("agustus 2026", TODAY);
    expect(parsed.amount).toBeUndefined();
    expect(parsed.dateFrom).toBe("2026-08-01");
  });

  it("menggabungkan teks, bulan, dan nominal sekaligus", () => {
    const parsed = parseSearchQuery("beras agustus 50rb", TODAY);
    expect(parsed.text).toBe("beras");
    expect(parsed.dateFrom).toBe("2026-08-01");
    expect(parsed.amount).toBe(50_000);
    expect(parsed.hints).toHaveLength(2);
  });
});

describe("kata kunci biasa", () => {
  it("meneruskan teks apa adanya", () => {
    const parsed = parseSearchQuery("indomaret", TODAY);
    expect(parsed.text).toBe("indomaret");
    expect(parsed.amount).toBeUndefined();
    expect(parsed.dateFrom).toBeUndefined();
    expect(parsed.hints).toEqual([]);
  });

  it("menangani masukan kosong", () => {
    expect(parseSearchQuery("", TODAY)).toEqual({ text: "", hints: [] });
    expect(parseSearchQuery("   ", TODAY).text).toBe("");
  });
});

describe("membersihkan kata kunci untuk PostgREST", () => {
  /**
   * `%` dan `_` adalah wildcard ilike; koma dan kurung memisahkan argumen di
   * dalam `.or(...)`. Satu tanda kurung yang lolos bisa membuat SELURUH
   * ekspresi filter gagal di-parse, bukan sekadar memberi hasil aneh.
   */
  it("membuang karakter yang punya arti khusus", () => {
    expect(sanitizeSearchTerm("50%")).toBe("50");
    expect(sanitizeSearchTerm("a,b")).toBe("a b");
    expect(sanitizeSearchTerm("beras (premium)")).toBe("beras premium");
    expect(sanitizeSearchTerm("id.eq.1")).toBe("id eq 1");
    expect(sanitizeSearchTerm('nama"aneh"')).toBe("nama aneh");
  });

  it("merapikan spasi berlebih", () => {
    expect(sanitizeSearchTerm("  beras   merah  ")).toBe("beras merah");
  });
});

describe("penyorotan kata yang cocok", () => {
  it("memecah teks menjadi bagian cocok dan tidak", () => {
    expect(highlightParts("Beras Premium", "beras")).toEqual([
      { text: "Beras", match: true },
      { text: " Premium", match: false },
    ]);
  });

  it("menemukan semua kemunculan", () => {
    const parts = highlightParts("ayam ayam", "ayam");
    expect(parts.filter((p) => p.match)).toHaveLength(2);
  });

  it("mempertahankan huruf besar-kecil aslinya", () => {
    const parts = highlightParts("INDOMARET Cabang", "indomaret");
    expect(parts[0]).toEqual({ text: "INDOMARET", match: true });
  });

  it("mengembalikan teks utuh bila tidak ada kata kunci", () => {
    expect(highlightParts("Beras", "")).toEqual([{ text: "Beras", match: false }]);
    expect(highlightParts("Beras", "gula")).toEqual([{ text: "Beras", match: false }]);
  });
});
