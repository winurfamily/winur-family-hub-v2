"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  isUuid,
  FORBIDDEN,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import {
  RECEIPT_BUCKET,
  RECEIPT_MAX_BYTES,
  buildReceiptPath,
  isReceiptMime,
  removeReceiptFiles,
  signReceiptPath,
} from "@/lib/server/receipts";

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadReceiptInput {
  /** data URL hasil kompresi di browser, mis. "data:image/webp;base64,..." */
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface UploadedReceipt {
  id: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  signedUrl: string | null;
}

/**
 * Terima struk yang sudah dikompresi di browser, simpan ke bucket privat
 * `receipts`, lalu catat metadatanya.
 *
 * Baris receipt_attachments dibuat dengan transaction_id NULL. Transaksi
 * belanja menautkannya SETELAH tersimpan, sehingga upload yang gagal atau
 * form yang dibatalkan tidak pernah menghasilkan transaksi setengah jadi —
 * yang tertinggal hanya file lepas yang bisa dibersihkan lewat Storage Manager.
 */
export async function uploadReceipt(input: UploadReceiptInput): Promise<ActionResult<UploadedReceipt>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(input.dataUrl ?? "");
  if (!match) return { success: false, error: "Format gambar tidak valid." };

  const [, mime, base64] = match;
  if (!isReceiptMime(mime)) {
    return { success: false, error: "Format harus JPG, PNG, atau WEBP." };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { success: false, error: "Gambar gagal dibaca." };
  }

  if (buffer.byteLength === 0) return { success: false, error: "Gambar kosong." };
  if (buffer.byteLength > RECEIPT_MAX_BYTES) {
    return { success: false, error: "Ukuran gambar melebihi 10 MB." };
  }

  const supabase = createAdminClient();
  const storagePath = buildReceiptPath(session.familyId, mime);

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: false });

  if (uploadError) {
    console.error("[receipts] upload gagal", uploadError.message);
    return { success: false, error: "Gagal mengunggah struk. Coba lagi." };
  }

  const { data: row, error: metaError } = await supabase
    .from("receipt_attachments")
    .insert({
      family_id: session.familyId,
      transaction_id: null,
      storage_path: storagePath,
      file_size: buffer.byteLength,
      mime_type: mime,
      width: Number.isFinite(input.width) ? Math.round(input.width!) : null,
      height: Number.isFinite(input.height) ? Math.round(input.height!) : null,
      uploaded_by: session.profileId,
    })
    .select("id")
    .single();

  if (metaError || !row) {
    // Metadata gagal -> objek storage dibuang supaya tidak jadi file hantu
    // yang memakan kuota tanpa jejak di database.
    await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
    return { success: false, error: "Gagal menyimpan data struk." };
  }

  const signedUrl = await signReceiptPath(supabase, session.familyId, storagePath);

  return {
    success: true,
    data: {
      id: row.id,
      storagePath,
      fileSize: buffer.byteLength,
      mimeType: mime,
      signedUrl,
    },
  };
}

/** URL bertanda tangan berumur pendek untuk melihat satu struk. */
export async function getReceiptUrl(receiptId: string): Promise<string | null> {
  const session = await requireFinanceSession();
  if (!session || !isUuid(receiptId)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("receipt_attachments")
    .select("storage_path")
    .eq("id", receiptId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!data) return null;
  return signReceiptPath(supabase, session.familyId, data.storage_path);
}

export async function getReceiptUrls(receiptIds: string[]): Promise<Record<string, string>> {
  const session = await requireFinanceSession();
  if (!session) return {};

  const ids = receiptIds.filter(isUuid);
  if (ids.length === 0) return {};

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("receipt_attachments")
    .select("id, storage_path")
    .eq("family_id", session.familyId)
    .in("id", ids);

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    const url = await signReceiptPath(supabase, session.familyId, row.storage_path);
    if (url) result[row.id] = url;
  }
  return result;
}

