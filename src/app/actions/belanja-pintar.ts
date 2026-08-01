"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireFinanceSession,
  revalidateKeuangan,
  isUuid,
  isMissingSchema,
  FORBIDDEN,
  NEEDS_0025,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { normalizeProductName } from "@/lib/finance";
import { monthRange, shiftMonth } from "@/lib/period";
import { currentMonthISO } from "@/lib/format";
import { normalizeItemName, normalizeUnit } from "@/lib/shopping-item";
import { guessItemCategory, priceTrend, type PriceTrend } from "@/lib/shopping-category";

/**
 * Kecerdasan menu Belanja: favorit, barang sering dibeli, dan rekomendasi
 * berdasarkan belanja 2–3 bulan terakhir.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR: rekomendasi TIDAK PERNAH langsung
 * menambah barang ke rencana. Semuanya hanya usulan yang harus dicentang dan
 * dikonfirmasi pengguna. Daftar belanja yang bertambah sendiri berarti ada
 * barang yang terbeli tanpa pernah diputuskan — dan itu uang sungguhan.
 */

/** Berapa bulan ke belakang yang dijadikan bahan rekomendasi. */
const LOOKBACK_MONTHS = 3;

/** Muncul di minimal dua bulan berbeda = kebiasaan, bukan kebetulan. */
const HABIT_MIN_MONTHS = 2;

export interface ProductSuggestionItem {
  /** Kunci stabil untuk pencocokan & seleksi di UI. */
  key: string;
  name: string;
  unit: string;
  qty: number;
  /** Harga satuan terakhir yang benar-benar dibayar. */
  lastPrice: number;
  avgPrice: number;
  /** Berapa kali dibeli dalam rentang yang ditinjau. */
  timesBought: number;
  /** Di berapa bulan berbeda barang ini muncul. */
  monthsSeen: number;
  trend: PriceTrend;
  changePercent: number | null;
  category: string;
  /** id products, bila barangnya ada di katalog — dipakai tombol favorit. */
  productId: string | null;
  isFavorite: boolean;
}

export interface ShoppingInsights {
  /** false = migration 0025 belum jalan; favorit tidak tersedia. */
  favoritesReady: boolean;
  /** Ditandai manual oleh pengguna. */
  favorites: ProductSuggestionItem[];
  /** Paling sering dibeli sepanjang riwayat (buy_count katalog produk). */
  frequent: ProductSuggestionItem[];
  /** Kebiasaan 2–3 bulan terakhir yang layak masuk rencana bulan depan. */
  recommendations: ProductSuggestionItem[];
  /** Bulan yang dijadikan bahan, terlama lebih dulu. */
  sourceMonths: string[];
}

interface Aggregate {
  name: string;
  unit: string;
  qtyTotal: number;
  times: number;
  months: Set<string>;
  prices: number[];
  lastPrice: number;
  lastDate: string;
}

function toSuggestion(
  aggregate: Aggregate,
  catalog: Map<string, { id: string; avgPrice: number; buyCount: number; isFavorite: boolean }>
): ProductSuggestionItem {
  const key = normalizeProductName(aggregate.name);
  const product = catalog.get(key);
  const avgFromHistory =
    aggregate.prices.length > 0
      ? Math.round(aggregate.prices.reduce((acc, p) => acc + p, 0) / aggregate.prices.length)
      : 0;
  const avgPrice = product?.avgPrice || avgFromHistory;

  return {
    key,
    name: aggregate.name,
    unit: aggregate.unit,
    // Kuantitas usulan = rata-rata yang biasa dibeli, dibulatkan ke atas ke
    // 0,5 terdekat supaya "1,5 kg" tetap masuk akal dan tidak menjadi 1,4732.
    qty: Math.max(1, Math.round((aggregate.qtyTotal / Math.max(1, aggregate.times)) * 2) / 2),
    lastPrice: aggregate.lastPrice,
    avgPrice,
    timesBought: aggregate.times,
    monthsSeen: aggregate.months.size,
    trend: priceTrend(aggregate.lastPrice, avgPrice),
    changePercent:
      avgPrice > 0 ? Math.round(((aggregate.lastPrice - avgPrice) / avgPrice) * 100) : null,
    category: guessItemCategory(aggregate.name),
    productId: product?.id ?? null,
    isFavorite: product?.isFavorite ?? false,
  };
}

/**
 * Semua bahan panel "Barang Pintar" dalam satu perjalanan ke database.
 *
 * Tiga daftar sekaligus (favorit, sering dibeli, rekomendasi) karena ketiganya
 * berbagi sumber yang sama — memisahkannya menjadi tiga Server Action berarti
 * tiga kali query rincian belanja yang persis sama.
 */
