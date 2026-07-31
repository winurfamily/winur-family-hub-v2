"use server";

import { requireFinanceSession } from "@/lib/server/finance-helpers";
import { todayISODate } from "@/lib/format";
import { normalizeItemName, normalizeUnit } from "@/lib/shopping-item";

export interface ScannedItem {
  name: string;
  qty: number;
  price: number;
  /** Satuan bila tertulis di struk ("kg", "pcs"). Kosong bila tidak ada. */
  unit: string;
}

export interface ScanReceiptResult {
  success: boolean;
  error?: string;
  storeName?: string;
  date?: string;
  items?: ScannedItem[];
  total?: number;
}

const PROMPT =
  'Kamu membaca foto struk belanja Indonesia. Kembalikan HANYA JSON dengan format: ' +
  '{"storeName": string, "date": "YYYY-MM-DD", "items": [{"name": string, "qty": number, "unit": string, "price": number}], "total": number}. ' +
  '"price" adalah HARGA SATUAN dalam Rupiah sebagai angka murni (tanpa titik, koma, atau simbol). ' +
  '"qty" adalah kuantitas barang. "unit" adalah satuannya bila tertulis di struk ' +
  '(mis. "kg", "gram", "liter", "pcs", "bungkus"); kosongkan bila tidak tertulis. ' +
  'Jika tanggal tidak terbaca, kosongkan field date.';

/**
 * Baca struk dengan GPT-4o Vision.
 *
 * Fungsi ini murni membaca — TIDAK menulis apa pun ke database. Hasilnya
 * dikembalikan ke client untuk ditinjau, dan baru menjadi transaksi lewat
 * createShoppingTransaction setelah pengguna mengonfirmasi (F5.9).
 */
export async function scanReceipt(imageDataUrl: string): Promise<ScanReceiptResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY belum diisi. Isi manual dulu, atau tambahkan API key untuk mengaktifkan Scan AI.",
    };
  }

  if (!imageDataUrl?.startsWith("data:image")) {
    return { success: false, error: "Format gambar tidak valid." };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { success: false, error: "AI tidak memberikan respons. Silakan isi manual." };

    const parsed = JSON.parse(raw) as {
      storeName?: string;
      date?: string;
      total?: number;
      items?: { name?: string; qty?: number; price?: number; unit?: string }[];
    };

    // Nilai dari model tidak pernah dipercaya apa adanya: setiap angka
    // dinormalisasi, dan tanggal tak valid diganti hari ini.
    const items: ScannedItem[] = Array.isArray(parsed.items)
      ? parsed.items
          .map((i) => ({
            name: normalizeItemName(i?.name) || "Item",
            qty: Number.isFinite(Number(i?.qty)) && Number(i?.qty) > 0 ? Number(i?.qty) : 1,
            unit: normalizeUnit(i?.unit),
            price: Math.max(0, Math.round(Number(i?.price) || 0)),
          }))
          .slice(0, 100)
      : [];

    const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date ?? "") ? parsed.date! : todayISODate();

    return {
      success: true,
      storeName: String(parsed.storeName ?? "").trim().slice(0, 80),
      date,
      items,
      total: Math.round(Number(parsed.total) || items.reduce((acc, i) => acc + i.qty * i.price, 0)),
    };
  } catch (err) {
    console.error("[scan] gagal membaca struk", err);
    return {
      success: false,
      error: "Gagal membaca struk. Coba foto ulang dengan pencahayaan lebih baik, atau isi manual.",
    };
  }
}
