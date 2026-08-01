"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  isMissingSchema,
  FORBIDDEN,
  type AdminClient,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { RECEIPT_BUCKET } from "@/lib/server/receipts";
import { MAX_ITEM_NAME_LENGTH, normalizeItemName, normalizeUnit } from "@/lib/shopping-item";
import {
  fingerprintBytes,
  fingerprintReceiptData,
  isFingerprint,
} from "@/lib/receipt-fingerprint";

/**
 * Impor struk menjadi RENCANA BELANJA BARU berstatus draft.
 *
 * Yang membedakannya dari Scan AI biasa (yang langsung menuju transaksi):
 * impor ini tidak pernah menyentuh saldo dan tidak pernah membuat transaksi.
 * Ia hanya melahirkan satu rencana baru berisi barang-barang struk, yang
 * kemudian ditinjau, diperbaiki, lalu diselesaikan lewat "Selesaikan Belanja"
 * seperti rencana lain. Rencana yang sudah ada TIDAK PERNAH disentuh —
 * setiap impor selalu INSERT, tidak pernah UPDATE rencana mana pun.
 *
 * Idempotensi berlapis dua, karena keduanya gagal pada kasus yang berbeda:
 *
 *  - sidik jari BERKAS (SHA-256 byte aslinya) menangkap "PDF yang sama
 *    diunggah dua kali";
 *  - sidik jari DATA (merchant + tanggal + total) menangkap "struk yang sama
 *    difoto ulang", yang menghasilkan byte berbeda tetapi belanja yang sama.
 *
 * Keduanya menunjuk ke rencana yang sudah ada, bukan membuat rencana kedua.
 */

export interface ImportReceiptLine {
  name: string;
  qty: number;
  unit?: string;
  /** Harga satuan hasil ekstraksi/koreksi pengguna. */
  price: number;
  /** Potongan baris; disimpan sebagai catatan, bukan memotong harga. */
  discount?: number;
  /** Baris ini ditandai "perlu ditinjau" oleh ekstraksi. */
  needsReview?: boolean;
}

export interface ImportReceiptInput {
  /** Nama rencana yang akan dibuat. */
  name: string;
  merchant?: string;
  /** "YYYY-MM-DD" tanggal transaksi pada struk. */
  date?: string;
  refNo?: string;
  note?: string;
  lines: ImportReceiptLine[];
  /** Total akhir yang tercetak di struk — dicatat di catatan rencana. */
  printedTotal?: number;
  printedDiscount?: number;
  printedVoucher?: number;
  /** SHA-256 hex berkas struk. Wajib: inilah kunci idempotensinya. */
  fileFingerprint: string;
  /** Jumlah halaman yang dibaca — ikut dicatat untuk audit. */
  pageCount?: number;
  /** id receipt_attachments bila struknya sudah diunggah ke storage privat. */
  storagePath?: string;
}

export interface ImportReceiptResult {
  planId: string;
  /** true = struk ini sudah pernah diimpor; planId menunjuk rencana lama. */
  duplicate: boolean;
  itemCount: number;
  reviewCount: number;
}

/**
 * Cari impor terdahulu dengan sidik jari yang sama.
 *
 * Mengembalikan `null` juga ketika tabelnya belum ada (migration 0026 belum
 * diterapkan) — impor tetap berjalan, hanya kehilangan penjagaan duplikatnya.
 * Menolak impor karena tabel audit belum ada akan jauh lebih merugikan.
 */
async function findExistingImport(
  supabase: AdminClient,
  familyId: string,
  fileFingerprint: string,
  dataFingerprint: string
): Promise<{ plan_id: string | null } | null> {
  const { data, error } = await supabase
    .from("receipt_imports")
    .select("plan_id")
    .eq("family_id", familyId)
    .or(`file_fingerprint.eq.${fileFingerprint},data_fingerprint.eq.${dataFingerprint}`)
    .not("plan_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingSchema(error)) console.error("[receipt-import] gagal memeriksa duplikat", error.message);
    return null;
  }
  return data ?? null;
}

