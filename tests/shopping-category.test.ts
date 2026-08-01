import { describe, it, expect } from "vitest";
import {
  guessItemCategory,
  resolveItemCategory,
  groupByCategory,
  isShoppingCategory,
  priceTrend,
  priceChangePercent,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABELS,
} from "@/lib/shopping-category";

describe("menebak kelompok rak dari nama barang", () => {
  it("mengenali bahan segar", () => {
    expect(guessItemCategory("Bayam")).toBe("sayur_buah");
    expect(guessItemCategory("Pisang Cavendish")).toBe("sayur_buah");
    expect(guessItemCategory("Ayam potong")).toBe("daging_ikan");
    expect(guessItemCategory("Ikan nila 1 kg")).toBe("daging_ikan");
  });

  it("mengenali sembako dan susu", () => {
    expect(guessItemCategory("Beras premium")).toBe("sembako");
    expect(guessItemCategory("Minyak goreng")).toBe("sembako");
    expect(guessItemCategory("Susu UHT")).toBe("susu_telur");
    expect(guessItemCategory("Telur ayam")).toBe("susu_telur");
  });

  it("mengenali non-makanan", () => {
    expect(guessItemCategory("Sabun mandi")).toBe("kebersihan");
    expect(guessItemCategory("Detergen bubuk")).toBe("kebersihan");
    expect(guessItemCategory("Popok bayi")).toBe("bayi_anak");
  });

  /**
   * Frasa dua kata diperiksa lebih dulu. Tanpa itu "minyak telon" akan
   * tertangkap kata "minyak" dan masuk Sembako, bukan Bayi & Anak.
   */
  it("mendahulukan frasa dua kata", () => {
    expect(guessItemCategory("Minyak telon")).toBe("bayi_anak");
    expect(guessItemCategory("Minyak goreng")).toBe("sembako");
    expect(guessItemCategory("Pasta gigi")).toBe("kebersihan");
  });

  it("tidak peduli urutan kata maupun huruf besar-kecil", () => {
    expect(guessItemCategory("GORENG MINYAK")).toBe("sembako");
    expect(guessItemCategory("  beras  ")).toBe("sembako");
  });

  /**
   * Pencocokan kata utuh, bukan substring: "abon" tidak boleh tertangkap
   * "sabun", dan "sus" tidak boleh tertangkap "susu".
   */
  it("mencocokkan kata utuh saja", () => {
    expect(guessItemCategory("Abon sapi")).toBe("daging_ikan");
    expect(guessItemCategory("Kabel data")).toBe("lainnya");
  });

  it("jatuh ke lainnya tanpa menebak paksa", () => {
    expect(guessItemCategory("Sekrup 5mm")).toBe("lainnya");
    expect(guessItemCategory("")).toBe("lainnya");
  });
});

describe("kategori tersimpan vs tebakan", () => {
  it("mendahulukan kategori yang sudah diisi manual", () => {
    expect(resolveItemCategory("kebersihan", "Beras")).toBe("kebersihan");
  });

  it("menebak dari nama bila kolomnya kosong atau tidak valid", () => {
    expect(resolveItemCategory(null, "Beras")).toBe("sembako");
    expect(resolveItemCategory("kategori_karangan", "Beras")).toBe("sembako");
  });

  it("mengenali hanya kategori yang terdaftar", () => {
    expect(isShoppingCategory("sembako")).toBe(true);
    expect(isShoppingCategory("elektronik")).toBe(false);
  });

  it("punya label untuk setiap kategori", () => {
    for (const key of SHOPPING_CATEGORIES) {
      expect(SHOPPING_CATEGORY_LABELS[key]).toBeTruthy();
    }
  });
});

describe("pengelompokan checklist", () => {
  const items = [
    { name: "Sabun", category: "kebersihan" as const },
    { name: "Beras", category: "sembako" as const },
    { name: "Bayam", category: "sayur_buah" as const },
    { name: "Gula", category: "sembako" as const },
  ];

  it("mengikuti urutan rak toko, bukan urutan pengetikan", () => {
    const groups = groupByCategory(items, (item) => item.category);
    expect(groups.map((g) => g.key)).toEqual(["sayur_buah", "sembako", "kebersihan"]);
  });

  it("mempertahankan urutan asli di dalam kelompok", () => {
    const groups = groupByCategory(items, (item) => item.category);
    const sembako = groups.find((g) => g.key === "sembako")!;
    expect(sembako.items.map((i) => i.name)).toEqual(["Beras", "Gula"]);
  });

  it("tidak mengembalikan kelompok kosong", () => {
    const groups = groupByCategory(items, (item) => item.category);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups).toHaveLength(3);
  });

  it("menangani daftar kosong", () => {
    expect(groupByCategory([], () => "lainnya" as const)).toEqual([]);
  });
});

describe("indikator perubahan harga", () => {
  it("menandai naik dan turun di luar ambang 2%", () => {
    expect(priceTrend(11_000, 10_000)).toBe("up");
    expect(priceTrend(9_000, 10_000)).toBe("down");
  });

  /** Selisih recehan tidak berarti apa-apa bagi pengguna. */
  it("mengabaikan selisih di bawah ambang", () => {
    expect(priceTrend(10_100, 10_000)).toBe("flat");
    expect(priceTrend(9_900, 10_000)).toBe("flat");
    expect(priceTrend(10_000, 10_000)).toBe("flat");
  });

  it("diam bila tidak ada acuan yang masuk akal", () => {
    expect(priceTrend(10_000, 0)).toBe("flat");
    expect(priceTrend(0, 10_000)).toBe("flat");
    expect(priceTrend(NaN, 10_000)).toBe("flat");
  });

  it("menghitung persentase perubahan", () => {
    expect(priceChangePercent(12_000, 10_000)).toBe(20);
    expect(priceChangePercent(8_000, 10_000)).toBe(-20);
    expect(priceChangePercent(10_000, 0)).toBeNull();
  });
});
