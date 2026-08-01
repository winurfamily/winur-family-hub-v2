/**
 * Pencocokan hasil ekstraksi struk dengan angka yang TERCETAK di struk itu.
 *
 * Struk mencetak totalnya sendiri (TOTAL SUM, TOTAL DISKON, voucher, TOTAL
 * HARUS DIBAYAR, TOTAL_ITEM). Angka-angka itu adalah pemeriksa silang terbaik
 * yang tersedia: kalau jumlah baris yang berhasil dibaca tidak sama dengan
 * yang dicetak kasir, ada digit yang salah terbaca — dan pada struk
 * dot-matrix hasil pindai, itu bukan kemungkinan yang jauh.
 *
 * Modul ini TIDAK PERNAH memperbaiki angka. Tugasnya hanya menghitung selisih
 * dan menamainya, supaya layar review bisa menunjukkannya kepada manusia
 * sebelum apa pun tersimpan.
 *
 * Murni & tanpa I/O supaya bisa diuji langsung.
 */

export interface ReconcileLine {
  qty: number;
  price: number;
  /** Total baris menurut struk; 0 bila tidak tercetak. */
  lineTotal: number;
  discount: number;
  review: string[];
}

export interface ReconcileInput {
  lines: ReconcileLine[];
  printedSubtotal?: number;
  printedDiscount?: number;
  printedVoucher?: number;
  printedTotal?: number;
  printedItemCount?: number;
}

export interface ReconcileCheck {
  label: string;
  /** Yang dihitung dari baris hasil ekstraksi. */
  extracted: number;
  /** Yang tercetak di struk. 0/undefined = tidak tercetak, cek dilewati. */
  printed: number;
  difference: number;
  matched: boolean;
}

export interface ReconcileResult {
  /** Σ total baris (memakai lineTotal bila ada, selain itu qty × harga). */
  subtotal: number;
  /** Σ potongan per baris. */
  itemDiscount: number;
  lineCount: number;
  /** Baris yang perlu ditinjau manusia. */
  reviewCount: number;
  checks: ReconcileCheck[];
  /** Semua pemeriksaan yang bisa dilakukan cocok. */
  balanced: boolean;
}

/** Total satu baris: pakai angka struk bila ada, selain itu hitung sendiri. */
export function resolveLineTotal(line: ReconcileLine): number {
  return line.lineTotal > 0 ? line.lineTotal : Math.round(line.qty * line.price);
}

function check(label: string, extracted: number, printed: number | undefined): ReconcileCheck | null {
  // Angka yang tidak tercetak bukan ketidakcocokan — tidak semua struk
  // mencetak semua baris total.
  if (!printed || printed <= 0) return null;
  const difference = extracted - printed;
  return { label, extracted, printed, difference, matched: difference === 0 };
}

export function reconcileReceipt(input: ReconcileInput): ReconcileResult {
  const lines = input.lines ?? [];

  const subtotal = lines.reduce((acc, line) => acc + resolveLineTotal(line), 0);
  const itemDiscount = lines.reduce((acc, line) => acc + Math.max(0, line.discount), 0);
  const reviewCount = lines.filter((line) => line.review.length > 0).length;

  const voucher = Math.max(0, input.printedVoucher ?? 0);
  const printedDiscount = Math.max(0, input.printedDiscount ?? 0);

  // Total akhir menurut hasil ekstraksi: subtotal − diskon − voucher.
  // Diskon yang dipakai adalah yang TERCETAK bila ada, karena itulah angka
  // yang dipertanggungjawabkan kasir; kalau tidak ada, jatuh ke jumlah
  // potongan per baris.
  const effectiveDiscount = printedDiscount > 0 ? printedDiscount : itemDiscount;
  const finalTotal = Math.max(0, subtotal - effectiveDiscount - voucher);

  const checks = [
    check("Jumlah item", lines.length, input.printedItemCount),
    check("Total sebelum diskon", subtotal, input.printedSubtotal),
    check("Total diskon", itemDiscount, input.printedDiscount),
    check("Total akhir", finalTotal, input.printedTotal),
  ].filter((c): c is ReconcileCheck => c !== null);

  return {
    subtotal,
    itemDiscount,
    lineCount: lines.length,
    reviewCount,
    checks,
    balanced: checks.every((c) => c.matched),
  };
}
