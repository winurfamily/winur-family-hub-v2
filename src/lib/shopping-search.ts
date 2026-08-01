/**
 * Pencarian lokal untuk checklist belanja.
 *
 * Seluruhnya berjalan di perangkat: daftar belanja satu keluarga berukuran
 * puluhan sampai ~100 barang, dan itu jauh lebih murah disaring di memori
 * daripada bolak-balik ke server untuk setiap huruf yang diketik. Karena tidak
 * ada I/O, tidak ada pula yang perlu di-debounce demi jaringan — yang mahal
 * hanyalah membangun teks pencarian, jadi ITU yang di-memo (lihat
 * `buildHaystack`), bukan pengetikannya.
 *
 * Yang bisa dicari: nama barang, jumlah, satuan, dan kategori rak. Mengetik
 * "2 liter" menemukan minyak goreng; mengetik "sayur" menemukan seluruh isi
 * rak sayur.
 *
 * Murni & tanpa DOM supaya bisa diuji langsung.
 */

import { formatQtyValue, normalizeUnit } from "@/lib/shopping-item";

export interface SearchableItem {
  name: string;
  qty: number;
  unit?: string | null;
  /** Label kategori yang terbaca manusia ("Sayur & Buah"). */
  categoryLabel?: string | null;
}

/**
 * Rapikan teks untuk dibandingkan: huruf kecil, tanpa spasi ganda.
 *
 * Koma dan titik pada angka DISERAGAMKAN menjadi titik supaya "1,5" dan "1.5"
 * sama-sama menemukan barang yang sama — pengguna Indonesia mengetik keduanya.
 */
export function normalizeSearchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Semua teks yang boleh dicocokkan untuk satu barang, digabung jadi satu baris.
 *
 * Kuantitas ditulis dalam DUA bentuk — "2" dan "2 liter" — sehingga mengetik
 * angkanya saja maupun angka+satuan sama-sama mengenai sasaran.
 */
export function buildHaystack(item: SearchableItem): string {
  const unit = normalizeUnit(item.unit);
  const qty = formatQtyValue(item.qty);

  return normalizeSearchText(
    [item.name, qty, unit, unit ? `${qty} ${unit}` : "", item.categoryLabel ?? ""]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * Cocokkan kueri dengan teks pencarian.
 *
 * Setiap kata pada kueri harus ditemukan (AND), tetapi urutannya bebas:
 * "minyak 2" dan "2 minyak" sama-sama menemukan "Minyak Goreng 2 liter".
 * Ini penting karena orang mengetik daftar belanja dengan urutan yang tidak
 * konsisten.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return needle.split(" ").every((word) => haystack.includes(word));
}

/** Saring daftar barang dengan kueri. Kueri kosong mengembalikan daftar apa adanya. */
export function filterBySearch<T extends SearchableItem>(items: T[], query: string): T[] {
  const needle = normalizeSearchText(query);
  if (!needle) return items;
  const words = needle.split(" ");
  return items.filter((item) => {
    const haystack = buildHaystack(item);
    return words.every((word) => haystack.includes(word));
  });
}
