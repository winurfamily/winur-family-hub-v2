/**
 * Pengelompokan barang belanja — murni, tanpa database.
 *
 * Kenapa perlu: daftar belanja diketik sesuai ingatan ("telur, sabun, bayam,
 * gula, sampo"), sedangkan toko ditata per rak. Tanpa pengelompokan, satu kali
 * belanja berarti bolak-balik melewati rak yang sama. Urutan kelompok di sini
 * mengikuti alur berjalan yang lazim di supermarket: bahan segar dulu, sembako,
 * lalu non-makanan di rak belakang.
 *
 * Kategori boleh diisi manual per barang (kolom `shopping_plan_items.category`,
 * migration 0025). Bila kosong, `guessItemCategory()` menebaknya dari nama —
 * tebakan yang salah tidak merusak apa pun, hanya menaruh barangnya di
 * kelompok lain, dan pengguna bisa menimpanya.
 */

export const SHOPPING_CATEGORIES = [
  "sayur_buah",
  "daging_ikan",
  "susu_telur",
  "sembako",
  "bumbu",
  "minuman",
  "camilan",
  "kebersihan",
  "bayi_anak",
  "lainnya",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  sayur_buah: "Sayur & Buah",
  daging_ikan: "Daging & Ikan",
  susu_telur: "Susu & Telur",
  sembako: "Sembako",
  bumbu: "Bumbu & Saus",
  minuman: "Minuman",
  camilan: "Camilan",
  kebersihan: "Kebersihan",
  bayi_anak: "Bayi & Anak",
  lainnya: "Lainnya",
};

/** Emoji sebagai penanda kelompok — tanpa menambah aset atau ikon baru. */
export const SHOPPING_CATEGORY_EMOJI: Record<ShoppingCategory, string> = {
  sayur_buah: "🥬",
  daging_ikan: "🐟",
  susu_telur: "🥚",
  sembako: "🍚",
  bumbu: "🧂",
  minuman: "🧃",
  camilan: "🍪",
  kebersihan: "🧼",
  bayi_anak: "🍼",
  lainnya: "🛒",
};

export function isShoppingCategory(value: unknown): value is ShoppingCategory {
  return SHOPPING_CATEGORIES.includes(value as ShoppingCategory);
}

/**
 * Kata kunci penebak, per kategori.
 *
 * Dicocokkan sebagai KATA UTUH (batas kata), bukan substring: tanpa itu "sabun"
 * akan tertangkap oleh "abon", dan "susu" oleh "sus". Urutan kategori di
 * SHOPPING_CATEGORIES menentukan mana yang menang bila sebuah nama cocok ke
 * dua kelompok.
 */
const KEYWORDS: Record<ShoppingCategory, string[]> = {
  sayur_buah: [
    "sayur", "bayam", "kangkung", "sawi", "kol", "kubis", "wortel", "kentang", "tomat",
    "timun", "mentimun", "terong", "buncis", "brokoli", "jagung", "labu", "jamur",
    "selada", "seledri", "daun", "toge", "tauge", "buah", "pisang", "apel", "jeruk",
    "mangga", "semangka", "melon", "pepaya", "anggur", "nanas", "alpukat", "stroberi",
    "pir", "salak", "rambutan", "duku", "jambu", "kelengkeng", "lemon", "nangka",
  ],
  daging_ikan: [
    "daging", "ayam", "sapi", "kambing", "ikan", "udang", "cumi", "kepiting", "lele",
    "nila", "tongkol", "tuna", "bandeng", "salmon", "sosis", "bakso", "nugget", "ati",
    "ampela", "ceker", "tulang", "iga", "seafood", "kerang", "teri",
  ],
  susu_telur: [
    "susu", "telur", "keju", "yogurt", "yoghurt", "mentega", "margarin", "butter",
    "krimer", "creamer", "kental", "uht",
  ],
  sembako: [
    "beras", "gula", "minyak", "tepung", "terigu", "mie", "mi", "indomie", "bihun",
    "sohun", "pasta", "spageti", "spaghetti", "kacang", "kedelai", "tahu", "tempe",
    "roti", "sereal", "oat", "oatmeal", "gandum", "sagu", "maizena", "santan",
  ],
  bumbu: [
    "garam", "merica", "lada", "bawang", "cabai", "cabe", "kecap", "saus", "sambal",
    "penyedap", "masako", "royco", "kaldu", "ketumbar", "kunyit", "jahe", "lengkuas",
    "serai", "sereh", "asam", "cuka", "mayones", "mayonaise", "bumbu", "vanili", "ragi",
  ],
  minuman: [
    "air", "aqua", "galon", "teh", "kopi", "sirup", "jus", "soda", "minuman", "isotonik",
    "pocari", "energen", "milo", "nutrisari", "mineral",
  ],
  camilan: [
    "snack", "camilan", "keripik", "kripik", "biskuit", "wafer", "coklat", "permen",
    "cokelat", "kerupuk", "chiki", "oreo", "astor", "marie", "kue", "es",
  ],
  kebersihan: [
    "sabun", "sampo", "shampo", "shampoo", "odol", "pasta", "sikat", "detergen",
    "deterjen", "rinso", "pewangi", "molto", "pembersih", "porstex", "wipol", "tisu", "pasta gigi",
    "tissue", "kapas", "pembalut", "sunlight", "spons", "sapu", "pel", "kantong",
    "plastik", "obat", "nyamuk", "baygon", "parfum", "deodoran", "handuk", "sikat gigi",
  ],
  bayi_anak: [
    "popok", "pampers", "mamypoko", "bedak", "sufor", "dancow", "sgm", "bebelac",
    "minyak telon", "telon", "bayi", "baby", "mainan", "susu formula",
  ],
  lainnya: [],
};

