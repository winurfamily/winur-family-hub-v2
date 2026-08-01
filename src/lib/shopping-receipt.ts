/**
 * Perhitungan penyelesaian belanja — satu-satunya rumus, dipakai client & server.
 *
 * Tiga aturan yang membentuk modul ini:
 *
 *  1. **Hanya barang "sudah dibeli" yang dihitung.** Barang yang masih
 *     `pending` (belum dicentang) dan `cancelled` (tidak jadi dibeli) TIDAK
 *     pernah masuk total. Versi sebelumnya menghitung semua yang bukan
 *     `cancelled`, sehingga barang yang tidak jadi diambil dari rak tetap
 *     dibayar di pembukuan.
 *
 *  2. **Rupiah selalu bilangan bulat.** Tidak ada `float` yang dibiarkan hidup:
 *     setiap subtotal dibulatkan pada barisnya sendiri, lalu dijumlahkan
 *     sebagai integer. Kuantitas boleh pecahan (0,472 kg apel) — hasil kalinya
 *     yang dibulatkan, bukan operandnya.
 *
 *  3. **Selisih ditampilkan, bukan disembunyikan.** Bila jumlah rincian tidak
 *     sama dengan yang benar-benar dibayar di kasir, angkanya TIDAK diam-diam
 *     diubah agar cocok. Selisihnya dikembalikan apa adanya supaya UI bisa
 *     menanyakannya lebih dulu kepada pengguna.
 *
 * Murni & tanpa I/O supaya bisa diuji langsung dan dipakai di kedua sisi.
 */

/** Satu baris yang ikut dihitung. */
export interface ReceiptLine {
  name: string;
  /** Boleh pecahan (0,472 kg). */
  qty: number;
  /** Harga SATUAN dalam rupiah bulat. */
  price: number;
  /** Potongan untuk baris ini, dalam rupiah bulat (nilai positif). */
  discount?: number;
  unit?: string;
}

export interface ReceiptLineTotal extends ReceiptLine {
  /** round(qty × price) — sebelum potongan baris. */
  gross: number;
  /** Potongan yang benar-benar dipakai (tidak pernah melebihi `gross`). */
  discount: number;
  /** gross − discount, tidak pernah negatif. */
  subtotal: number;
}

export interface ReceiptTotalsInput {
  /** Barang rencana yang berstatus sudah dibeli. */
  items: ReceiptLine[];
  /** Barang tambahan di luar rencana — ikut dihitung penuh. */
  extras?: ReceiptLine[];
  /** Potongan atas seluruh transaksi (bukan per barang). */
  transactionDiscount?: number;
  /** Voucher yang dipakai. */
  voucher?: number;
  /** Biaya tambahan: parkir, kantong belanja, layanan. */
  fees?: number;
  /** Yang benar-benar keluar dari dompet. 0 / undefined = belum diisi. */
  totalPaid?: number;
}

export interface ReceiptTotals {
  lines: ReceiptLineTotal[];
  extraLines: ReceiptLineTotal[];
  /** Jumlah `gross` seluruh baris — sebelum potongan apa pun. */
  totalBeforeDiscount: number;
  /** Bagian dari `totalBeforeDiscount` yang berasal dari barang rencana. */
  itemsTotal: number;
  /** Bagian yang berasal dari barang tambahan. */
  extrasTotal: number;
  /** Jumlah seluruh potongan per barang. */
  itemDiscountTotal: number;
  transactionDiscount: number;
  voucher: number;
  fees: number;
  /** Seluruh potongan yang benar-benar terpakai (setelah dibatasi). */
  discountTotal: number;
  /** Angka yang SEHARUSNYA dibayar menurut rincian. Tidak pernah negatif. */
  totalCalculated: number;
  /** Angka yang dimasukkan pengguna sebagai pembayaran nyata. */
  totalPaid: number;
  /** totalPaid − totalCalculated. Positif = bayar lebih dari rincian. */
  difference: number;
  /** Ada angka pembayaran yang diisi sama sekali? */
  hasPaid: boolean;
  /** Cocok persis (atau belum diisi, sehingga belum ada yang bertentangan). */
  balanced: boolean;
  /** Jumlah baris yang benar-benar dihitung. */
  countedLines: number;
}

/** Bulatkan ke rupiah utuh, tolak NaN/Infinity, tidak pernah negatif. */
export function toWholeRupiah(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Kuantitas yang valid: angka > 0, maksimal 3 desimal (timbangan). */
export function toQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number(n.toFixed(3));
}

/**
 * Subtotal satu baris.
 *
 * Perkalian dilakukan sekali lalu langsung dibulatkan, jadi tidak ada nilai
 * pecahan yang merambat ke penjumlahan berikutnya. Potongan baris dibatasi
 * agar tidak pernah membuat subtotal negatif — struk boleh saja mencetak
 * potongan yang lebih besar karena salah baca, tetapi pembukuan tidak boleh
 * ikut menghasilkan barang berharga minus.
 */
