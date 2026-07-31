/**
 * Pengurai "tempel daftar belanja".
 *
 * Ayah/Mamah sering menyalin daftar dari WhatsApp/Notes dalam satu baris
 * panjang dipisah koma:
 *
 *   Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi, Susu anak 2 kotak
 *
 * Fungsi ini murni (tanpa DB/DOM) supaya bisa diuji langsung dan dipakai di
 * klien tanpa round-trip ke server.
 */

export interface ParsedShoppingItem {
  name: string;
  qty: number;
  /** Satuan bebas ("kg", "liter", "kotak"). Kosong bila tidak disebutkan. */
  unit: string;
  /** Harga per satuan bila ditulis (@12000 / Rp12.000). 0 bila tidak ada. */
  price: number;
}

/** Satuan yang dikenali. Ditulis lengkap agar "1 kg" tidak terbaca "1 k". */
const UNITS = [
  "kg",
  "kilogram",
  "kilo",
  "ons",
  "gram",
  "gr",
  "g",
  "liter",
  "litre",
  "ltr",
  "lt",
  "l",
  "ml",
  "pcs",
  "pc",
  "buah",
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
];

const UNIT_PATTERN = UNITS.join("|");

/** "@12.000", "@ 12000", "rp12.000", "rp 12,000" — pemisah ribuan diabaikan. */
const PRICE_RE = new RegExp(String.raw`(?:@|\brp\.?)\s*([\d][\d.,]*)`, "i");

/** "5 kg", "2liter", "1,5 kg" di mana pun dalam potongan teks. */
const QTY_UNIT_RE = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${UNIT_PATTERN})\b`, "i");

/** "2x Susu" atau "2 x Susu" di awal potongan. */
const LEADING_QTY_RE = /^(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*/i;

/** "Telur 2" — angka polos di akhir dianggap kuantitas. */
const TRAILING_QTY_RE = /\s(\d+(?:[.,]\d+)?)$/;

function toNumber(raw: string): number {
  // Buang pemisah ribuan (titik/koma) lalu kembalikan desimal koma jadi titik.
  const cleaned = raw.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function tidy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-–—•*]+/, "")
    .replace(/[\s,;:.\-–—•*]+$/, "")
    .trim();
}

/**
 * Pecah satu potongan teks menjadi satu barang.
 * Mengembalikan null bila potongan itu kosong setelah dirapikan.
 */
export function parseShoppingLine(raw: string): ParsedShoppingItem | null {
  let rest = raw.replace(/\s+/g, " ").trim();
  if (!rest) return null;

  let price = 0;
  const priceMatch = rest.match(PRICE_RE);
  if (priceMatch) {
    price = Math.round(toNumber(priceMatch[1]));
    rest = rest.replace(priceMatch[0], " ");
  }

  let qty = 0;
  let unit = "";

  const leading = rest.match(LEADING_QTY_RE);
  if (leading) {
    qty = toNumber(leading[1]);
    rest = rest.replace(LEADING_QTY_RE, " ");
  }

  const qtyUnit = rest.match(QTY_UNIT_RE);
  if (qtyUnit) {
    qty = toNumber(qtyUnit[1]);
    unit = qtyUnit[2].toLowerCase();
    rest = rest.replace(qtyUnit[0], " ");
  } else if (!leading) {
    const trailing = rest.match(TRAILING_QTY_RE);
    if (trailing) {
      qty = toNumber(trailing[1]);
      rest = rest.replace(TRAILING_QTY_RE, " ");
    }
  }

  const name = tidy(rest);
  if (!name) return null;

  return {
    name,
    qty: qty > 0 ? qty : 1,
    unit,
    price: price > 0 ? price : 0,
  };
}

/**
 * Pecah teks panjang menjadi daftar barang.
 *
 * Pemisah utama adalah KOMA (sesuai cara pengguna menulis), ditambah baris
 * baru dan titik koma supaya daftar yang disalin per baris juga bekerja.
 * Potongan kosong diabaikan, spasi berlebih dibuang.
 */
export function parseShoppingList(text: string, limit = 100): ParsedShoppingItem[] {
  if (!text?.trim()) return [];

  return text
    .split(/[,;\n\r]+/)
    .map(parseShoppingLine)
    .filter((item): item is ParsedShoppingItem => item !== null)
    .slice(0, limit);
}
