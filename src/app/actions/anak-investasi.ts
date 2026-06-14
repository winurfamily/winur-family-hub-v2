"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { pushNotification } from "@/lib/server/notifications";
import { formatRupiah } from "@/lib/format";
import type { InvestmentStatus } from "@/lib/supabase/types";

export interface InvestmentItem {
  id: string;
  amount: number;
  returnPercent: number;
  estimatedReturn: number;
  actualReturn: number | null;
  startAt: string;
  endAt: string;
  status: InvestmentStatus;
  isDue: boolean;
}

export interface InvestmentOverview {
  currentReturnPercent: number;
  investments: InvestmentItem[];
}

export async function getInvestments(childId: string): Promise<InvestmentOverview | null> {
  const session = await requireAdmin();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("invest_return_percent, family_id")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) return null;

  const { data } = await supabase
    .from("investments")
    .select("id, amount, return_percent, estimated_return, actual_return, start_at, end_at, status")
    .eq("profile_id", childId)
    .order("start_at", { ascending: false });

  const now = new Date();
  const investments: InvestmentItem[] = (data ?? []).map((inv) => ({
    id: inv.id,
    amount: Number(inv.amount),
    returnPercent: Number(inv.return_percent),
    estimatedReturn: Number(inv.estimated_return),
    actualReturn: inv.actual_return !== null ? Number(inv.actual_return) : null,
    startAt: inv.start_at,
    endAt: inv.end_at,
    status: inv.status,
    isDue: inv.status === "active" && new Date(inv.end_at) <= now,
  }));

  return { currentReturnPercent: Number(profile.invest_return_percent), investments };
}

// ---------------------------------------------------------------------------
// Setting % return investasi per anak (Decision #22/#23)
// ---------------------------------------------------------------------------

export async function setInvestReturnPercent(childId: string, percent: number): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };
  if (percent < 0 || percent > 100) return { success: false, error: "Persentase harus antara 0-100." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, invest_return_percent")
    .eq("id", childId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile || profile.family_id !== session.familyId) {
    return { success: false, error: "Profil anak tidak ditemukan." };
  }

  await supabase.from("profiles").update({ invest_return_percent: percent }).eq("id", childId);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "profiles",
    childId,
    "update_invest_return_percent",
    { invest_return_percent: Number(profile.invest_return_percent) },
    { invest_return_percent: percent }
  );

  revalidatePath(`/admin/dunia-anak/${childId}/investasi`);
  revalidatePath(`/admin/dunia-anak/${childId}/profil`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Konfirmasi investasi selesai -> saldo + return masuk
// ---------------------------------------------------------------------------

export async function confirmInvestmentDone(investmentId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: inv } = await supabase.from("investments").select("*").eq("id", investmentId).maybeSingle();
  if (!inv) return { success: false, error: "Investasi tidak ditemukan." };
  if (inv.status !== "active") return { success: false, error: "Investasi sudah dikonfirmasi sebelumnya." };
  if (new Date(inv.end_at) > new Date()) return { success: false, error: "Investasi belum jatuh tempo." };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", inv.profile_id).maybeSingle();
  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const actualReturn = Number(inv.estimated_return);
  const newSaldo = Number(profile.saldo) + Number(inv.amount) + actualReturn;
  const newSaldoInvested = Math.max(0, Number(profile.saldo_invested) - Number(inv.amount));
  const now = new Date().toISOString();

  await supabase.from("profiles").update({ saldo: newSaldo, saldo_invested: newSaldoInvested }).eq("id", profile.id);

  await supabase
    .from("investments")
    .update({
      status: "confirmed" as InvestmentStatus,
      actual_return: actualReturn,
      completed_at: now,
      confirmed_at: now,
      confirmed_by: session.profileId,
    })
    .eq("id", investmentId);

  await supabase.from("saldo_transactions").insert({
    profile_id: profile.id,
    type: "investment_return",
    amount: Number(inv.amount) + actualReturn,
    balance_after: newSaldo,
    reference_id: inv.id,
    note: `Investasi selesai, return +${actualReturn}`,
  });

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "investments",
    inv.id,
    "confirm_done",
    { status: "active" },
    { status: "confirmed", actual_return: actualReturn }
  );

  await pushNotification(
    supabase,
    profile.id,
    "investment_done",
    "Investasi Selesai! 📈",
    `Modal ${formatRupiah(Number(inv.amount))} + untung ${formatRupiah(actualReturn)} sudah masuk ke saldo kamu.`,
    { investmentId: inv.id, amount: Number(inv.amount), actualReturn }
  );

  revalidatePath(`/admin/dunia-anak/${profile.id}/investasi`);
  revalidatePath(`/admin/dunia-anak/${profile.id}`);
  revalidatePath(`/child/${profile.id}`);
  revalidatePath(`/child/${profile.id}/investasi`);
  return { success: true };
}
