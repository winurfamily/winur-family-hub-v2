import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Cron harian (00:00 WIB): task/tugas yang masih 'published' atau 'taken'
 * dari hari sebelumnya dianggap kedaluwarsa (Decision #39 — status flag,
 * bukan delete). Anak tidak bisa lagi mengerjakan task lama setelah hari
 * berganti; admin publish task baru untuk hari berjalan.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayISODate();

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "expired" })
    .lt("day_date", today)
    .in("status", ["published", "taken"])
    .select("id");

  if (error) {
    console.error("task-reset cron error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: data?.length ?? 0, today });
}
