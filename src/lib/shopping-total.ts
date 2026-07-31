/**
 * Penyelarasan total belanja.
 *
 * Di toko, Ayah/Mamah biasanya hanya mencentang barang lalu mengetik satu
 * angka: total yang dibayar di kasir. Rincian harga per barang sering kosong
 * atau hanya perkiraan. Fungsi ini menyebarkan total tersebut ke rincian
 * supaya:
 *
 *  - jumlah subtotal PERSIS sama dengan yang dibayar (tidak ada selisih receh),
 *  - tidak ada harga negatif (skema DB menolaknya),
 *  - proporsi harga perkiraan tetap terjaga bila pengguna sudah mengisinya.
 *
 * Murni & tanpa I/O supaya bisa diuji langsung.
 */

export interface TotalItem {
  name: string;
  qty: number;
  price: number;
  /** Satuan ikut dibawa apa adanya — penyelarasan hanya menyentuh harga. */
  unit?: string;
}

/** Jumlah subtotal (qty × harga) yang dibulatkan per baris. */
export function sumItems(items: TotalItem[]): number {
  return items.reduce((acc, item) => acc + Math.round(item.qty * item.price), 0);
}

/** Nama baris yang menampung sisa pembulatan bila tidak bisa dititipkan. */
export const ROUNDING_LINE = "Pembulatan struk";

/**
 * Sesuaikan harga satuan sehingga total keseluruhan = `totalPaid`.
 *
 * Aturannya mengikuti cara orang belanja sungguhan:
 *
 *  1. Harga yang SUDAH diisi pengguna dihormati apa adanya — angka itu diketik
 *     karena memang diketahui.
 *  2. Sisa uang (total dibayar − jumlah harga yang sudah diisi) dibagi ke
 *     barang yang harganya masih kosong, sebanding dengan kuantitasnya.
 *  3. Barulah kalau semua barang sudah berharga — atau harga yang diisi sudah
 *     melampaui total — seluruh daftar diskalakan proporsional.
 *
 * Langkah 1–2 penting: tanpa itu, skala proporsional menimpakan SELURUH total
 * ke satu-satunya barang yang kebetulan berharga dan membuat barang lain
 * Rp0 — persis kasus "checklist tanpa harga + satu barang tambahan berharga".
 *
 * Pembagian memakai `Math.floor` sehingga hasilnya selalu ≤ target dan tidak
 * pernah negatif (skema DB menolak harga negatif). Sisa rupiah dititipkan ke
 * baris berkuantitas 1; bila tidak ada, sisanya menjadi satu baris
 * "Pembulatan struk" di AKHIR — posisi akhir menjaga pemetaan indeks ke barang
 * rencana di completeShoppingPlan() tetap valid.
 */
export function distributeTotal(items: TotalItem[], totalPaid: number): TotalItem[] {
  const target = Math.round(totalPaid);
  if (!Number.isFinite(target) || target <= 0 || items.length === 0) return items;

  const subtotal = sumItems(items);
  if (subtotal === target) return items;

  const totalQty = items.reduce((acc, item) => acc + item.qty, 0);
  if (totalQty <= 0) return items;

  const pricedTotal = sumItems(items.filter((item) => item.price > 0));
  const blanks = items.filter((item) => item.price <= 0);
  const blankQty = blanks.reduce((acc, item) => acc + item.qty, 0);

  const fillBlanks = blanks.length > 0 && pricedTotal < target;
  const perBlankUnit = fillBlanks ? Math.floor((target - pricedTotal) / blankQty) : 0;

  const scaled = items.map((item) => {
    if (fillBlanks) {
      return item.price > 0 ? { ...item } : { ...item, price: Math.max(0, perBlankUnit) };
    }
    const share =
      subtotal > 0 ? (Math.round(item.qty * item.price) / subtotal) * target : (item.qty / totalQty) * target;
    return { ...item, price: Math.max(0, Math.floor(share / item.qty)) };
  });

  let residual = target - sumItems(scaled);
  if (residual <= 0) return scaled;

  const unitIndex = scaled.findIndex((item) => item.qty === 1);
  if (unitIndex >= 0) {
    scaled[unitIndex] = { ...scaled[unitIndex], price: scaled[unitIndex].price + residual };
    return scaled;
  }

  // Naikkan harga satuan selama sisanya masih cukup untuk satu putaran penuh,
  // supaya baris "Pembulatan" hanya muncul untuk sisa yang benar-benar kecil.
  for (const item of scaled) {
    const step = Math.floor(residual / item.qty);
    if (step <= 0) continue;
    item.price += step;
    residual -= step * item.qty;
  }

  return residual > 0 ? [...scaled, { name: ROUNDING_LINE, qty: 1, price: residual }] : scaled;
}