export function lineTotal(line: ReceiptLine): ReceiptLineTotal {
  const qty = toQty(line.qty);
  const price = toWholeRupiah(line.price);
  const gross = Math.round(qty * price);
  const discount = Math.min(toWholeRupiah(line.discount), gross);

  return {
    ...line,
    qty,
    price,
    gross,
    discount,
    subtotal: gross - discount,
  };
}

const sum = (values: number[]): number => values.reduce((acc, n) => acc + n, 0);

/**
 * Hitung seluruh total penyelesaian belanja.
 *
 * Urutan operasinya mengikuti cara struk Indonesia dicetak:
 *
 *   total sebelum diskon   = Σ round(qty × harga satuan)
 *   − diskon per barang
 *   − diskon transaksi
 *   − voucher
 *   + biaya tambahan
 *   = total akhir seharusnya
 *
 * Seluruh potongan digabung lebih dulu lalu dibatasi pada total kotor, supaya
 * kombinasi diskon + voucher yang melebihi belanjaan tidak pernah
 * menghasilkan angka negatif (skema DB menolaknya, dan "belanja dibayar
 * negatif" bukan keadaan yang masuk akal untuk ditampilkan).
 */
export function computeReceiptTotals(input: ReceiptTotalsInput): ReceiptTotals {
  const lines = (input.items ?? []).map(lineTotal);
  const extraLines = (input.extras ?? []).map(lineTotal);

  const itemsTotal = sum(lines.map((l) => l.gross));
  const extrasTotal = sum(extraLines.map((l) => l.gross));
  const totalBeforeDiscount = itemsTotal + extrasTotal;

  const itemDiscountTotal = sum([...lines, ...extraLines].map((l) => l.discount));
  const transactionDiscount = toWholeRupiah(input.transactionDiscount);
  const voucher = toWholeRupiah(input.voucher);
  const fees = toWholeRupiah(input.fees);

  // Potongan tidak boleh melampaui belanjaannya sendiri. Biaya tambahan
  // sengaja TIDAK ikut menaikkan batas ini: parkir bukan barang yang bisa
  // didiskon.
  const discountTotal = Math.min(itemDiscountTotal + transactionDiscount + voucher, totalBeforeDiscount);

  const totalCalculated = Math.max(0, totalBeforeDiscount - discountTotal + fees);

  const totalPaid = toWholeRupiah(input.totalPaid);
  const hasPaid = totalPaid > 0;
  const difference = hasPaid ? totalPaid - totalCalculated : 0;

  return {
    lines,
    extraLines,
    totalBeforeDiscount,
    itemsTotal,
    extrasTotal,
    itemDiscountTotal,
    transactionDiscount,
    voucher,
    fees,
    discountTotal,
    totalCalculated,
    totalPaid,
    difference,
    hasPaid,
    balanced: !hasPaid || difference === 0,
    countedLines: lines.length + extraLines.length,
  };
}

/**
 * Nama baris yang menampung selisih ketika pengguna memilih memakai total
 * kasir apa adanya. Sengaja diberi nama yang jujur: baris ini adalah
 * pengakuan bahwa rinciannya belum lengkap, bukan sulap agar angkanya cocok.
 */
export const DIFFERENCE_LINE = "Selisih struk";

/**
 * Ubah hasil hitung menjadi daftar item transaksi.
 *
 * Bila pengguna mengonfirmasi total kasir yang berbeda dari rincian, selisih
 * itu menjadi SATU baris tersendiri — bukan disebar diam-diam ke harga
 * barang. Dengan begitu detail transaksi tetap memperlihatkan harga barang
 * seperti yang tertulis di struk, dan selisihnya bisa ditelusuri.
 *
 * Potongan per barang sudah menempel di `subtotal`, jadi harga satuan yang
 * dikirim ke transaksi adalah harga efektif setelah diskon baris.
 */
export function toTransactionItems(
  totals: ReceiptTotals
): { name: string; qty: number; price: number; unit?: string }[] {
  const items = [...totals.lines, ...totals.extraLines].map((line) => ({
    name: line.name,
    qty: line.qty,
    // Harga satuan efektif. Untuk barang berkuantitas pecahan, qty × price
    // dibulatkan lagi di sisi transaksi — karena itu subtotal dipakai sebagai
    // sumber kebenaran dan harga satuannya diturunkan darinya.
    price: line.qty > 0 ? Math.round(line.subtotal / line.qty) : line.subtotal,
    unit: line.unit,
  }));

  const adjustments: { name: string; qty: number; price: number }[] = [];

  if (totals.transactionDiscount > 0) {
    adjustments.push({ name: "Diskon transaksi", qty: 1, price: -totals.transactionDiscount });
  }
  if (totals.voucher > 0) {
    adjustments.push({ name: "Voucher", qty: 1, price: -totals.voucher });
  }
  if (totals.fees > 0) {
    adjustments.push({ name: "Biaya tambahan", qty: 1, price: totals.fees });
  }
  if (totals.hasPaid && totals.difference !== 0) {
    adjustments.push({ name: DIFFERENCE_LINE, qty: 1, price: totals.difference });
  }

  return [...items, ...adjustments];
}
