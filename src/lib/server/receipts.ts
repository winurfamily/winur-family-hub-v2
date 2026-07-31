import "server-only";
import type { AdminClient } from "@/lib/server/finance-helpers";

export const RECEIPT_BUCKET = "receipts";

/** Batas ukuran file mentah yang diterima server (F3.4). */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type ReceiptMime = (typeof RECEIPT_MIME_TYPES)[number];

/** Umur signed URL. Cukup untuk melihat/mengunduh, terlalu pendek untuk dibagikan ulang. */
export const RECEIPT_SIGNED_URL_TTL = 60 * 10;

const EXT_BY_MIME: Record<ReceiptMime, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function isReceiptMime(value: string): value is ReceiptMime {
  return (RECEIPT_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Path objek: family_id/tahun/bulan/uuid.ext (F3.15).
 * Nama file selalu UUID — nama asli dari perangkat tidak pernah dipakai,
 * sehingga tidak ada kebocoran informasi lewat nama file dan tidak ada
 * risiko path traversal.
 */
export function buildReceiptPath(familyId: string, mime: ReceiptMime, date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${familyId}/${year}/${month}/${crypto.randomUUID()}.${EXT_BY_MIME[mime]}`;
}

/** Pastikan path benar-benar milik keluarga ini sebelum operasi storage apa pun. */
export function pathBelongsToFamily(path: string, familyId: string): boolean {
  return path.startsWith(`${familyId}/`) && !path.includes("..");
}

/** Kaitkan struk yatim (transaction_id NULL) ke transaksi yang baru tersimpan. */
export async function attachReceiptToTransaction(
  supabase: AdminClient,
  familyId: string,
  receiptIds: string[],
  transactionId: string
) {
  const ids = receiptIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return;

  await supabase
    .from("receipt_attachments")
    .update({ transaction_id: transactionId })
    .eq("family_id", familyId)
    .in("id", ids);
}

export interface RemoveReceiptResult {
  removed: number;
  failed: string[];
}

/**
 * Hapus objek storage lalu metadatanya.
 *
 * Urutan ini disengaja: bila penghapusan objek gagal, baris metadata tetap ada
 * sehingga file masih terlacak dan bisa dicoba ulang. Kebalikannya akan
 * menghasilkan file hantu yang memakan kuota tanpa jejak.
 */
export async function removeReceiptFiles(
  supabase: AdminClient,
  familyId: string,
  receiptIds: string[]
): Promise<RemoveReceiptResult> {
  if (receiptIds.length === 0) return { removed: 0, failed: [] };

  const { data: rows } = await supabase
    .from("receipt_attachments")
    .select("id, storage_path")
    .eq("family_id", familyId)
    .in("id", receiptIds);

  const owned = (rows ?? []).filter((r) => pathBelongsToFamily(r.storage_path, familyId));
  if (owned.length === 0) return { removed: 0, failed: [] };

  const { error } = await supabase.storage.from(RECEIPT_BUCKET).remove(owned.map((r) => r.storage_path));

  if (error) {
    console.error("[receipts] gagal menghapus objek storage", error.message);
    return { removed: 0, failed: owned.map((r) => r.id) };
  }

  await supabase
    .from("receipt_attachments")
    .delete()
    .eq("family_id", familyId)
    .in(
      "id",
      owned.map((r) => r.id)
    );

  return { removed: owned.length, failed: [] };
}

/** Signed URL berumur pendek untuk melihat struk (F3.12). */
export async function signReceiptPath(
  supabase: AdminClient,
  familyId: string,
  storagePath: string
): Promise<string | null> {
  if (!pathBelongsToFamily(storagePath, familyId)) return null;

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(storagePath, RECEIPT_SIGNED_URL_TTL);

  if (error) {
    console.error("[receipts] gagal membuat signed URL", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
