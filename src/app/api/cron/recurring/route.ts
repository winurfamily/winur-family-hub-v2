import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecurringOccurrences } from "@/lib/server/recurring-server";
import { todayISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Cron harian (00:05 WIB): buat "tagihan menunggu" untuk setiap jadwal rutin
 * yang jatuh tempo, termasuk beberapa hari ke depan agar pengingatnya muncul
 * SEBELUM tanggalnya.
 *
 * Yang dibuat di sini hanyalah tagihan menunggu — TIDAK ADA saldo yang
 * berubah dan tidak ada transaksi yang dibuat. Uang baru berpindah setelah
 * Ayah/Mamah menekan Konfirmasi di menu Keuangan. Cron yang memotong saldo
 * sendiri berarti kesalahan nominal bisa berjalan berbulan-bulan tanpa ada
 * yang menyadarinya.
 *
 * Aman dijalankan berkali-kali sehari: unique (recurring_id, due_date) di
 * migration 0025 membuat RPC-nya idempotent.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayISODate();

  const { data: families, error } = await supabase.from("families").select("id");
  if (error) {
    console.error("recurring cron error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let missingSchema = false;

  for (const family of families ?? []) {
    const result = await generateRecurringOccurrences(supabase, family.id, today);
    if (result.missingSchema) {
      // Migration 0025 belum ada di lingkungan ini. Berhenti tanpa error —
      // fitur ini memang belum aktif, dan cron tidak boleh berisik karenanya.
      missingSchema = true;
      break;
    }
    if (result.ok) processed += 1;
  }

  return NextResponse.json({ ok: true, today, processed, missingSchema });
}
