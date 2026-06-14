"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { computeWeeklyStreak } from "@/app/actions/anak-overview";
import { todayISODate } from "@/lib/format";
import { isSunday } from "@/lib/dunia-anak";
import { REWARD } from "@/lib/constants";
import type { WithdrawalStatus, SaldoTransactionType } from "@/lib/supabase/types";

export interface WithdrawalHistoryItem {
  id: string;
  amount: number;
  includeStreakBonus: boolean;
  streakBonusAmount: number;
  streakBonusPoint: number;
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface SaldoTransactionItem {
  id: string;
  type: SaldoTransactionType;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface ClaimOverview {
  saldo: number;
  point: number;
  isSunday: boolean;
  streakDaysComplete: number;
  streakComplete: boolean;
  streakBonusClaimed: boolean;
  streakBonusMoney: number;
  streakBonusPoint: number;
  pendingRequest: WithdrawalHistoryItem | null;
  history: WithdrawalHistoryItem[];
  recentTransactions: SaldoTransactionItem[];
}

export async function getChildKlaim(childId: string): Promise<ClaimOverview | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("family_id, saldo, point").eq("id", childId).maybeSingle();
  if (!profile) return null;

  const today = todayISODate();
  const [streak, family, withdrawalsRes, txRes] = await Promise.all([
    computeWeeklyStreak(supabase, childId, today),
    supabase.from("families").select("streak_bonus_money, streak_bonus_point").eq("id", profile.family_id).maybeSingle(),
    supabase
      .from("withdrawal_requests")
      .select("id, amount, include_streak_bonus, streak_bonus_amount, streak_bonus_point, status, requested_at, reviewed_at")
      .eq("profile_id", childId)
      .order("requested_at", { ascending: false })
      .limit(20),
    supabase
      .from("saldo_transactions")
      .select("id, type, amount, note, created_at")
      .eq("profile_id", childId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const history: WithdrawalHistoryItem[] = (withdrawalsRes.data ?? []).map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    includeStreakBonus: w.include_streak_bonus,
    streakBonusAmount: Number(w.streak_bonus_amount),
    streakBonusPoint: w.streak_bonus_point,
    status: w.status,
    requestedAt: w.requested_at,
    reviewedAt: w.reviewed_at,
  }));

  const recentTransactions: SaldoTransactionItem[] = (txRes.data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    note: t.note,
    createdAt: t.created_at,
  }));

  return {
    saldo: Number(profile.saldo),
    point: profile.point,
    isSunday: isSunday(today),
    streakDaysComplete: streak.daysComplete,
    streakComplete: streak.isComplete,
    streakBonusClaimed: streak.bonusClaimed,
    streakBonusMoney: Number(family.data?.streak_bonus_money ?? REWARD.STREAK_BONUS_MONEY),
    streakBonusPoint: family.data?.streak_bonus_point ?? REWARD.STREAK_BONUS_POINT,
    pendingRequest: history.find((h) => h.status === "pending") ?? null,
    history,
    recentTransactions,
  };
}

/** Ajukan tarik dana mingguan (Decision #20 — hanya hari Minggu, perlu approve admin). */
export async function requestWithdrawal(childId: string, amount: number, includeStreakBonus: boolean): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const today = todayISODate();
  if (!isSunday(today)) {
    return { success: false, error: "Tarik dana hanya bisa diajukan pada hari Minggu." };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", childId).maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  if (!Number.isFinite(amount) || amount < 0 || amount > Number(profile.saldo)) {
    return { success: false, error: "Nominal tarik dana tidak valid." };
  }
  if (amount === 0 && !includeStreakBonus) {
    return { success: false, error: "Nominal tarik dana tidak valid." };
  }

  const { data: pending } = await supabase
    .from("withdrawal_requests")
    .select("id")
    .eq("profile_id", childId)
    .eq("status", "pending")
    .maybeSingle();

  if (pending) {
    return { success: false, error: "Kamu sudah punya permintaan tarik dana yang menunggu persetujuan." };
  }

  let streakBonusAmount = 0;
  let streakBonusPoint = 0;

  if (includeStreakBonus) {
    const streak = await computeWeeklyStreak(supabase, childId, today);
    if (!streak.isComplete || streak.bonusClaimed) {
      return { success: false, error: "Bonus streak minggu ini belum tersedia." };
    }
    const { data: family } = await supabase
      .from("families")
      .select("streak_bonus_money, streak_bonus_point")
      .eq("id", profile.family_id)
      .maybeSingle();
    streakBonusAmount = Number(family?.streak_bonus_money ?? REWARD.STREAK_BONUS_MONEY);
    streakBonusPoint = family?.streak_bonus_point ?? REWARD.STREAK_BONUS_POINT;
  }

  const { data: inserted, error } = await supabase
    .from("withdrawal_requests")
    .insert({
      profile_id: childId,
      amount,
      include_streak_bonus: includeStreakBonus,
      streak_bonus_amount: streakBonusAmount,
      streak_bonus_point: streakBonusPoint,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("requestWithdrawal error", error);
    return { success: false, error: "Gagal mengajukan tarik dana." };
  }

  await logAudit(supabase, profile.family_id, childId, "withdrawal_requests", inserted.id, "request", null, {
    amount,
    include_streak_bonus: includeStreakBonus,
    streak_bonus_amount: streakBonusAmount,
  });

  revalidatePath(`/child/${childId}/klaim`);
  return { success: true };
}
