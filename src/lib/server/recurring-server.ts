import "server-only";
import { isMissingSchema, type AdminClient } from "@/lib/server/finance-helpers";
import { todayISODate } from "@/lib/format";
import { shiftDate, RECURRING_LEAD_DAYS } from "@/lib/recurring";

/**
 * Pastikan setiap jadwal rutin yang jatuh tempo punya "tagihan menunggu".
 *
 * Bukan Server Action (menerima klien Supabase sebagai argumen), jadi tinggal
 * di lib/server dan bukan di berkas "use server" — seluruh ekspor berkas
 * "use server" menjadi endpoint yang bisa dipanggil browser, dan klien
 * database tidak boleh menjadi argumen yang menyeberangi batas itu.
 *
 * Dipanggil dari DUA tempat yang saling menambal:
 *  - cron harian Vercel, supaya pengingat tetap muncul walau aplikasinya tidak
 *    dibuka berhari-hari;
 *  - saat halaman Keuangan dibuka, supaya fitur ini tetap benar seandainya
 *    cron gagal, tertunda, atau belum terpasang di lingkungan baru.
 *
 * Menjalankan keduanya aman: RPC-nya idempotent lewat unique
 * (recurring_id, due_date), jadi tidak ada tagihan yang lahir dua kali.
 *
 * Horizon sengaja beberapa hari ke DEPAN (RECURRING_LEAD_DAYS) supaya
 * pengingat tampil sebelum tanggal jatuh tempo, bukan setelah terlambat.
 */
export async function generateRecurringOccurrences(
  supabase: AdminClient,
  familyId: string,
  today = todayISODate()
): Promise<{ ok: boolean; missingSchema: boolean }> {
  const { error } = await supabase.rpc("fin_generate_recurring_occurrences", {
    p_family_id: familyId,
    p_horizon: shiftDate(today, RECURRING_LEAD_DAYS),
  });

  if (!error) return { ok: true, missingSchema: false };
  if (isMissingSchema(error)) return { ok: false, missingSchema: true };

  console.error("[rutin] gagal membuat jatuh tempo", { code: error.code, message: error.message });
  return { ok: false, missingSchema: false };
}