export async function getShoppingInsights(): Promise<ShoppingInsights> {
  const empty: ShoppingInsights = {
    favoritesReady: true,
    favorites: [],
    frequent: [],
    recommendations: [],
    sourceMonths: [],
  };

  const session = await requireFinanceSession();
  if (!session) return empty;

  const supabase = createAdminClient();
  const thisMonth = currentMonthISO();
  const months = Array.from({ length: LOOKBACK_MONTHS }, (_, i) =>
    shiftMonth(thisMonth, i - LOOKBACK_MONTHS)
  );
  const start = monthRange(months[0]).start;
  const end = monthRange(months[months.length - 1]).end;

  // `is_favorite` datang dari migration 0025. Bila belum ada, katalog tetap
  // dibaca tanpa kolom itu supaya rekomendasi & "sering dibeli" tetap jalan.
  const withFavorite = await supabase
    .from("products")
    .select("id, name, name_normalized, avg_price, last_price, buy_count, is_favorite")
    .eq("family_id", session.familyId)
    .order("buy_count", { ascending: false })
    .limit(200);

  const favoritesReady = !isMissingSchema(withFavorite.error);
  const productRows = favoritesReady
    ? withFavorite.data ?? []
    : (
        await supabase
          .from("products")
          .select("id, name, name_normalized, avg_price, last_price, buy_count")
          .eq("family_id", session.familyId)
          .order("buy_count", { ascending: false })
          .limit(200)
      ).data ?? [];

  const catalog = new Map(
    (productRows as {
      id: string;
      name: string;
      name_normalized: string;
      avg_price: number | string;
      last_price: number | string;
      buy_count: number;
      is_favorite?: boolean;
    }[]).map((row) => [
      row.name_normalized || normalizeProductName(row.name),
      {
        id: row.id,
        name: row.name,
        avgPrice: Math.round(Number(row.avg_price) || 0),
        lastPrice: Math.round(Number(row.last_price) || 0),
        buyCount: row.buy_count,
        isFavorite: Boolean(row.is_favorite),
      },
    ])
  );

  // --- Rincian belanja 3 bulan terakhir -------------------------------
  const { data: transactions } = await supabase
    .from("shopping_transactions")
    .select("id, date")
    .eq("family_id", session.familyId)
    .eq("category", "belanja")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  const dateOf = new Map((transactions ?? []).map((t) => [t.id, t.date]));
  const aggregates = new Map<string, Aggregate>();

  if (dateOf.size > 0) {
    const { data: items } = await supabase
      .from("shopping_transaction_items")
      .select("transaction_id, name, qty, price, unit")
      .in("transaction_id", Array.from(dateOf.keys()))
      .limit(2000);

    for (const row of (items ?? []) as {
      transaction_id: string;
      name: string;
      qty: number | string;
      price: number | string;
      unit: string | null;
    }[]) {
      const date = dateOf.get(row.transaction_id);
      if (!date) continue;

      const name = normalizeItemName(row.name);
      if (!name) continue;

      const key = normalizeProductName(name);
      const price = Math.max(0, Math.round(Number(row.price) || 0));
      const qty = Number(row.qty) > 0 ? Number(row.qty) : 1;

      const current = aggregates.get(key);
      if (current) {
        current.times += 1;
        current.qtyTotal += qty;
        current.months.add(date.slice(0, 7));
        if (price > 0) current.prices.push(price);
        // Transaksi diurutkan menaik, jadi baris terakhir yang menang adalah
        // pembelian terbaru — itulah "harga terakhir" yang berguna.
        if (date >= current.lastDate) {
          current.lastDate = date;
          if (price > 0) current.lastPrice = price;
          if (normalizeUnit(row.unit)) current.unit = normalizeUnit(row.unit);
        }
      } else {
        aggregates.set(key, {
          name,
          unit: normalizeUnit(row.unit),
          qtyTotal: qty,
          times: 1,
          months: new Set([date.slice(0, 7)]),
          prices: price > 0 ? [price] : [],
          lastPrice: price,
          lastDate: date,
        });
      }
    }
  }

  const suggestions = Array.from(aggregates.values()).map((aggregate) =>
    toSuggestion(aggregate, catalog)
  );

  const recommendations = suggestions
    .filter((item) => item.monthsSeen >= HABIT_MIN_MONTHS)
    .sort((a, b) => b.monthsSeen - a.monthsSeen || b.timesBought - a.timesBought)
    .slice(0, 24);

  const byKey = new Map(suggestions.map((item) => [item.key, item]));

  /** Barang katalog yang belum punya agregat 3 bulan tetap bisa diusulkan. */
  const fromCatalog = (
    key: string,
    entry: { id: string; name?: string; avgPrice: number; lastPrice: number; buyCount: number; isFavorite: boolean }
  ): ProductSuggestionItem => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const name = productRows.find((row) => (row.name_normalized || normalizeProductName(row.name)) === key)?.name ?? key;
    return {
      key,
      name,
      unit: "",
      qty: 1,
      lastPrice: entry.lastPrice,
      avgPrice: entry.avgPrice,
      timesBought: entry.buyCount,
      monthsSeen: 0,
      trend: priceTrend(entry.lastPrice, entry.avgPrice),
      changePercent:
        entry.avgPrice > 0 ? Math.round(((entry.lastPrice - entry.avgPrice) / entry.avgPrice) * 100) : null,
      category: guessItemCategory(name),
      productId: entry.id,
      isFavorite: entry.isFavorite,
    };
  };

  const favorites = Array.from(catalog.entries())
    .filter(([, entry]) => entry.isFavorite)
    .map(([key, entry]) => fromCatalog(key, entry))
    .sort((a, b) => b.timesBought - a.timesBought)
    .slice(0, 24);

  const frequent = Array.from(catalog.entries())
    .filter(([, entry]) => entry.buyCount >= 2 && !entry.isFavorite)
    .map(([key, entry]) => fromCatalog(key, entry))
    .sort((a, b) => b.timesBought - a.timesBought)
    .slice(0, 24);

  return {
    favoritesReady,
    favorites,
    frequent,
    recommendations,
    sourceMonths: months,
  };
}

/** Tandai / lepas tanda favorit satu produk katalog. */
export async function setProductFavorite(
  productId: string,
  favorite: boolean
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(productId)) return { success: false, error: "Produk tidak ditemukan." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ is_favorite: favorite, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("family_id", session.familyId);

  if (isMissingSchema(error)) return { success: false, error: NEEDS_0025 };
  if (error) return { success: false, error: "Gagal memperbarui favorit." };

  revalidateKeuangan();
  return { success: true };
}
