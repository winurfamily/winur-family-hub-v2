"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { logAudit, type ActionResult } from "@/lib/server/admin-helpers";

export interface ShopRewardItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  minPointUnlock: number;
  unlocked: boolean;
  affordable: boolean;
  requestStatus: "none" | "pending" | "approved" | "rejected";
}

export interface ChildShopOverview {
  point: number;
  rewards: ShopRewardItem[];
}

export async function getChildShop(childId: string): Promise<ChildShopOverview | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("family_id, point").eq("id", childId).maybeSingle();
  if (!profile) return null;

  const [rewardsRes, requestsRes] = await Promise.all([
    supabase
      .from("point_rewards")
      .select("id, name, description, image_url, point_cost, min_point_unlock")
      .eq("family_id", profile.family_id)
      .eq("is_active", true)
      .order("min_point_unlock", { ascending: true }),
    supabase
      .from("point_requests")
      .select("reward_id, status, requested_at")
      .eq("profile_id", childId)
      .order("requested_at", { ascending: false }),
  ]);

  const latestStatus = new Map<string, "pending" | "approved" | "rejected">();
  (requestsRes.data ?? []).forEach((r) => {
    if (!latestStatus.has(r.reward_id)) latestStatus.set(r.reward_id, r.status);
  });

  const rewards: ShopRewardItem[] = (rewardsRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    pointCost: r.point_cost,
    minPointUnlock: r.min_point_unlock,
    unlocked: profile.point >= r.min_point_unlock,
    affordable: profile.point >= r.point_cost,
    requestStatus: latestStatus.get(r.id) ?? "none",
  }));

  return { point: profile.point, rewards };
}

/** Anak ajukan penukaran point untuk satu hadiah (Decision #24/#25 — point dipotong saat admin approve). */
export async function requestPointReward(childId: string, rewardId: string): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("family_id, point").eq("id", childId).maybeSingle();
  if (!profile) return { success: false, error: "Profil tidak ditemukan." };

  const { data: reward } = await supabase.from("point_rewards").select("*").eq("id", rewardId).maybeSingle();
  if (!reward || reward.family_id !== profile.family_id || !reward.is_active) {
    return { success: false, error: "Hadiah tidak ditemukan." };
  }

  if (profile.point < reward.min_point_unlock) {
    return { success: false, error: "Point kamu belum cukup untuk membuka hadiah ini." };
  }
  if (profile.point < reward.point_cost) {
    return { success: false, error: "Point kamu tidak cukup untuk menukar hadiah ini." };
  }

  const { data: existing } = await supabase
    .from("point_requests")
    .select("id")
    .eq("profile_id", childId)
    .eq("reward_id", rewardId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Kamu sudah mengajukan penukaran untuk hadiah ini." };
  }

  const { data: inserted, error } = await supabase
    .from("point_requests")
    .insert({
      profile_id: childId,
      reward_id: rewardId,
      point_cost: reward.point_cost,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("requestPointReward error", error);
    return { success: false, error: "Gagal mengajukan penukaran." };
  }

  await logAudit(supabase, profile.family_id, childId, "point_requests", inserted.id, "request", null, {
    reward_id: rewardId,
    reward_name: reward.name,
    point_cost: reward.point_cost,
  });

  revalidatePath(`/child/${childId}/shop`);
  return { success: true };
}
