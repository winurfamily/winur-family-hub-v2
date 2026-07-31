/**
 * Struktur & penulisan satu barang belanja — satu-satunya sumber kebenaran.
 *
 * Sebuah barang selalu terdiri dari lima bagian yang sama, di mana pun ia
 * muncul (rencana, checklist, barang tambahan, review scan, detail transaksi):
 *
 *   nama          teks bebas, maksimal 80 karakter, informasi utama
 *   qty           angka > 0, boleh pecahan (1,5 kg)
 *   unit          satuan bebas ("kg", "liter", "pcs"); "" = tanpa satuan
 *   estimatedPrice  harga satuan perkiraan saat merencanakan (rupiah bulat)
 *   actualPrice     harga satuan sebenarnya setelah dibeli; null = belum ada
 *
 * Modul ini murni (tanpa DOM/DB) supaya bisa dipakai server maupun client dan
 * diuji langsung.
 */

/** Satuan yang dipakai bila pengguna tidak menyebutkan apa pun saat mengetik. */
export const DEFAULT_UNIT = "pcs";

/**
 * Satuan yang dikenali pengurai dan ditawarkan sebagai saran input.
 * Ditulis lengkap (bukan awalan) agar "1 kg" tidak terbaca sebagai "1 k".
 */
export const SHOPPING_UNITS = [
  "pcs",
  "buah",
  "kg",
  "gram",
  "gr",
  "g",
  "ons",
  "kilogram",
  "kilo",
  "liter",
  "litre",
  "ltr",
  "lt",
  "l",
  "ml",
  "pc",
  "biji",
  "butir",
  "bungkus",
  "bks",
  "kotak",
  "botol",
  "kaleng",
  "pak",
  "pack",
  "sachet",
  "saset",
  "renceng",
  "ikat",
  "lembar",
  "dus",
  "karung",
  "sisir",
  "papan",
  "batang",
  "roll",
  "rol",
  "set",
  "porsi",
  "box",
  "galon",
  "tube",
  "toples",
  "cup",
  "slop",
  "lusin",
] as const;

/** Saran satuan untuk `<datalist>` — yang paling sering dipakai lebih dulu. */
export const UNIT_SUGGESTIONS = [
  "pcs",
  "kg",
  "gram",
  "liter",
  "ml",
  "bungkus",
  "kotak",
  "botol",
  "pak",
  "sachet",
  "ikat",
  "lusin",
];

export const MAX_ITEM_NAME_LENGTH = 80;
export const MAX_UNIT_LENGTH = 20;

/** Rapikan satuan: huruf kecil, tanpa spasi berlebih, dipotong aman. */
export function normalizeUnit(raw?: string | null): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_UNIT_LENGTH);
}

/** Rapikan nama barang tanpa mengubah huruf besar/kecil yang diketik pengguna. */
export function normalizeItemName(raw?: string | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_NAME_LENGTH);
}

/** Kunci pembanding duplikat: nama tanpa spasi & huruf besar. */
export function itemKey(name: string, unit?: string | null): string {
  return `${normalizeItemName(name).toLowerCase()}|${normalizeUnit(unit)}`;
}

/** Kuantitas dalam gaya Indonesia: 5 → "5", 1.5 → "1,5", 0.25 → "0,25". */
export function formatQtyValue(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return qty.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/**
 * Label kuantitas yang selalu punya konteks.
 *
 * Ada satuan  → "5 kg", "2 liter"  (satuan ikut terbaca)
 * Tanpa satuan → "3×"              (tanda kali, bukan angka telanjang)
 *
 * Sengaja TIDAK mengarang "pcs" untuk barang lama yang memang tak bersatuan —
 * satuan palsu di daftar belanja lebih menyesatkan daripada tanda kali.
 */
export function formatUnitQty(qty: number, unit?: string | null): string {
  const clean = normalizeUnit(unit);
  const value = formatQtyValue(qty);
  return clean ? `${value} ${clean}` : `${value}×`;
}

/** Satu baris teks penuh: "Beras — 5 kg". Dipakai aria-label & konfirmasi. */
export function formatItemText(name: string, qty: number, unit?: string | null): string {
  return `${name} — ${formatUnitQty(qty, unit)}`;
}
