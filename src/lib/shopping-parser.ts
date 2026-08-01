/**
 * Pengurai "tempel daftar belanja".
 *
 * Ayah/Mamah menempel daftar dari WhatsApp/Notes dalam dua gaya:
 *
 *   rapi    Beras ; 5 ; kg
 *   bebas   Beras 5 kg
 *
 * Keduanya didukung dan boleh bercampur dalam satu tempelan.
 *
 *   pemisah KOLOM   titik koma  →  Nama ; jumlah ; satuan ; harga
 *   pemisah BARANG  baris baru atau koma
 *
 * Titik koma yang jelas-jelas memisahkan barang (potongan sesudahnya bukan
 * angka, satuan, atau harga) tetap dibaca sebagai pemisah barang, supaya
 * "Beras 5 kg; Gula 1 kg" tidak menyatu jadi satu baris.
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

/** Angka polos, dipakai untuk kolom jumlah pada gaya rapi. */
const PLAIN_NUMBER_RE = /^\d+(?:[.,]\d+)?$/;

/** Potongan yang seluruhnya satuan ("kg"), jumlah+satuan ("5 kg"), atau harga. */
const UNIT_ONLY_RE = new RegExp(String.raw`^(?:${UNIT_PATTERN})$`, "i");
const QTY_UNIT_ONLY_RE = new RegExp(String.raw`^\d+(?:[.,]\d+)?\s*(?:${UNIT_PATTERN})$`, "i");
const PRICE_ONLY_RE = new RegExp(String.raw`^(?:@|rp\.?)\s*\d[\d.,]*$`, "i");

/**
 * Pemisah antar barang: baris baru, atau koma yang BUKAN pemisah desimal.
 *
 * Koma yang langsung diapit angka ("1,5 kg", "Rp 18,500") adalah bagian dari
 * bilangan — memecahnya di situ akan mengubah "Beras 1,5 kg" menjadi dua
 * barang omong kosong. Sengaja hanya memakai lookahead (bukan lookbehind)
 * agar tetap jalan di Safari lama.
 */
const ITEM_SEPARATOR_RE = /[\n\r]+|,(?!\d)/;

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

/** Potongan ini terbaca sebagai KOLOM milik barang sebelumnya, bukan nama baru. */
function isColumnToken(part: string): boolean {
  return (
    PLAIN_NUMBER_RE.test(part) ||
    UNIT_ONLY_RE.test(part) ||
    QTY_UNIT_ONLY_RE.test(part) ||
    PRICE_ONLY_RE.test(part)
  );
}

/**
 * Kelompokkan potongan hasil pecahan titik koma menjadi barang-barang.
 *
 * Potongan yang berupa kolom (angka, satuan, harga) menempel pada barang
 * terakhir; potongan lain memulai barang baru. Dengan begitu satu baris bisa
 * berisi `Beras ; 5 ; kg` (satu barang, tiga kolom) maupun
 * `Beras 5 kg; Gula 1 kg` (dua barang) tanpa perlu ditebak pengguna.
 */
function groupColumns(raw: string): string[][] {
  const groups: string[][] = [];

  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (groups.length === 0 || !isColumnToken(trimmed)) groups.push([trimmed]);
    else groups[groups.length - 1].push(trimmed);
  }

  return groups;
}

/**
 * Gaya rapi: `Nama ; jumlah ; satuan ; harga`.
 *
 * Kolom setelah nama boleh dipotong di mana saja — `Beras ; 5` dan
 * `Beras ; 5 ; kg` sama-sama sah. Kolom yang tak dikenali diabaikan alih-alih
 * menggagalkan barisnya, karena daftar yang ditempel jarang rapi sempurna.
 */
function parseColumns(columns: string[]): ParsedShoppingItem | null {
  const name = normalizeItemName(tidy(columns[0] ?? ""));
  if (!name) return null;

  let qty = 0;
  let unit = "";
  let price = 0;

  for (const column of columns.slice(1)) {
    const priceMatch = column.match(PRICE_RE);
    if (priceMatch) {
      price = Math.round(toNumber(priceMatch[1]));
      continue;
    }
    // Angka polos: yang pertama adalah jumlah, yang berikutnya harga —
    // itulah urutan kolom `Nama ; jumlah ; satuan ; harga`.
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

/** Gaya bebas: "Beras 5 kg", "2x Susu", "Telur 3", "Sabun mandi". */
function parseFreeform(raw: string): ParsedShoppingItem | null {
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
 * Baca satu potongan teks. Biasanya satu barang, tetapi bisa lebih bila
 * titik komanya ternyata memisahkan barang, bukan kolom.
 */
export function parseShoppingChunk(raw: string): ParsedShoppingItem[] {
  const items: ParsedShoppingItem[] = [];

  for (const group of groupColumns(raw)) {
    const item = group.length > 1 ? parseColumns(group) : parseFreeform(group[0]);
    if (item) items.push(item);
  }

  return items;
}

/**
 * Pecah satu potongan teks menjadi satu barang.
 * Mengembalikan null bila potongan itu kosong setelah dirapikan.
 */
export function parseShoppingLine(raw: string): ParsedShoppingItem | null {
  return parseShoppingChunk(raw)[0] ?? null;
}

/**
 * Pecah teks panjang menjadi daftar barang.
 *
 * Pemisah antar barang adalah BARIS BARU atau KOMA (sesuai cara pengguna
 * menulis). Potongan kosong diabaikan, spasi berlebih dibuang.
 *
 * Barang yang identik (nama + satuan sama, tanpa membedakan huruf besar)
 * DIGABUNG dan kuantitasnya dijumlahkan — menempel daftar yang sama dua kali
 * di dalam satu teks hampir selalu tidak disengaja. Harga pertama yang
 * disebutkan dipertahankan.
 */
export function parseShoppingList(text: string, limit = 100): ParsedShoppingItem[] {
  if (!text?.trim()) return [];

  const merged = new Map<string, ParsedShoppingItem>();

  for (const chunk of text.split(ITEM_SEPARATOR_RE)) {
    for (const item of parseShoppingChunk(chunk)) {
      const key = itemKey(item.name, item.unit);
      const existing = merged.get(key);
      if (existing) {
        existing.qty = Number((existing.qty + item.qty).toFixed(2));
        if (existing.price === 0) existing.price = item.price;
        continue;
      }

      merged.set(key, item);
      if (merged.size >= limit) return Array.from(merged.values());
    }
  }

  return Array.from(merged.values());
}
