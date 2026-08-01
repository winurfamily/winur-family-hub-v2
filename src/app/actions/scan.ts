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

// ---------------------------------------------------------------------------
// Struk berkas penuh (PDF multi-halaman)
// ---------------------------------------------------------------------------

/** Satu baris hasil ekstraksi, lengkap dengan penanda ragu. */
export interface ScannedReceiptLine extends ScannedItem {
  /** Nomor urut pada struk (001, 002, ...) — urutannya dipertahankan. */
  position: number;
  /** Total baris menurut struk. 0 bila tidak tercetak. */
  lineTotal: number;
  /** Potongan khusus baris ini. */
  discount: number;
  /**
   * Alasan baris ini perlu ditinjau manusia. Kosong = terbaca yakin.
   * Diisi ketika angka tidak terbaca jelas ATAU qty × harga ≠ total baris.
   */
  review: string[];
}

export interface ScanDocumentResult {
  success: boolean;
  error?: string;
  merchant?: string;
  address?: string;
  date?: string;
  time?: string;
  refNo?: string;
  lines?: ScannedReceiptLine[];
  /** Angka yang TERCETAK di struk — bukan hasil hitung ulang. */
  printedSubtotal?: number;
  printedDiscount?: number;
  printedVoucher?: number;
  printedTotal?: number;
  printedItemCount?: number;
  pageCount?: number;
}

const DOCUMENT_PROMPT = [
  "Kamu membaca SELURUH HALAMAN sebuah struk belanja Indonesia (dot-matrix, hasil pindai).",
  "Baca semua halaman dari awal sampai akhir — jangan berhenti di halaman pertama.",
  "",
  "Kembalikan HANYA JSON dengan bentuk:",
  '{"merchant":string,"address":string,"date":"YYYY-MM-DD","time":"HH:MM","refNo":string,',
  '"lines":[{"position":number,"name":string,"qty":number,"unit":string,"price":number,',
  '"lineTotal":number,"discount":number,"uncertain":boolean}],',
  '"printedSubtotal":number,"printedDiscount":number,"printedVoucher":number,',
  '"printedTotal":number,"printedItemCount":number}',
  "",
  "Aturan yang WAJIB dipatuhi:",
  "- Pertahankan URUTAN produk persis seperti tercetak; isi position dengan nomor urutnya.",
  "- price = harga SATUAN, lineTotal = total baris. Keduanya angka murni tanpa titik/koma.",
  "- discount = potongan baris (angka positif). 0 bila tidak ada.",
  "- JANGAN MENEBAK. Bila sebuah angka atau huruf tidak terbaca jelas, tetap tulis",
  "  pembacaan terbaikmu TETAPI set uncertain:true untuk baris itu.",
  "- printed* diisi apa adanya dari bagian akhir struk (TOTAL SUM, TOTAL DISKON,",
  "  voucher, TOTAL HARUS DIBAYAR, TOTAL_ITEM). Jangan dihitung ulang sendiri.",
  "- Jangan menambah, menggabungkan, atau membuang baris produk.",
].join("\n");

/**
 * Baca satu BERKAS struk utuh — termasuk PDF berhalaman banyak.
 *
 * Berbeda dari `scanReceipt` yang membaca satu foto, fungsi ini menyerahkan
 * berkasnya apa adanya ke model sehingga SELURUH halaman terbaca dalam satu
 * konteks. Itu penting untuk struk panjang: nomor urut produk, diskon yang
 * tercetak di bawah barisnya, dan blok total di halaman terakhir harus dibaca
 * bersama-sama agar bisa dicocokkan.
 *
 * Sama seperti scanReceipt, fungsi ini MURNI MEMBACA — tidak ada satu baris
 * pun yang ditulis ke database di sini. Hasilnya masuk ke layar review dulu.
 */
