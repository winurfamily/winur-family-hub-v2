import "server-only";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/app/actions/auth";
import type { SessionPayload } from "@/lib/session";

export type AdminClient = ReturnType<typeof createAdminClient>;

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Gerbang tunggal untuk seluruh modul keuangan.
 *
 * Sebelumnya sebagian besar fungsi baca (getFinanceSummary, getIncomeHistory,
 * getTransferHistory, ...) hanya memanggil getCurrentSession(), sehingga profil
 * ANAK yang sedang login bisa memanggil Server Action tersebut dan membaca
 * seluruh keuangan keluarga. Semua akses keuangan sekarang wajib role admin.
 */
export async function requireFinanceSession(): Promise<SessionPayload | null> {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export const FORBIDDEN = "Tidak diizinkan.";

/**
 * Terjemahkan error PostgREST/plpgsql menjadi pesan yang aman ditampilkan.
 *
 * RPC keuangan melempar `raise exception ... using errcode='P0001'` (aturan
 * bisnis, mis. "Saldo pocket tidak cukup") dan 'P0002' (data tidak ditemukan).
 * Keduanya sudah berbahasa Indonesia dan aman ditampilkan apa adanya. Error
 * lain (constraint violation, koneksi) diganti pesan generik supaya detail
 * internal database tidak bocor ke UI.
 */
export function rpcError(error: PostgrestError | null, fallback: string): string {
  if (!error) return fallback;

  if (error.code === "P0001" || error.code === "P0002") {
    return error.message.replace(/^.*?:\s*/, "") || fallback;
  }
  if (error.code === "23505") {
    return "Data serupa sudah tersimpan.";
  }

  console.error("[keuangan] rpc gagal", { code: error.code, message: error.message });
  return fallback;
}

/** Bersihkan cache seluruh halaman keuangan setelah mutasi. */
export function revalidateKeuangan() {
  revalidatePath("/admin");
  revalidatePath("/admin/keuangan");
  revalidatePath("/admin/keuangan/pockets");
  revalidatePath("/admin/keuangan/transfer");
  revalidatePath("/admin/keuangan/pendapatan");
  revalidatePath("/admin/keuangan/riwayat");
  revalidatePath("/admin/keuangan/belanja");
  revalidatePath("/admin/keuangan/storage");
}

/** Pastikan nominal rupiah selalu bilangan bulat & wajar (I.9). */
export function toRupiah(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Normalisasi token idempotency dari client; nilai tak valid diabaikan. */
export function safeToken(value: unknown): string | null {
  return isUuid(value) ? value : null;
}
