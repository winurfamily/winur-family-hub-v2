import "server-only";
import { normalizeProductName } from "@/lib/finance";
import type { AdminClient } from "@/lib/server/finance-helpers";

/**
 * Cari produk berdasarkan nama ternormalisasi; buat baru bila belum ada.
 * Menjaga statistik harga terakhir / rata-rata untuk autocomplete.
 *
 * Bukan Server Action (menerima client Supabase sebagai argumen), jadi
 * sengaja ditaruh di lib/server dan bukan di file "use server".
 */
export async function resolveProduct(
  supabase: AdminClient,
  familyId: string,
  name: string,
  price: number
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const normalized = normalizeProductName(trimmed);

  const { data: existing } = await supabase
    .from("products")
    .select("id, last_price, avg_price, buy_count")
    .eq("family_id", familyId)
    .eq("name_normalized", normalized)
    .maybeSingle();

  if (existing) {
    const buyCount = existing.buy_count + 1;
    const avgPrice = (Number(existing.avg_price) * existing.buy_count + price) / buyCount;
    await supabase
      .from("products")
      .update({
        last_price: price,
        avg_price: Math.round(avgPrice),
        buy_count: buyCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from("products")
    .insert({
      family_id: familyId,
      name: trimmed,
      name_normalized: normalized,
      last_price: price,
      avg_price: price,
      buy_count: 1,
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

/** Simpan/segarkan katalog produk untuk seluruh item satu transaksi. */
export async function resolveProducts(
  supabase: AdminClient,
  familyId: string,
  items: { name: string; price: number }[]
) {
  for (const item of items) {
    await resolveProduct(supabase, familyId, item.name, Math.round(item.price));
  }
}
