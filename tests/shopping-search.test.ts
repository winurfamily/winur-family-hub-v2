import { describe, expect, it } from "vitest";
import { buildHaystack, filterBySearch, matchesQuery, normalizeSearchText } from "@/lib/shopping-search";

const items = [
  { name: "Minyak Goreng Fortune", qty: 2, unit: "liter", categoryLabel: "Sembako" },
  { name: "Telur Ayam", qty: 1, unit: "kg", categoryLabel: "Protein" },
  { name: "Bayam", qty: 3, unit: "ikat", categoryLabel: "Sayur & Buah" },
  { name: "Sabun Mandi", qty: 4, unit: "", categoryLabel: "Kebersihan" },
  { name: "Apel Fuji", qty: 1.5, unit: "kg", categoryLabel: "Sayur & Buah" },
];

describe("normalizeSearchText", () => {
  it("menyeragamkan koma desimal menjadi titik", () => {
    expect(normalizeSearchText("1,5")).toBe("1.5");
    expect(normalizeSearchText("  Telur   Ayam ")).toBe("telur ayam");
  });
});

describe("buildHaystack", () => {
  it("memuat nama, jumlah, satuan, dan kategori", () => {
    const hay = buildHaystack(items[0]);
    expect(hay).toContain("minyak goreng fortune");
    expect(hay).toContain("2 liter");
    expect(hay).toContain("sembako");
  });

  it("barang tanpa satuan tetap bisa dicari lewat angkanya", () => {
    expect(buildHaystack(items[3])).toContain("4");
  });
});

describe("matchesQuery", () => {
  it("kueri kosong cocok dengan semuanya", () => {
    expect(matchesQuery(buildHaystack(items[0]), "")).toBe(true);
    expect(matchesQuery(buildHaystack(items[0]), "   ")).toBe(true);
  });

  it("urutan kata tidak berpengaruh", () => {
    const hay = buildHaystack(items[0]);
    expect(matchesQuery(hay, "minyak 2")).toBe(true);
    expect(matchesQuery(hay, "2 minyak")).toBe(true);
  });

  it("semua kata harus ditemukan", () => {
    expect(matchesQuery(buildHaystack(items[0]), "minyak telur")).toBe(false);
  });
});

describe("filterBySearch", () => {
  it("mencari berdasarkan nama barang", () => {
    expect(filterBySearch(items, "telur").map((i) => i.name)).toEqual(["Telur Ayam"]);
  });

  it("mencari berdasarkan satuan", () => {
    expect(filterBySearch(items, "kg").map((i) => i.name)).toEqual(["Telur Ayam", "Apel Fuji"]);
  });

  it("mencari berdasarkan jumlah", () => {
    expect(filterBySearch(items, "3").map((i) => i.name)).toEqual(["Bayam"]);
  });

  it("mencari berdasarkan jumlah + satuan sekaligus", () => {
    expect(filterBySearch(items, "2 liter").map((i) => i.name)).toEqual(["Minyak Goreng Fortune"]);
  });

  it("mencari berdasarkan kategori", () => {
    expect(filterBySearch(items, "sayur").map((i) => i.name)).toEqual(["Bayam", "Apel Fuji"]);
  });

  it("jumlah pecahan bisa ditulis dengan koma maupun titik", () => {
    expect(filterBySearch(items, "1,5").map((i) => i.name)).toEqual(["Apel Fuji"]);
    expect(filterBySearch(items, "1.5").map((i) => i.name)).toEqual(["Apel Fuji"]);
  });

  it("tidak peduli huruf besar/kecil", () => {
    expect(filterBySearch(items, "BAYAM")).toHaveLength(1);
  });

  it("kueri tanpa hasil mengembalikan daftar kosong", () => {
    expect(filterBySearch(items, "kulkas")).toEqual([]);
  });

  it("kueri kosong mengembalikan daftar apa adanya", () => {
    expect(filterBySearch(items, "")).toHaveLength(items.length);
  });

  it("tetap ringan untuk daftar 100 barang", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      name: `Barang ${i}`,
      qty: (i % 5) + 1,
      unit: i % 2 ? "kg" : "pcs",
      categoryLabel: "Sembako",
    }));
    const started = Date.now();
    for (let i = 0; i < 50; i++) filterBySearch(many, "barang 3");
    expect(Date.now() - started).toBeLessThan(500);
  });
});
