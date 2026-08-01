import { describe, it, expect } from "vitest";
import { parseShoppingList, parseShoppingLine } from "@/lib/shopping-parser";
import { distributeTotal, sumItems } from "@/lib/shopping-total";
import { formatQtyValue, formatUnitQty, itemKey, normalizeUnit } from "@/lib/shopping-item";

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

  it("juga menerima daftar per baris", () => {
    const items = parseShoppingList("Beras 5 kg\nGula 1 kg\nKopi");
    expect(items.map((i) => i.name)).toEqual(["Beras", "Gula", "Kopi"]);
  });

  it("tidak memecah koma desimal maupun pemisah ribuan menjadi barang baru", () => {
    const items = parseShoppingList("Beras 1,5 kg, Minyak 2 liter Rp 18,500");
    expect(items).toEqual([
      { name: "Beras", qty: 1.5, unit: "kg", price: 0 },
      { name: "Minyak", qty: 2, unit: "liter", price: 18500 },
    ]);
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
    // Nama sengaja tanpa angka di ujung: "Barang 7" akan terbaca sebagai
    // barang "Barang" berjumlah 7, dan semuanya menyatu jadi satu baris.
    const text = Array.from({ length: 150 }, (_, i) => `Barang ke-${i + 1}`).join(", ");
    expect(parseShoppingList(text)).toHaveLength(100);
  });
});

