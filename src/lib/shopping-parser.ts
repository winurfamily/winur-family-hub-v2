/**
 * Pengurai "tempel daftar belanja".
 *
 * Ayah/Mamah menempel daftar dari WhatsApp/Notes dalam dua gaya:
 *
 *   bebas      Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi
 *   berpipa    Beras | 5 | kg, Minyak Goreng | 2 | liter, Telur | 1 | kg
 *
 * Keduanya didukung dan boleh bercampur dalam satu tempelan. Pemisah antar
 * barang adalah koma, titik koma, atau baris baru; pemisah antar kolom pada
 * gaya berpipa adalah "|".
 *
 * Fungsi ini murni (tanpa DB/DOM) supaya bisa diuji langsung dan dipakai di
 * klien tanpa round-trip ke server.
 */

import { SHOPPING_UNITS, normalizeItemName, normalizeUnit, itemKey } from "@/lib/shopping-item";

export interface ParsedShoppingItem {
  name: string;
  qty: number;
  /** Satuan bebas ("kg", "liter", "kotak"). Kosong bila tidak disebutkan. */
  unit: string;
  /** Harga per satuan bila ditulis (@12000 / Rp12.000). 0 bila tidak ada. */
  price: number;
}

const UNIT_PATTERN = SHOPPING_UNITS.join("|");

/** "@12.000", "@ 12000", "rp12.000", "rp 12,000" — pemisah ribuan diabaikan. */
const PRICE_RE = new RegExp(String.raw`(?:@|\brp\.?)\s*([\d][\d.,]*)`, "i");

/** "5 kg", "2liter", "1,5 kg" di mana pun dalam potongan teks. */
const QTY_UNIT_RE = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(${UNIT_PATTERN})\b`, "i");

/** "2x Susu" atau "2 x Susu" di awal potongan. */
const LEADING_QTY_RE = /^(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*/i;

/** "Telur 2" — angka polos di akhir dianggap kuantitas. */
const TRAILING_QTY_RE = /\s(\d+(?:[.,]\d+)?)$/;

/** Angka polos, dipakai untuk kolom qty pada gaya berpipa. */
const PLAIN_NUMBER_RE = /^\d+(?:[.,]\d+)?$/;

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
 * Gaya berpipa: `Nama | qty | satuan | harga`.
 *
 * Kolom setelah nama boleh dipotong di mana saja — `Beras | 5` dan
 * `Beras | 5 | kg` sama-sama sah. Kolom yang tak dikenali diabaikan alih-alih
 * menggagalkan barisnya, karena daftar yang ditempel jarang rapi sempurna.
 */
function parsePipedLine(raw: string): ParsedShoppingItem | null {
  const columns = raw.split("|").map((part) => part.trim());
  const name = normalizeItemName(tidy(columns[0] ?? ""));
  if (!name) return null;

  let qty = 0;
  let unit = "";
  let price = 0;

  for (const column of columns.slice(1)) {
    if (!column) continue;

    const priceMatch = column.match(PRICE_RE);
    if (priceMatch) {
      price = Math.round(toNumber(priceMatch[1]));
      continue;
    }
    // Angka polos: yang pertama adalah qty, yang berikutnya harga —
    // itulah urutan kolom `Nama | qty | satuan | harga`.
    if (PLAIN_NUMBER_RE.test(column)) {
      const value = toNumber(column);
      if (!qty) qty = value;
      else if (!price) price = Math.round(value);
      continue;
    }
    // "5 kg" yang tertulis dalam satu kolom tetap terbaca.
    const qtyUnit = column.match(QTY_UNIT_RE);
    if (qtyUnit) {
      if (!qty) qty = toNumber(qtyUnit[1]);
      unit = normalizeUnit(qtyUnit[2]);
      continue;
    }
    if (!unit) unit = normalizeUnit(column);
  }

  return { name, qty: qty > 0 ? qty : 1, unit, price: price > 0 ? price : 0 };
}

/**
 * Pecah satu potongan teks menjadi satu barang.
 * Mengembalikan null bila potongan itu kosong setelah dirapikan.
 */
export function parseShoppingLine(raw: string): ParsedShoppingItem | null {
  if (raw.includes("|")) return parsePipedLine(raw);

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
    unit = normalizeUnit(qtyUnit[2]);
    rest = rest.replace(qtyUnit[0], " ");
  } else if (!leading) {
    const trailing = rest.match(TRAILING_QTY_RE);
    if (trailing) {
      qty = toNumber(trailing[1]);
      rest = rest.replace(TRAILING_QTY_RE, " ");
    }
  }

  const name = normalizeItemName(tidy(rest));
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
 *
 * Barang yang identik (nama + satuan sama, tanpa membedakan huruf besar)
 * DIGABUNG dan kuantitasnya dijumlahkan — menempel daftar yang sama dua kali
 * di dalam satu teks hampir selalu tidak disengaja. Harga pertama yang
 * disebutkan dipertahankan.
 */
export function parseShoppingList(text: string, limit = 100): ParsedShoppingItem[] {
  if (!text?.trim()) return [];

  const merged = new Map<string, ParsedShoppingItem>();

  for (const chunk of text.split(/[,;\n\r]+/)) {
    const item = parseShoppingLine(chunk);
    if (!item) continue;

    const key = itemKey(item.name, item.unit);
    const existing = merged.get(key);
    if (existing) {
      existing.qty = Number((existing.qty + item.qty).toFixed(2));
      if (existing.price === 0) existing.price = item.price;
      continue;
    }

    merged.set(key, item);
    if (merged.size >= limit) break;
  }

  return Array.from(merged.values());
}
