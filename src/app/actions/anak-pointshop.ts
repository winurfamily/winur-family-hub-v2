"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { pushNotification } from "@/lib/server/notifications";
import { generateAndStoreImage, hasOpenAIKey } from "@/lib/ai";
import type { PointRewardInput } from "@/lib/validation/dunia-anak";
import type { PointRequestStatus } from "@/lib/supabase/types";

export interface PointRewardItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  minPointUnlock: number;
  isActive: boolean;
}

export interface PointRequestItem {
  id: string;
  childId: string;
  childName: string;
  rewardId: string;
  rewardName: string;
  pointCost: number;
  status: PointRequestStatus;
  requestedAt: string;
}

export interface PointShopOverview {
  rewards: PointRewardItem[];
  requests: PointRequestItem[];
}

export async function getPointShop(): Promise<PointShopOverview> {
  const session = await requireAdmin();
  if (!session) return { rewards: [], requests: [] };

  const supabase = createAdminClient();

  const [rewardsRes, childrenRes] = await Promise.all([
    supabase
      .from("point_rewards")
      .select("id, name, description, image_url, point_cost, min_point_unlock, is_active")
      .eq("family_id", session.familyId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name").eq("family_id", session.familyId).eq("role", "child"),
  ]);

  const rewards: PointRewardItem[] = (rewardsRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    pointCost: r.point_cost,
    minPointUnlock: r.min_point_unlock,
    isActive: r.is_active,
  }));

  const children = childrenRes.data ?? [];
  const childIds = children.map((c) => c.id);
  const childNameMap = new Map(children.map((c) => [c.id, c.name]));
  const rewardNameMap = new Map(rewards.map((r) => [r.id, r.name]));

  let requests: PointRequestItem[] = [];
  if (childIds.length > 0) {
    const { data } = await supabase
      .from("point_requests")
      .select("id, profile_id, reward_id, point_cost, status, requested_at")
      .in("profile_id", childIds)
      .order("requested_at", { ascending: false })
      .limit(50);

    requests = (data ?? []).map((r) => ({
      id: r.id,
      childId: r.profile_id,
      childName: childNameMap.get(r.profile_id) ?? "?",
      rewardId: r.reward_id,
      rewardName: rewardNameMap.get(r.reward_id) ?? "Hadiah",
      pointCost: r.point_cost,
      status: r.status,
      requestedAt: r.requested_at,
    }));
  }

  return { rewards, requests };
}

// ---------------------------------------------------------------------------
// Generate gambar hadiah via AI
// ---------------------------------------------------------------------------

export interface GenerateRewardImageResult {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

export async function generateRewardImage(name: string, description?: string): Promise<GenerateRewardImageResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!hasOpenAIKey()) {
    return { success: false, error: "OPENAI_API_KEY belum diisi di .env.local." };
  }

  const prompt = `A cheerful cartoon illustration of a reward item called "${name}"${
    description ? ` (${description})` : ""
  }, sky adventure theme, colorful, simple background, no text or letters in the image.`;

  const imageUrl = await generateAndStoreImage(prompt, "rewards");
  if (!imageUrl) return { success: false, error: "Gagal generate gambar." };

  return { success: true, imageUrl };
}

// ---------------------------------------------------------------------------
// Tambah hadiah
// ---------------------------------------------------------------------------

export async function createPointReward(input: PointRewardInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("point_rewards")
    .insert({
      family_id: session.familyId,
      name: input.name,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      point_cost: input.pointCost,
      min_point_unlock: input.minPointUnlock,
      is_active: true,
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createPointReward error", error);
    return { success: false, error: "Gagal menambahkan hadiah." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "point_rewards", inserted.id, "create", null, {
    name: input.name,
    point_cost: input.pointCost,
    min_point_unlock: input.minPointUnlock,
  });

  revalidatePath("/admin/dunia-anak/point-shop");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Aktif/non-aktifkan hadiah (Decision #39 — tidak ada hapus, hanya arsip)
// ---------------------------------------------------------------------------

export async function togglePointRewardActive(rewardId: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: reward } = await supabase
    .from("point_rewards")
    .select("id, family_id, is_active")
    .eq("id", rewardId)
    .maybeSingle();

  if (!reward || reward.family_id !== session.familyId) return { success: false, error: "Hadiah tidak ditemukan." };

  await supabase.from("point_rewards").update({ is_active: isActive }).eq("id", rewardId);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "point_rewards",
    rewardId,
    isActive ? "activate" : "archive",
    { is_active: reward.is_active },
    { is_active: isActive }
  );

  revalidatePath("/admin/dunia-anak/point-shop");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Approve / reject point request
// ---------------------------------------------------------------------------

export async function reviewPointRequest(requestId: string, approve: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: request } = await supabase.from("point_requests").select("*").eq("id", requestId).maybeSingle();
  if (!request) return { success: false, error: "Permintaan tidak ditemukan." };
  if (request.status !== "pending") return { success: false, error: "Permintaan sudah diproses." };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", request.profile_id).maybeSingle();
  if (!profile || profile.family_id !== session.familyId) return { success: false, error: "Profil anak tidak ditemukan." };

  const now = new Date().toISOString();

  if (approve) {
    if (profile.point < request.point_cost) {
      return { success: false, error: "Point anak tidak mencukupi." };
    }
    await supabase.from("profiles").update({ point: profile.point - request.point_cost }).eq("id", profile.id);
  }

  await supabase
    .from("point_requests")
    .update({
      status: (approve ? "approved" : "rejected") as PointRequestStatus,
      reviewed_at: now,
      reviewed_by: session.profileId,
    })
    .eq("id", requestId);

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "point_requests",
    requestId,
    approve ? "approve" : "reject",
    { status: "pending" },
    { status: approve ? "approved" : "rejected", point_cost: request.point_cost }
  );

  const { data: reward } = await supabase.from("point_rewards").select("name").eq("id", request.reward_id).maybeSingle();
  const rewardName = reward?.name ?? "Hadiah";

  if (approve) {
    await pushNotification(
      supabase,
      profile.id,
      "point_request_approved",
      "Penukaran Disetujui! 🎁",
      `"${rewardName}" sudah disiapkan oleh Ayah/Mamah!`,
      { requestId: request.id, rewardId: request.reward_id, rewardName, pointCost: request.point_cost }
    );
  } else {
    await pushNotification(
      supabase,
      profile.id,
      "point_request_rejected",
      "Penukaran Ditolak",
      `Penukaran "${rewardName}" ditolak. Coba bicarakan dengan Ayah/Mamah ya.`,
      { requestId: request.id, rewardId: request.reward_id, rewardName, pointCost: request.point_cost }
    );
  }

  revalidatePath("/admin/dunia-anak/point-shop");
  revalidatePath(`/child/${profile.id}/shop`);
  return { success: true };
}
