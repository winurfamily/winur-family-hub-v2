"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { syncSavingsPocket } from "@/lib/server/child-savings";
import { INVESTMENT } from "@/lib/constants";
import type { InvestmentStatus } from "@/lib/supabase/types";

export interface ChildInvestmentItem {
  id: string;
  amount: number;
  returnPercent: number;
  estimatedReturn: number;
  actualReturn: number | null;
  startAt: string;
  endAt: string;
  status: InvestmentStatus;
  isDue: boolean;
  progressPercent: number;
}

export interface ChildInvestmentOverview {
  saldo: number;
  saldoInvested: number;
  currentReturnPercent: number;
  quickAmounts: readonly number[];
  durationDays: number;
  hasActive: boolean;
  investments: ChildInvestmentItem[];
}

export async function getChildInvestments(childId: string): Promise<ChildInvestmentOverview | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("saldo, saldo_invested, invest_return_percent")
    .eq("id", childId)
    .maybeSingle();

  if (!profile) return null;

  const { data } = await supabase
    .from("investments")
    .select("id, amount, return_percent, estimated_return, actual_return, start_at, end_at, status")
    .eq("profile_id", childId)
    .order("start_at", { ascending: false });

  const now = new Date();
  let hasActive = false;
  const investments: ChildInvestmentItem[] = (data ?? []).map((inv) => {
    const start = new Date(inv.start_at).getTime();
    const end = new Date(inv.end_at).getTime();
    const isActive = inv.status === "active";
    if (isActive) hasActive = true;
    const progress = isActive ? Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100)) : 100;

    return {
      id: inv.id,
      amount: Number(inv.amount),
      returnPercent: Number(inv.return_percent),
      estimatedReturn: Number(inv.estimated_return),
      actualReturn: inv.actual_return !== null ? Number(inv.actual_return) : null,
      startAt: inv.start_at,
      endAt: inv.end_at,
      status: inv.status,
      isDue: isActive && new Date(inv.end_at) <= now,
      progressPercent: Math.round(progress),
    };
  });

  return {
    saldo: Number(profile.saldo),
    saldoInvested: Number(profile.saldo_invested),
    currentReturnPercent: Number(profile.invest_return_percent),
    quickAmounts: INVESTMENT.QUICK_AMOUNTS,
    durationDays: INVESTMENT.DURATION_DAYS,
    hasActive,
    investments,
  };
}

/** Mulai investasi baru (Decision #22/#23 — 30 hari, tidak bisa dibatalkan, 1 aktif per anak). */
export async function startInvestment(childId: string, amount: number): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Nominal investasi tidak valid." };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", childId).maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  if (amount > Number(profile.saldo)) {
    return { success: false, error: "Saldo kamu tidak cukup." };
  }

  const { data: existing } = await supabase
    .from("investments")
    .select("id")
    .eq("profile_id", childId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Kamu masih punya investasi yang berjalan. Tunggu sampai selesai ya." };
  }

  const returnPercent = Number(profile.invest_return_percent);
  const estimatedReturn = Math.round((amount * returnPercent) / 100);
  const startAt = new Date();
  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + INVESTMENT.DURATION_DAYS);

  const newSaldo = Number(profile.saldo) - amount;
  const newSaldoInvested = Number(profile.saldo_invested) + amount;

  const { data: inserted, error } = await supabase
    .from("investments")
    .insert({
      profile_id: childId,
      amount,
      return_percent: returnPercent,
      estimated_return: estimatedReturn,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "active",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("startInvestment error", error);
    return { success: false, error: "Gagal memulai investasi." };
  }

  await supabase.from("profiles").update({ saldo: newSaldo, saldo_invested: newSaldoInvested }).eq("id", childId);

  await syncSavingsPocket(supabase, profile.family_id, profile.name, -amount);

  await supabase.from("saldo_transactions").insert({
    profile_id: childId,
    type: "investment_in",
    amount: -amount,
    balance_after: newSaldo,
    reference_id: inserted.id,
    note: "Mulai investasi",
  });

  await logAudit(supabase, profile.family_id, childId, "investments", inserted.id, "start", null, {
    amount,
    return_percent: returnPercent,
    estimated_return: estimatedReturn,
  });

  revalidatePath(`/child/${childId}/investasi`);
  revalidatePath(`/child/${childId}`);
  return { success: true };
}
