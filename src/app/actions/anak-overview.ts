"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server/admin-helpers";
import { todayISODate } from "@/lib/format";
import { getWeekRange } from "@/lib/dunia-anak";
import type { TaskStatus, TaskType, InvestmentStatus, TugasQuestion } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------------
// Streak helper (dipakai oleh overview & tugas)
// ---------------------------------------------------------------------------

export interface StreakInfo {
  weekStart: string;
  weekEnd: string;
  daysComplete: number;
  isComplete: boolean;
  bonusClaimed: boolean;
  /** Status selesai per hari Sen..Min (7 boolean) untuk minggu berjalan. */
  dayStatus: boolean[];
  /** True jika baru saja menjadi 7/7 pada pemanggilan ini (untuk trigger notifikasi). */
  justCompleted: boolean;
}

/**
 * Hitung ulang streak minggu berjalan untuk profile dan simpan ke weekly_streaks.
 * Hari dianggap "complete" jika ada minimal 1 task pada hari itu dan SEMUA task
 * pada hari itu berstatus 'approved' (Decision #21).
 */
export async function computeWeeklyStreak(
  supabase: AdminClient,
  profileId: string,
  dateStr: string
): Promise<StreakInfo> {
  const { weekStart, weekEnd } = getWeekRange(dateStr);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("day_date, status")
    .eq("profile_id", profileId)
    .gte("day_date", weekStart)
    .lte("day_date", weekEnd);

  const days = new Map<string, TaskStatus[]>();
  (tasks ?? []).forEach((t) => {
    const arr = days.get(t.day_date) ?? [];
    arr.push(t.status);
    days.set(t.day_date, arr);
  });

  let daysComplete = 0;
  const dayStatus: boolean[] = [];
  const monday = new Date(`${weekStart}T00:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const statuses = days.get(iso) ?? [];
    const complete = statuses.length > 0 && statuses.every((s) => s === "approved");
    if (complete) daysComplete += 1;
    dayStatus.push(complete);
  }

  const isComplete = daysComplete === 7;

  const { data: existing } = await supabase
    .from("weekly_streaks")
    .select("id, bonus_claimed, is_complete")
    .eq("profile_id", profileId)
    .eq("week_start", weekStart)
    .maybeSingle();

  const justCompleted = isComplete && !(existing?.is_complete ?? false);

  if (existing) {
    await supabase
      .from("weekly_streaks")
      .update({ days_complete: daysComplete, is_complete: isComplete })
      .eq("id", existing.id);
  } else {
    await supabase.from("weekly_streaks").insert({
      profile_id: profileId,
      week_start: weekStart,
      week_end: weekEnd,
      days_complete: daysComplete,
      is_complete: isComplete,
    });
  }

  return { weekStart, weekEnd, daysComplete, isComplete, bonusClaimed: existing?.bonus_claimed ?? false, dayStatus, justCompleted };
}

// ---------------------------------------------------------------------------
// Children list
// ---------------------------------------------------------------------------

export interface ChildSummary {
  id: string;
  name: string;
  age: number | null;
  level: number;
  xp: number;
  xpNextLevel: number;
  point: number;
  saldo: number;
  saldoInvested: number;
  photoUrl: string | null;
  avatarUrl: string | null;
  streakDays: number;
}

export async function getChildren(): Promise<ChildSummary[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, age, level, xp, xp_next_level, point, saldo, saldo_invested, photo_url, active_avatar_id")
    .eq("family_id", session.familyId)
    .eq("role", "child")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (!data) return [];

  const today = todayISODate();
  const avatarIds = data.map((p) => p.active_avatar_id).filter((id): id is string => Boolean(id));
  const avatarMap = new Map<string, string>();
  if (avatarIds.length > 0) {
    const { data: avatars } = await supabase.from("avatars").select("id, image_url").in("id", avatarIds);
    avatars?.forEach((a) => avatarMap.set(a.id, a.image_url));
  }

  const result: ChildSummary[] = [];
  for (const p of data) {
    const streak = await computeWeeklyStreak(supabase, p.id, today);
    result.push({
      id: p.id,
      name: p.name,
      age: p.age,
      level: p.level,
      xp: p.xp,
      xpNextLevel: p.xp_next_level,
      point: p.point,
      saldo: Number(p.saldo),
      saldoInvested: Number(p.saldo_invested),
      photoUrl: p.photo_url,
      avatarUrl: p.active_avatar_id ? avatarMap.get(p.active_avatar_id) ?? null : null,
      streakDays: streak.daysComplete,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Info dasar (untuk header/layout)
// ---------------------------------------------------------------------------

export interface ChildBasicInfo {
  id: string;
  name: string;
  photoUrl: string | null;
  avatarUrl: string | null;
}

export async function getChildBasicInfo(childId: string): Promise<ChildBasicInfo | null> {
  const session = await requireAdmin();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, photo_url, active_avatar_id")
    .eq("id", childId)
    .eq("family_id", session.familyId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile) return null;

  let avatarUrl: string | null = null;
  if (profile.active_avatar_id) {
    const { data: avatar } = await supabase
      .from("avatars")
      .select("image_url")
      .eq("id", profile.active_avatar_id)
      .maybeSingle();
    avatarUrl = avatar?.image_url ?? null;
  }

  return { id: profile.id, name: profile.name, photoUrl: profile.photo_url, avatarUrl };
}

// ---------------------------------------------------------------------------
// Child overview (1 anak)
// ---------------------------------------------------------------------------

export interface TaskOverviewItem {
  id: string;
  type: TaskType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  rewardMoney: number;
  rewardPoint: number;
  rewardXp: number;
  status: TaskStatus;
  questions: TugasQuestion[] | null;
  userAnswers: number[] | null;
  score: number | null;
  submittedAt: string | null;
}

export interface ActiveInvestmentInfo {
  id: string;
  amount: number;
  returnPercent: number;
  estimatedReturn: number;
  startAt: string;
  endAt: string;
  status: InvestmentStatus;
  isDue: boolean;
}

export interface ChildOverview {
  profile: {
    id: string;
    name: string;
    age: number | null;
    level: number;
    xp: number;
    xpNextLevel: number;
    point: number;
    saldo: number;
    saldoInvested: number;
    photoUrl: string | null;
    avatarUrl: string | null;
    investReturnPercent: number;
    worldTheme: string;
  };
  streak: StreakInfo;
  todayTasks: TaskOverviewItem[];
  activeInvestment: ActiveInvestmentInfo | null;
  pendingWithdrawalCount: number;
}

export async function getChildOverview(childId: string): Promise<ChildOverview | null> {
  const session = await requireAdmin();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, name, age, level, xp, xp_next_level, point, saldo, saldo_invested, photo_url, active_avatar_id, invest_return_percent, world_theme, family_id"
    )
    .eq("id", childId)
    .eq("family_id", session.familyId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile) return null;

  const today = todayISODate();

  const [streak, tasksRes, investmentRes, withdrawalRes, avatarRes] = await Promise.all([
    computeWeeklyStreak(supabase, profile.id, today),
    supabase
      .from("tasks")
      .select(
        "id, type, title, description, image_url, category, reward_money, reward_point, reward_xp, status, questions, user_answers, score, submitted_at"
      )
      .eq("profile_id", profile.id)
      .eq("day_date", today)
      .order("created_at", { ascending: true }),
    supabase
      .from("investments")
      .select("id, amount, return_percent, estimated_return, start_at, end_at, status")
      .eq("profile_id", profile.id)
      .in("status", ["active", "completed"])
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("status", "pending"),
    profile.active_avatar_id
      ? supabase.from("avatars").select("image_url").eq("id", profile.active_avatar_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const todayTasks: TaskOverviewItem[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    description: t.description,
    imageUrl: t.image_url,
    category: t.category,
    rewardMoney: Number(t.reward_money),
    rewardPoint: t.reward_point,
    rewardXp: t.reward_xp,
    status: t.status,
    questions: t.questions,
    userAnswers: t.user_answers,
    score: t.score,
    submittedAt: t.submitted_at,
  }));

  let activeInvestment: ActiveInvestmentInfo | null = null;
  if (investmentRes.data) {
    const inv = investmentRes.data;
    activeInvestment = {
      id: inv.id,
      amount: Number(inv.amount),
      returnPercent: Number(inv.return_percent),
      estimatedReturn: Number(inv.estimated_return),
      startAt: inv.start_at,
      endAt: inv.end_at,
      status: inv.status,
      isDue: inv.status === "active" && new Date(inv.end_at) <= new Date(),
    };
  }

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      age: profile.age,
      level: profile.level,
      xp: profile.xp,
      xpNextLevel: profile.xp_next_level,
      point: profile.point,
      saldo: Number(profile.saldo),
      saldoInvested: Number(profile.saldo_invested),
      photoUrl: profile.photo_url,
      avatarUrl: (avatarRes as { data: { image_url: string } | null }).data?.image_url ?? null,
      investReturnPercent: Number(profile.invest_return_percent),
      worldTheme: profile.world_theme,
    },
    streak,
    todayTasks,
    activeInvestment,
    pendingWithdrawalCount: withdrawalRes.count ?? 0,
  };
}