/** Peta kata → kategori, dibangun sekali saat modul dimuat. */
const KEYWORD_INDEX: Map<string, ShoppingCategory> = (() => {
  const index = new Map<string, ShoppingCategory>();
  for (const category of SHOPPING_CATEGORIES) {
    for (const word of KEYWORDS[category]) {
      // Kategori yang lebih awal menang; `set` hanya bila belum terdaftar.
      if (!index.has(word)) index.set(word, category);
    }
  }
  return index;
})();

/**
 * Tebak kategori sebuah barang dari namanya.
 *
 * Nama dipecah menjadi kata dan dicocokkan satu per satu, jadi "minyak goreng"
 * dan "goreng minyak" sama-sama masuk Sembako. Nama tanpa kata yang dikenal
 * jatuh ke "lainnya" — bukan ditebak paksa.
 */
export function guessItemCategory(name: string): ShoppingCategory {
  const words = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Frasa dua kata diperiksa lebih dulu ("minyak telon" ≠ "minyak goreng").
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    const hit = KEYWORD_INDEX.get(phrase);
    if (hit) return hit;
  }

  for (const word of words) {
    const hit = KEYWORD_INDEX.get(word);
    if (hit) return hit;
  }

  return "lainnya";
}

/** Kategori tersimpan bila valid, selain itu ditebak dari nama. */
export function resolveItemCategory(
  stored: string | null | undefined,
  name: string
): ShoppingCategory {
  return isShoppingCategory(stored) ? stored : guessItemCategory(name);
}

export interface CategoryGroup<T> {
  key: ShoppingCategory;
  label: string;
  emoji: string;
  items: T[];
}

/**
 * Kelompokkan daftar barang mengikuti urutan rak toko.
 *
 * Kelompok kosong tidak ikut dikembalikan, dan urutan barang di dalam tiap
 * kelompok mempertahankan urutan aslinya — checklist yang sudah disusun manual
 * tidak diacak ulang.
 */
export function groupByCategory<T>(
  items: T[],
  categoryOf: (item: T) => ShoppingCategory
): CategoryGroup<T>[] {
  const buckets = new Map<ShoppingCategory, T[]>();

  for (const item of items) {
    const key = categoryOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return SHOPPING_CATEGORIES.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: SHOPPING_CATEGORY_LABELS[key],
    emoji: SHOPPING_CATEGORY_EMOJI[key],
    items: buckets.get(key)!,
  }));
}

/**
 * Arah perubahan harga terhadap acuan (harga terakhir / rata-rata).
 *
 * Ambang 2% menghindari panah naik-turun untuk selisih recehan yang tidak
 * berarti apa-apa bagi pengguna.
 */
export type PriceTrend = "up" | "down" | "flat";

export function priceTrend(current: number, reference: number, threshold = 0.02): PriceTrend {
  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference <= 0 || current <= 0) {
    return "flat";
  }
  const change = (current - reference) / reference;
  if (change > threshold) return "up";
  if (change < -threshold) return "down";
  return "flat";
}

/** Perubahan harga dalam persen, dibulatkan. `null` bila tak ada acuan. */
export function priceChangePercent(current: number, reference: number): number | null {
  if (!Number.isFinite(reference) || reference <= 0) return null;
  return Math.round(((current - reference) / reference) * 100);
}
