import { describe, expect, it } from "vitest";
import {
  DIFFERENCE_LINE,
  computeReceiptTotals,
  lineTotal,
  toQty,
  toTransactionItems,
  toWholeRupiah,
} from "@/lib/shopping-receipt";
import { reconcileReceipt } from "@/lib/receipt-reconcile";

describe("toWholeRupiah", () => {
  it("membulatkan dan menolak nilai tidak masuk akal", () => {
    expect(toWholeRupiah(1234.6)).toBe(1235);
    expect(toWholeRupiah(-500)).toBe(0);
    expect(toWholeRupiah(Number.NaN)).toBe(0);
    expect(toWholeRupiah("2000")).toBe(2000);
  });
});

describe("lineTotal", () => {
  it("membulatkan hasil kali sekali saja, bukan operandnya", () => {
    // 0,472 kg × Rp64.900 = 30.632,8 → 30.633
    const line = lineTotal({ name: "Apel Fuji", qty: 0.472, price: 64900 });
    expect(line.gross).toBe(30633);
    expect(line.subtotal).toBe(30633);
  });

  it("membatasi diskon baris agar subtotal tidak pernah negatif", () => {
    const line = lineTotal({ name: "Susu", qty: 1, price: 3500, discount: 99999 });
    expect(line.discount).toBe(3500);
    expect(line.subtotal).toBe(0);
  });

  it("kuantitas nol menghasilkan baris nol, bukan NaN", () => {
    expect(toQty(0)).toBe(0);
    expect(lineTotal({ name: "x", qty: 0, price: 1000 }).subtotal).toBe(0);
  });
});

describe("computeReceiptTotals", () => {
  const items = [
    { name: "Ultra Milk 125ml", qty: 40, price: 3500, discount: 12000 },
    { name: "Simba Choco Chips", qty: 1, price: 39500 },
  ];

  it("menjumlahkan subtotal dan potongan per barang", () => {
    const totals = computeReceiptTotals({ items });
    expect(totals.totalBeforeDiscount).toBe(140000 + 39500);
    expect(totals.itemDiscountTotal).toBe(12000);
    expect(totals.totalCalculated).toBe(167500);
  });

  it("barang tambahan ikut dihitung penuh", () => {
    const totals = computeReceiptTotals({
      items,
      extras: [{ name: "Parkir snack", qty: 2, price: 5000 }],
    });
    expect(totals.extrasTotal).toBe(10000);
    expect(totals.totalCalculated).toBe(177500);
  });

  it("diskon transaksi, voucher, dan biaya diterapkan berurutan", () => {
    const totals = computeReceiptTotals({
      items,
      transactionDiscount: 5000,
      voucher: 16000,
      fees: 2000,
    });
    // 179.500 − 12.000 − 5.000 − 16.000 + 2.000
    expect(totals.discountTotal).toBe(33000);
    expect(totals.totalCalculated).toBe(148500);
  });

  it("potongan tidak pernah membuat total negatif", () => {
    const totals = computeReceiptTotals({
      items: [{ name: "Permen", qty: 1, price: 1000 }],
      voucher: 500000,
    });
    expect(totals.totalCalculated).toBe(0);
  });

  it("menghitung selisih tanpa mengubah angka rincian", () => {
    const totals = computeReceiptTotals({ items, totalPaid: 167000 });
    expect(totals.totalCalculated).toBe(167500);
    expect(totals.difference).toBe(-500);
    expect(totals.balanced).toBe(false);
    // Harga barang TIDAK ikut disesuaikan diam-diam.
    expect(totals.lines[1].price).toBe(39500);
  });

  it("dianggap seimbang bila total bayar belum diisi", () => {
    expect(computeReceiptTotals({ items }).balanced).toBe(true);
    expect(computeReceiptTotals({ items, totalPaid: 167500 }).balanced).toBe(true);
  });
});

describe("toTransactionItems", () => {
  it("menulis diskon, voucher, dan selisih sebagai baris tersendiri", () => {
    const totals = computeReceiptTotals({
      items: [{ name: "Beras", qty: 1, price: 100000 }],
      transactionDiscount: 5000,
      voucher: 10000,
      fees: 2000,
      totalPaid: 87500,
    });
    const rows = toTransactionItems(totals);

    expect(rows.find((r) => r.name === "Diskon transaksi")?.price).toBe(-5000);
    expect(rows.find((r) => r.name === "Voucher")?.price).toBe(-10000);
    expect(rows.find((r) => r.name === "Biaya tambahan")?.price).toBe(2000);
    // 100.000 − 15.000 + 2.000 = 87.000; dibayar 87.500 → selisih +500
    expect(rows.find((r) => r.name === DIFFERENCE_LINE)?.price).toBe(500);

    const sum = rows.reduce((acc, r) => acc + Math.round(r.qty * r.price), 0);
    expect(sum).toBe(totals.totalPaid);
  });

  it("tanpa penyesuaian, jumlah baris sama dengan total hitung", () => {
    const totals = computeReceiptTotals({
      items: [
        { name: "A", qty: 2, price: 1500 },
        { name: "B", qty: 1, price: 7000 },
      ],
    });
    const rows = toTransactionItems(totals);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((acc, r) => acc + Math.round(r.qty * r.price), 0)).toBe(
      totals.totalCalculated
    );
  });

  it("harga efektif barang sudah memperhitungkan diskon barisnya", () => {
    const totals = computeReceiptTotals({
      items: [{ name: "Ultra Milk", qty: 40, price: 3500, discount: 12000 }],
    });
    const [row] = toTransactionItems(totals);
    // (140.000 − 12.000) / 40 = 3.200
    expect(row.price).toBe(3200);
    expect(Math.round(row.qty * row.price)).toBe(128000);
  });
});

describe("reconcileReceipt", () => {
  it("mencocokkan hasil ekstraksi dengan angka yang tercetak di struk", () => {
    const result = reconcileReceipt({
      lines: [
        { qty: 40, price: 3500, lineTotal: 140000, discount: 12000, review: [] },
        { qty: 1, price: 39500, lineTotal: 39500, discount: 0, review: [] },
      ],
      printedItemCount: 2,
      printedSubtotal: 179500,
      printedDiscount: 12000,
      printedTotal: 167500,
    });

    expect(result.subtotal).toBe(179500);
    expect(result.balanced).toBe(true);
    expect(result.checks.every((c) => c.matched)).toBe(true);
  });

  it("melaporkan selisih ketika satu digit salah terbaca", () => {
    const result = reconcileReceipt({
      lines: [{ qty: 1, price: 39900, lineTotal: 39900, discount: 0, review: [] }],
      printedSubtotal: 39500,
      printedTotal: 39500,
    });

    expect(result.balanced).toBe(false);
    const subtotalCheck = result.checks.find((c) => c.label === "Total sebelum diskon");
    expect(subtotalCheck?.difference).toBe(400);
  });

  it("melewati pemeriksaan yang angkanya tidak tercetak", () => {
    const result = reconcileReceipt({
      lines: [{ qty: 1, price: 1000, lineTotal: 1000, discount: 0, review: [] }],
    });
    expect(result.checks).toHaveLength(0);
    expect(result.balanced).toBe(true);
  });

  it("menghitung baris yang perlu ditinjau", () => {
    const result = reconcileReceipt({
      lines: [
        { qty: 1, price: 1000, lineTotal: 1000, discount: 0, review: [] },
        { qty: 1, price: 0, lineTotal: 0, discount: 0, review: ["Harga satuan kosong"] },
      ],
    });
    expect(result.reviewCount).toBe(1);
  });
});
