"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { pushNotification } from "@/lib/server/notifications";
import { formatRupiah, todayISODate } from "@/lib/format";
import { isSunday, getWeekRange } from "@/lib/dunia-anak";
import type { WithdrawalStatus } from "@/lib/supabase/types";

export interface WithdrawalItem {
  id: string;
  amount: number;
  includeStreakBonus: boolean;
  streakBonusAmount: number;
  streakBonusPoint: number;
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt: string | null;
  note: string | null;
}

export async function getWithdrawalRequests(childId: string): Promise<WithdrawalItem[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return [];

  const { data } = await supabase
    .from("withdrawal_requests")
    .select("id, amount, include_streak_bonus, streak_bonus_amount, streak_bonus_point, status, requested_at, reviewed_at, note")
    .eq("profile_id", childId)
    .order("requested_at", { ascending: false });

  return (data ?? []).map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    includeStreakBonus: w.include_streak_bonus,
    streakBonusAmount: Number(w.streak_bonus_amount),
    streakBonusPoint: w.streak_bonus_point,
    status: w.status,
    requestedAt: w.requested_at,
    reviewedAt: w.reviewed_at,
    note: w.note,
  }));
}

// ---------------------------------------------------------------------------
// Klaim mingguan: approve/reject (hanya Minggu, Decision #20)
// ---------------------------------------------------------------------------

export async function reviewWithdrawalRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const today = todayISODate();
  if (!isSunday(today)) {
    return { success: false, error: "Tarik dana / klaim mingguan hanya bisa diproses pada hari Minggu." };
  }

  const supabase = createAdminClient();
  const { data: request } = await supabase.from("withdrawal_requests").select("*").eq("id", requestId).maybeSingle();
  if (!request) return { success: false, error: "Permintaan tidak ditemukan." };
  if (request.status !== "pending") return { success: false, error: "Permintaan sudah diproses." };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", request.profile_id).maybeSingle();
  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const now = new Date().toISOString();

  if (!approve) {
    await supabase
      .from("withdrawal_requests")
      .update({ status: "rejected" as WithdrawalStatus, reviewed_at: now, reviewed_by: session.profileId })
      .eq("id", requestId);

    await logAudit(supabase, session.familyId, session.profileId, "withdrawal_requests", requestId, "reject", { status: "pending" }, { status: "rejected" });

    await pushNotification(
      supabase,
      profile.id,
      "withdrawal_rejected",
      "Tarik Dana Ditolak",
      `Permintaan tarik dana ${formatRupiah(Number(request.amount))} ditolak. Coba bicarakan dengan Ayah/Mamah ya.`,
      { requestId: request.id, amount: Number(request.amount) }
    );

    revalidatePath(`/admin/dunia-anak/${profile.id}/tarik-dana`);
    revalidatePath(`/child/${profile.id}/klaim`);
    return { success: true };
  }

  const bonusMoney = request.include_streak_bonus ? Number(request.streak_bonus_amount) : 0;
  const bonusPoint = request.include_streak_bonus ? request.streak_bonus_point : 0;

  const newSaldo = Number(profile.saldo) - Number(request.amount) + bonusMoney;
  const newPoint = profile.point + bonusPoint;

  await supabase.from("profiles").update({ saldo: newSaldo, point: newPoint }).eq("id", profile.id);

  await supabase
    .from("withdrawal_requests")
    .update({ status: "approved" as WithdrawalStatus, reviewed_at: now, reviewed_by: session.profileId })
    .eq("id", requestId);

  await supabase.from("saldo_transactions").insert({
    profile_id: profile.id,
    type: "withdrawal",
    amount: -Number(request.amount),
    balance_after: bonusMoney > 0 ? Number(profile.saldo) - Number(request.amount) : newSaldo,
    reference_id: request.id,
    note: "Tarik dana disetujui",
  });

  if (bonusMoney > 0) {
    await supabase.from("saldo_transactions").insert({
      profile_id: profile.id,
      type: "streak_bonus",
      amount: bonusMoney,
      balance_after: newSaldo,
      reference_id: request.id,
      note: "Bonus streak 7/7 hari",
    });

    const { weekStart } = getWeekRange(today);
    await supabase.from("weekly_streaks").update({ bonus_claimed: true }).eq("profile_id", profile.id).eq("week_start", weekStart);
  }

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "withdrawal_requests",
    requestId,
    "approve",
    { status: "pending" },
    { status: "approved", amount: request.amount, streak_bonus: bonusMoney }
  );

  const message =
    bonusMoney > 0
      ? `${formatRupiah(Number(request.amount))} + bonus streak ${formatRupiah(bonusMoney)} sudah dicairkan!`
      : `${formatRupiah(Number(request.amount))} sudah dicairkan!`;

  await pushNotification(supabase, profile.id, "withdrawal_approved", "Tarik Dana Disetujui! 💰", message, {
    requestId: request.id,
    amount: Number(request.amount),
    streakBonusAmount: bonusMoney,
    streakBonusPoint: bonusPoint,
  });

  revalidatePath(`/admin/dunia-anak/${profile.id}/tarik-dana`);
  revalidatePath(`/admin/dunia-anak/${profile.id}`);
  revalidatePath(`/child/${profile.id}`);
  revalidatePath(`/child/${profile.id}/klaim`);
  return { success: true };
}
