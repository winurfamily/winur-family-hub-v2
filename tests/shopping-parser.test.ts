import { describe, it, expect } from "vitest";
import { parseShoppingList, parseShoppingLine } from "@/lib/shopping-parser";
import { distributeTotal, sumItems } from "@/lib/shopping-total";

describe("tempel daftar belanja (pemisah koma)", () => {
  it("memecah contoh dari pengguna menjadi lima barang dengan jumlah & satuan", () => {
    const items = parseShoppingList(
      "Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi, Susu anak 2 kotak"
    );

    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Minyak goreng", qty: 2, unit: "liter", price: 0 },
      { name: "Telur", qty: 1, unit: "kg", price: 0 },
      { name: "Sabun mandi", qty: 1, unit: "", price: 0 },
      { name: "Susu anak", qty: 2, unit: "kotak", price: 0 },
    ]);
  });

  it("membuang spasi berlebih dan mengabaikan potongan kosong", () => {
    const items = parseShoppingList("  Beras   5   kg ,,   , Gula  ,  ");

    expect(items.map((i) => i.name)).toEqual(["Beras", "Gula"]);
    expect(items[0].qty).toBe(5);
  });

  it("juga menerima daftar per baris dan titik koma", () => {
    const items = parseShoppingList("Beras 5 kg\nGula 1 kg; Kopi");
    expect(items.map((i) => i.name)).toEqual(["Beras", "Gula", "Kopi"]);
  });

  it("membaca harga dari @ maupun Rp, dengan pemisah ribuan", () => {
    expect(parseShoppingLine("Beras 5 kg @72.000")).toEqual({
      name: "Beras",
      qty: 5,
      unit: "kg",
      price: 72000,
    });
    expect(parseShoppingLine("Minyak 2 liter Rp 18,500")).toEqual({
      name: "Minyak",
      qty: 2,
      unit: "liter",
      price: 18500,
    });
  });

  it("mengerti bentuk '2x Susu' dan angka polos di akhir", () => {
    expect(parseShoppingLine("2x Susu")).toMatchObject({ name: "Susu", qty: 2 });
    expect(parseShoppingLine("Telur 3")).toMatchObject({ name: "Telur", qty: 3 });
  });

  it("memberi kuantitas 1 saat tidak disebutkan, tidak pernah 0", () => {
    expect(parseShoppingLine("Sabun mandi")).toMatchObject({ qty: 1 });
    expect(parseShoppingLine("Sabun 0 kg")).toMatchObject({ qty: 1 });
  });

  it("mengembalikan daftar kosong untuk teks kosong", () => {
    expect(parseShoppingList("")).toEqual([]);
    expect(parseShoppingList("   ,,,  ")).toEqual([]);
  });

  it("membatasi jumlah barang agar tempelan raksasa tidak membanjiri rencana", () => {
    const text = Array.from({ length: 150 }, (_, i) => `Barang ${i + 1}`).join(", ");
    expect(parseShoppingList(text)).toHaveLength(100);
  });
});

describe("penyelarasan total belanja dengan yang dibayar di kasir", () => {
  const items = [
    { name: "Beras", qty: 5, price: 12000 },
    { name: "Minyak", qty: 2, price: 18000 },
  ];

  it("membiarkan daftar apa adanya bila total tidak diisi", () => {
    expect(distributeTotal(items, 0)).toEqual(items);
    expect(distributeTotal(items, -1)).toEqual(items);
  });

  it("menskalakan harga proporsional saat semua barang sudah berharga", () => {
    const result = distributeTotal(items, 100_000);
    expect(sumItems(result)).toBe(100_000);
    // Beras (60% dari 96.000) tetap porsi terbesar setelah diskala.
    expect(result[0].price).toBeGreaterThan(result[1].price / 2);
  });

  it("menghormati harga yang sudah diisi dan hanya membagi sisanya ke yang kosong", () => {
    // Kasus nyata: checklist tanpa harga + satu barang tambahan berharga.
    const campuran = [
      { name: "Beras", qty: 5, price: 0 },
      { name: "Minyak", qty: 2, price: 0 },
      { name: "Sabun", qty: 1, price: 0 },
      { name: "Kantong", qty: 1, price: 2_000 },
    ];
    const result = distributeTotal(campuran, 187_500);

    expect(sumItems(result)).toBe(187_500);
    // Harga yang diketik pengguna tidak boleh berubah…
    expect(result[3].price).toBe(2_000);
    // …dan barang lain TIDAK boleh berakhir Rp0.
    expect(result[0].price).toBeGreaterThan(0);
    expect(result[1].price).toBeGreaterThan(0);
    expect(result[2].price).toBeGreaterThan(0);
  });

  it("kembali ke skala proporsional bila harga terisi sudah melebihi total", () => {
    const kelebihan = [
      { name: "A", qty: 1, price: 300_000 },
      { name: "B", qty: 1, price: 0 },
    ];
    const result = distributeTotal(kelebihan, 100_000);
    expect(sumItems(result)).toBe(100_000);
    expect(result.every((item) => item.price >= 0)).toBe(true);
  });

  it("membagi rata berdasarkan kuantitas saat harga masih nol semua", () => {
    const kosong = [
      { name: "A", qty: 1, price: 0 },
      { name: "B", qty: 3, price: 0 },
    ];
    const result = distributeTotal(kosong, 40_000);
    expect(sumItems(result)).toBe(40_000);
    expect(result[0].price).toBe(10_000);
    expect(result[1].price).toBe(10_000);
  });

  it("tidak pernah menghasilkan harga negatif walau total jauh lebih kecil", () => {
    const result = distributeTotal(items, 1_000);
    expect(sumItems(result)).toBe(1_000);
    expect(result.every((item) => item.price >= 0)).toBe(true);
  });

  it("menyerap sisa pembulatan sehingga tidak ada selisih receh", () => {
    const ganjil = [
      { name: "A", qty: 3, price: 1_000 },
      { name: "B", qty: 7, price: 1_000 },
    ];
    for (const target of [9_999, 10_001, 33_333]) {
      expect(sumItems(distributeTotal(ganjil, target))).toBe(target);
    }
  });
});