describe("tempel daftar gaya rapi (Nama ; jumlah ; satuan)", () => {
  it("membaca contoh format rapi dari petunjuk di layar", () => {
    const items = parseShoppingList("Beras ; 5 ; kg\nMinyak Goreng ; 2 ; liter\nTelur ; 1 ; kg");

    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Minyak Goreng", qty: 2, unit: "liter", price: 0 },
      { name: "Telur", qty: 1, unit: "kg", price: 0 },
    ]);
  });

  it("membaca format rapi yang dipisahkan koma antar barang", () => {
    const items = parseShoppingList("Beras ; 5 ; kg, Minyak Goreng ; 2 ; liter, Telur ; 1 ; kg");

    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Minyak Goreng", qty: 2, unit: "liter", price: 0 },
      { name: "Telur", qty: 1, unit: "kg", price: 0 },
    ]);
  });

  it("membaca format rapi tanpa spasi di sekitar titik koma", () => {
    expect(parseShoppingList("Beras;5;kg\nTepung Roti;200;gram")).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Tepung Roti", qty: 200, unit: "gram", price: 0 },
    ]);
  });

  it("menerima kolom yang tidak lengkap tanpa menggagalkan barisnya", () => {
    expect(parseShoppingLine("Beras ; 5")).toEqual({ name: "Beras", qty: 5, unit: "", price: 0 });
    expect(parseShoppingLine("Sabun mandi ;")).toEqual({
      name: "Sabun mandi",
      qty: 1,
      unit: "",
      price: 0,
    });
  });

  it("membaca kolom keempat sebagai harga satuan", () => {
    expect(parseShoppingLine("Beras ; 5 ; kg ; 12000")).toEqual({
      name: "Beras",
      qty: 5,
      unit: "kg",
      price: 12000,
    });
    expect(parseShoppingLine("Beras ; 5 ; kg ; Rp12.000")).toMatchObject({ price: 12000 });
  });

  it("tidak mengupas angka dari nama barang pada gaya rapi", () => {
    // "Minyak Goreng 2 L" memang nama produknya; jumlahnya ada di kolom sendiri.
    expect(parseShoppingLine("Minyak Goreng 2 L ; 1 ; pcs")).toEqual({
      name: "Minyak Goreng 2 L",
      qty: 1,
      unit: "pcs",
      price: 0,
    });
  });

  it("tetap memisahkan barang bila titik komanya jelas bukan pemisah kolom", () => {
    // Kebiasaan lama: titik koma dipakai antar barang, bukan antar kolom.
    const items = parseShoppingList("Beras 5 kg; Gula 1 kg; Kopi");
    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Gula", qty: 1, unit: "kg", price: 0 },
      { name: "Kopi", qty: 1, unit: "", price: 0 },
    ]);
  });

  it("membaca beberapa barang bergaya rapi yang menumpuk di satu baris", () => {
    const items = parseShoppingList("Beras ; 5 ; kg; Gula ; 1 ; kg");
    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Gula", qty: 1, unit: "kg", price: 0 },
    ]);
  });

  it("membiarkan kedua gaya bercampur dalam satu tempelan, termasuk per baris", () => {
    const items = parseShoppingList("Beras ; 5 ; kg\nMinyak goreng 2 liter, Telur");
    expect(items).toEqual([
      { name: "Beras", qty: 5, unit: "kg", price: 0 },
      { name: "Minyak goreng", qty: 2, unit: "liter", price: 0 },
      { name: "Telur", qty: 1, unit: "", price: 0 },
    ]);
  });

  it("menggabungkan barang kembar dalam satu tempelan alih-alih menggandakannya", () => {
    const items = parseShoppingList("Beras 5 kg, beras 2 kg, Telur 1 kg");

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ name: "Beras", qty: 7, unit: "kg", price: 0 });
  });

  it("tetap membedakan barang bernama sama dengan satuan berbeda", () => {
    const items = parseShoppingList("Susu 2 kotak, Susu 1 liter");
    expect(items).toHaveLength(2);
  });

  it("membaca daftar belanja bulanan sungguhan apa adanya", () => {
    // Potongan daftar yang benar-benar ditempel Mamah: satuan campur, nama
    // panjang, dan angka besar seperti "275 ml" tidak boleh berubah.
    const items = parseShoppingList(
      [
        "Minyak Goreng ; 2 ; liter",
        "Indomie Ayam Bawang ; 3 ; pcs",
        "Tepung Roti ; 200 ; gram",
        "Kecap Manis ; 275 ; ml",
        "Sarden ; 2 ; kaleng",
        "Mie Gelas ; 1 ; pack",
        "Sikat Gigi Ortu ; 3 ; buah",
      ].join("\n")
    );

    expect(items).toEqual([
      { name: "Minyak Goreng", qty: 2, unit: "liter", price: 0 },
      { name: "Indomie Ayam Bawang", qty: 3, unit: "pcs", price: 0 },
      { name: "Tepung Roti", qty: 200, unit: "gram", price: 0 },
      { name: "Kecap Manis", qty: 275, unit: "ml", price: 0 },
      { name: "Sarden", qty: 2, unit: "kaleng", price: 0 },
      { name: "Mie Gelas", qty: 1, unit: "pack", price: 0 },
      { name: "Sikat Gigi Ortu", qty: 3, unit: "buah", price: 0 },
    ]);
  });
});

describe("penulisan nama, qty, dan satuan", () => {
  it("menulis kuantitas dengan koma desimal ala Indonesia", () => {
    expect(formatQtyValue(5)).toBe("5");
    expect(formatQtyValue(1.5)).toBe("1,5");
  });

  it("selalu memberi konteks pada angka kuantitas", () => {
    expect(formatUnitQty(5, "kg")).toBe("5 kg");
    expect(formatUnitQty(1, "pcs")).toBe("1 pcs");
    // Tanpa satuan: tanda kali, bukan angka telanjang dan bukan satuan karangan.
    expect(formatUnitQty(3, "")).toBe("3×");
    expect(formatUnitQty(3, null)).toBe("3×");
  });

  it("menyeragamkan satuan yang diketik pengguna", () => {
    expect(normalizeUnit("  KG ")).toBe("kg");
    expect(normalizeUnit(null)).toBe("");
  });

  it("menganggap nama yang sama dengan huruf berbeda sebagai barang yang sama", () => {
    expect(itemKey("Beras", "kg")).toBe(itemKey("  beras ", "KG"));
    expect(itemKey("Beras", "kg")).not.toBe(itemKey("Beras", "liter"));
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