/** Hapus satu struk (dipakai tombol "ganti/hapus gambar" sebelum menyimpan). */
export async function deleteReceipt(receiptId: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(receiptId)) return { success: false, error: "Struk tidak ditemukan." };

  const supabase = createAdminClient();
  const result = await removeReceiptFiles(supabase, session.familyId, [receiptId]);

  if (result.removed === 0) {
    return { success: false, error: "Gagal menghapus struk." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "receipt", receiptId, "delete", null, null);
  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Storage Manager
// ---------------------------------------------------------------------------

export interface StorageFileItem {
  id: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  transactionId: string | null;
  transactionLabel: string | null;
}

export interface StorageMonthUsage {
  month: string;
  bytes: number;
  fileCount: number;
}

export interface StorageOverview {
  totalBytes: number;
  fileCount: number;
  orphanCount: number;
  orphanBytes: number;
  quotaBytes: number;
  quotaIsEstimate: boolean;
  usedPercent: number;
  byMonth: StorageMonthUsage[];
  largest: StorageFileItem[];
  orphans: StorageFileItem[];
}

export interface StorageFileFilter {
  dateFrom?: string;
  dateTo?: string;
  minBytes?: number;
  onlyOrphan?: boolean;
  limit?: number;
}

/**
 * Kuota tidak tersedia lewat API resmi Supabase untuk kunci service-role,
 * jadi dipakai nilai konfigurasi STORAGE_QUOTA_MB dan ditandai "perkiraan"
 * di UI (F4).
 */
function quotaBytes(): { bytes: number; isEstimate: boolean } {
  const configured = Number(process.env.STORAGE_QUOTA_MB);
  const mb = Number.isFinite(configured) && configured > 0 ? configured : 1024;
  return { bytes: mb * 1024 * 1024, isEstimate: true };
}

export async function getStorageOverview(): Promise<StorageOverview | null> {
  const session = await requireFinanceSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const quota = quotaBytes();

  const [usageRes, monthRes, largestRes, orphanRes] = await Promise.all([
    supabase.rpc("fin_storage_usage", { p_family_id: session.familyId }),
    supabase.rpc("fin_storage_usage_by_month", { p_family_id: session.familyId }),
    listFiles(supabase, session.familyId, { limit: 10 }),
    listFiles(supabase, session.familyId, { onlyOrphan: true, limit: 50 }),
  ]);

  const usage = usageRes.data?.[0] ?? {
    total_bytes: 0,
    file_count: 0,
    orphan_count: 0,
    orphan_bytes: 0,
  };

  const totalBytes = Number(usage.total_bytes);

  return {
    totalBytes,
    fileCount: Number(usage.file_count),
    orphanCount: Number(usage.orphan_count),
    orphanBytes: Number(usage.orphan_bytes),
    quotaBytes: quota.bytes,
    quotaIsEstimate: quota.isEstimate,
    usedPercent: quota.bytes > 0 ? Math.min(100, (totalBytes / quota.bytes) * 100) : 0,
    byMonth: (monthRes.data ?? []).map((m) => ({
      month: m.month,
      bytes: Number(m.bytes),
      fileCount: Number(m.file_count),
    })),
    largest: largestRes,
    orphans: orphanRes,
  };
}

async function listFiles(
  supabase: ReturnType<typeof createAdminClient>,
  familyId: string,
  filter: StorageFileFilter
): Promise<StorageFileItem[]> {
  let query = supabase
    .from("receipt_attachments")
    .select("id, storage_path, file_size, mime_type, created_at, transaction_id")
    .eq("family_id", familyId);

  if (filter.onlyOrphan) query = query.is("transaction_id", null);
  if (filter.dateFrom) query = query.gte("created_at", `${filter.dateFrom}T00:00:00Z`);
  if (filter.dateTo) query = query.lte("created_at", `${filter.dateTo}T23:59:59Z`);
  if (Number.isFinite(filter.minBytes)) query = query.gte("file_size", filter.minBytes!);

  const { data } = await query
    .order("file_size", { ascending: false })
    .limit(Math.min(200, Math.max(1, filter.limit ?? 50)));

  const rows = data ?? [];
  const txIds = Array.from(new Set(rows.map((r) => r.transaction_id).filter(isUuid)));

  const { data: transactions } =
    txIds.length > 0
      ? await supabase
          .from("shopping_transactions")
          .select("id, merchant, name, date")
          .eq("family_id", familyId)
          .in("id", txIds)
      : { data: [] as { id: string; merchant: string | null; name: string; date: string }[] };

  const labels = new Map(
    (transactions ?? []).map((t) => [t.id, `${t.merchant ?? t.name} · ${t.date}`] as const)
  );

  return rows.map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    fileSize: Number(r.file_size),
    mimeType: r.mime_type,
    createdAt: r.created_at,
    transactionId: r.transaction_id,
    transactionLabel: r.transaction_id ? labels.get(r.transaction_id) ?? null : null,
  }));
}

export async function getStorageFiles(filter: StorageFileFilter = {}): Promise<StorageFileItem[]> {
  const session = await requireFinanceSession();
  if (!session) return [];
  const supabase = createAdminClient();
  return listFiles(supabase, session.familyId, filter);
}

/** Hapus beberapa file sekaligus. Selalu dipanggil setelah konfirmasi pengguna. */
export async function deleteReceipts(receiptIds: string[]): Promise<ActionResult<{ removed: number }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const ids = receiptIds.filter(isUuid);
  if (ids.length === 0) return { success: false, error: "Tidak ada file yang dipilih." };
  if (ids.length > 200) return { success: false, error: "Maksimal 200 file sekali hapus." };

  const supabase = createAdminClient();
  const result = await removeReceiptFiles(supabase, session.familyId, ids);

  if (result.removed === 0) {
    return { success: false, error: "Gagal menghapus file." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "receipt", null, "bulk_delete", null, {
    removed: result.removed,
  });
  revalidateKeuangan();
  return { success: true, data: { removed: result.removed } };
}

/** Bersihkan seluruh file yang tidak tertaut transaksi mana pun. */
export async function cleanupOrphanReceipts(): Promise<ActionResult<{ removed: number }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const supabase = createAdminClient();
  const { data: orphans } = await supabase
    .from("receipt_attachments")
    .select("id")
    .eq("family_id", session.familyId)
    .is("transaction_id", null);

  const ids = (orphans ?? []).map((o) => o.id);
  if (ids.length === 0) return { success: true, data: { removed: 0 } };

  const result = await removeReceiptFiles(supabase, session.familyId, ids);

  await logAudit(supabase, session.familyId, session.profileId, "receipt", null, "cleanup_orphan", null, {
    removed: result.removed,
  });
  revalidateKeuangan();
  return { success: true, data: { removed: result.removed } };
}
