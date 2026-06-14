import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWeeklyStreak } from "@/app/actions/anak-overview";
import { todayISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Cron mingguan (Senin 00:01 WIB): inisialisasi baris weekly_streaks minggu
 * baru (days_complete=0) untuk semua anak (Decision #21). Minggu lalu yang
 * sudah is_complete=true tapi bonus_claimed=false tetap tersimpan sebagai
 * riwayat — bonus hanya bisa diklaim lewat tarik dana hari Minggu (Decision #20).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayISODate();

  const { data: children, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "child")
    .eq("status", "active");

  if (error) {
    console.error("streak-reset cron error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const child of children ?? []) {
    await computeWeeklyStreak(supabase, child.id, today);
  }

  return NextResponse.json({ ok: true, profiles: children?.length ?? 0, today });
}