export async function scanReceiptDocument(input: {
  dataUrl: string;
  filename?: string;
}): Promise<ScanDocumentResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY belum diisi. Tambahkan API key untuk mengaktifkan Scan AI.",
    };
  }

  const isPdf = input.dataUrl?.startsWith("data:application/pdf");
  const isImage = input.dataUrl?.startsWith("data:image");
  if (!isPdf && !isImage) return { success: false, error: "Format berkas tidak didukung." };

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4o",
      max_output_tokens: 16000,
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            isPdf
              ? {
                  type: "input_file" as const,
                  filename: input.filename?.trim() || "struk.pdf",
                  file_data: input.dataUrl,
                }
              : { type: "input_image" as const, image_url: input.dataUrl, detail: "high" as const },
            { type: "input_text" as const, text: DOCUMENT_PROMPT },
          ],
        },
      ],
    });

    const raw = response.output_text;
    if (!raw) return { success: false, error: "AI tidak memberikan respons. Silakan isi manual." };

    return normalizeDocument(JSON.parse(raw));
  } catch (err) {
    console.error("[scan] gagal membaca berkas struk", err);
    return {
      success: false,
      error: "Gagal membaca struk. Coba unggah ulang, atau isi manual.",
    };
  }
}

interface RawLine {
  position?: number;
  name?: string;
  qty?: number;
  unit?: string;
  price?: number;
  lineTotal?: number;
  discount?: number;
  uncertain?: boolean;
}

/**
 * Bersihkan hasil model dan TANDAI yang meragukan.
 *
 * Dua sumber keraguan diperlakukan sama pentingnya:
 *  1. model sendiri mengaku ragu (`uncertain`), dan
 *  2. aritmetikanya tidak konsisten — qty × harga satuan tidak sama dengan
 *     total baris yang tercetak.
 *
 * Yang kedua adalah pemeriksaan paling berguna pada struk dot-matrix, karena
 * di sanalah "3" terbaca sebagai "9" tanpa model menyadarinya. Angkanya TIDAK
 * diperbaiki diam-diam; barisnya hanya diberi label supaya manusia melihatnya.
 */
function normalizeDocument(parsed: Record<string, unknown>): ScanDocumentResult {
  const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as RawLine[]) : [];

  const lines: ScannedReceiptLine[] = rawLines.slice(0, 200).map((raw, index) => {
    const name = normalizeItemName(raw?.name) || "Item";
    const qty = Number.isFinite(Number(raw?.qty)) && Number(raw?.qty) > 0 ? Number(raw.qty) : 1;
    const price = Math.max(0, Math.round(Number(raw?.price) || 0));
    const lineTotal = Math.max(0, Math.round(Number(raw?.lineTotal) || 0));
    const discount = Math.max(0, Math.round(Number(raw?.discount) || 0));

    const review: string[] = [];
    if (raw?.uncertain) review.push("Angka tidak terbaca jelas");
    if (price === 0) review.push("Harga satuan kosong");

    // Toleransi 1 rupiah menyerap pembulatan timbangan (0,472 kg × 64.900).
    if (lineTotal > 0 && price > 0 && Math.abs(Math.round(qty * price) - lineTotal) > 1) {
      review.push(
        `Jumlah × harga (${Math.round(qty * price)}) ≠ total baris (${lineTotal})`
      );
    }

    return {
      position: Number.isFinite(Number(raw?.position)) ? Number(raw.position) : index + 1,
      name,
      qty,
      unit: normalizeUnit(raw?.unit),
      price,
      lineTotal,
      discount,
      review,
    };
  });

  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date ?? "")) ? String(parsed.date) : todayISODate();

  return {
    success: true,
    merchant: text(parsed.merchant, 80),
    address: text(parsed.address, 200),
    date,
    time: /^\d{2}:\d{2}/.test(String(parsed.time ?? "")) ? String(parsed.time).slice(0, 5) : "",
    refNo: text(parsed.refNo, 60),
    lines,
    printedSubtotal: num(parsed.printedSubtotal),
    printedDiscount: num(parsed.printedDiscount),
    printedVoucher: num(parsed.printedVoucher),
    printedTotal: num(parsed.printedTotal),
    printedItemCount: num(parsed.printedItemCount),
  };
}

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