export async function importReceiptAsPlan(
  input: ImportReceiptInput
): Promise<ActionResult<ImportReceiptResult>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const name = normalizeItemName(input.name).slice(0, 60);
  if (!name) return { success: false, error: "Nama rencana wajib diisi." };

  const fileFingerprint = String(input.fileFingerprint ?? "").trim();
  if (!isFingerprint(fileFingerprint)) {
    return { success: false, error: "Sidik jari berkas tidak valid." };
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") ? input.date! : null;
  const merchant = String(input.merchant ?? "").trim().slice(0, 80);
  const printedTotal = Math.max(0, Math.round(Number(input.printedTotal) || 0));

  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .map((raw) => ({
      name: normalizeItemName(raw?.name),
      qty: Number(raw?.qty) > 0 ? Number(Number(raw.qty).toFixed(3)) : 1,
      unit: normalizeUnit(raw?.unit),
      price: Math.max(0, Math.round(Number(raw?.price) || 0)),
      discount: Math.max(0, Math.round(Number(raw?.discount) || 0)),
      needsReview: Boolean(raw?.needsReview),
    }))
    .filter((line) => line.name.length > 0 && line.name.length <= MAX_ITEM_NAME_LENGTH)
    .slice(0, 200);

  if (lines.length === 0) return { success: false, error: "Tidak ada barang untuk diimpor." };

  const supabase = createAdminClient();
  const dataFingerprint = fingerprintReceiptData(merchant || name, date ?? "", printedTotal);

  // ---- Penjaga duplikat -------------------------------------------------
  const existing = await findExistingImport(supabase, session.familyId, fileFingerprint, dataFingerprint);
  if (existing?.plan_id) {
    return {
      success: true,
      data: {
        planId: existing.plan_id,
        duplicate: true,
        itemCount: 0,
        reviewCount: 0,
      },
    };
  }

  // ---- Rencana BARU (selalu INSERT) -------------------------------------
  const noteParts = [
    input.note?.trim(),
    merchant ? `Struk ${merchant}` : null,
    input.refNo ? `Ref ${String(input.refNo).trim().slice(0, 40)}` : null,
    printedTotal > 0 ? `Total struk Rp${printedTotal.toLocaleString("id-ID")}` : null,
  ].filter(Boolean) as string[];

  const { data: plan, error: planError } = await supabase
    .from("shopping_plans")
    .insert({
      family_id: session.familyId,
      name,
      planned_date: date,
      note: noteParts.join(" · ").slice(0, 200) || null,
      // Draft, BUKAN done: struk yang baru diimpor belum menjadi pengeluaran
      // apa pun sampai pengguna memilih sumber dana dan mengonfirmasinya.
      status: "draft",
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (planError || !plan) return { success: false, error: "Gagal membuat rencana dari struk." };

  const { error: itemError } = await supabase.from("shopping_plan_items").insert(
    lines.map((line, index) => ({
      plan_id: plan.id,
      name: line.name,
      qty: line.qty,
      estimated_price: line.price,
      // Harga struk adalah harga yang BENAR-BENAR dibayar, jadi ia langsung
      // menjadi harga aktual — bukan sekadar perkiraan.
      actual_price: line.price,
      note: line.unit || null,
      position: index,
      // Barang struk memang sudah dibeli; itulah bedanya dengan rencana yang
      // diketik sendiri. Statusnya tetap bisa diubah di layar checklist.
      status: "bought" as const,
      checked: true,
    }))
  );

  if (itemError) {
    // Rencana kosong lebih membingungkan daripada tidak ada rencana sama sekali.
    await supabase.from("shopping_plans").delete().eq("id", plan.id);
    return { success: false, error: "Gagal menyimpan barang struk." };
  }

  await supabase
    .from("shopping_plans")
    .update({
      total_estimated: lines.reduce((acc, l) => acc + Math.round(l.qty * l.price), 0),
      total_actual: lines.reduce((acc, l) => acc + Math.round(l.qty * l.price), 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);

  // ---- Catat sidik jarinya ----------------------------------------------
  const { error: importError } = await supabase.from("receipt_imports").insert({
    family_id: session.familyId,
    plan_id: plan.id,
    file_fingerprint: fileFingerprint,
    data_fingerprint: dataFingerprint,
    merchant: merchant || null,
    receipt_date: date,
    total_amount: printedTotal || null,
    item_count: lines.length,
    page_count: Math.max(0, Math.round(Number(input.pageCount) || 0)),
    storage_path: input.storagePath ?? null,
    created_by: session.profileId,
  });

  if (importError && !isMissingSchema(importError)) {
    // Tabrakan unique = dua unggahan berbarengan. Rencana yang baru dibuat
    // dibuang dan yang lebih dulu menang, sehingga tetap hanya ada satu.
    const winner = await findExistingImport(supabase, session.familyId, fileFingerprint, dataFingerprint);
    if (winner?.plan_id && winner.plan_id !== plan.id) {
      await supabase.from("shopping_plan_items").delete().eq("plan_id", plan.id);
      await supabase.from("shopping_plans").delete().eq("id", plan.id);
      return {
        success: true,
        data: { planId: winner.plan_id, duplicate: true, itemCount: 0, reviewCount: 0 },
      };
    }
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "shopping_plan",
    plan.id,
    "import_receipt",
    null,
    { name, items: lines.length, merchant, pages: input.pageCount ?? 0 }
  );
  revalidateKeuangan();

  return {
    success: true,
    data: {
      planId: plan.id,
      duplicate: false,
      itemCount: lines.length,
      reviewCount: lines.filter((l) => l.needsReview).length,
    },
  };
}

/**
 * Unggah berkas struk ke bucket privat `receipts`.
 *
 * Nama berkas selalu UUID dan path-nya selalu diawali family_id, sehingga
 * tidak ada nama asli dari perangkat yang bocor dan tidak ada keluarga lain
 * yang bisa menebak jalur berkas milik keluarga ini. Berkasnya hanya bisa
 * dibuka lewat signed URL berumur pendek (lihat lib/server/receipts.ts).
 */
export async function uploadReceiptDocument(input: {
  dataUrl: string;
  mimeType: string;
}): Promise<ActionResult<{ storagePath: string; fingerprint: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(input.mimeType)) {
    return { success: false, error: "Hanya PDF atau gambar yang bisa diunggah." };
  }

  const base64 = input.dataUrl.includes(",")
    ? input.dataUrl.slice(input.dataUrl.indexOf(",") + 1)
    : input.dataUrl;
  const bytes = Buffer.from(base64, "base64");

  if (bytes.byteLength === 0) return { success: false, error: "Berkas kosong." };
  if (bytes.byteLength > 10 * 1024 * 1024) return { success: false, error: "Berkas melebihi 10 MB." };

  const ext = input.mimeType === "application/pdf" ? "pdf" : input.mimeType.split("/")[1];
  const now = new Date();
  const path = `${session.familyId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: input.mimeType, upsert: false });

  if (error) {
    console.error("[receipt-import] gagal mengunggah struk", error.message);
    return { success: false, error: "Gagal mengunggah berkas struk." };
  }

  return {
    success: true,
    data: { storagePath: path, fingerprint: fingerprintBytes(bytes) },
  };
}
