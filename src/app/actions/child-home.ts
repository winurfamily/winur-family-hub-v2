"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import { computeWeeklyStreak } from "@/app/actions/anak-overview";
import type { StreakInfo, TaskOverviewItem, ActiveInvestmentInfo } from "@/app/actions/anak-overview";
import { todayISODate } from "@/lib/format";
import { isSunday } from "@/lib/dunia-anak";

export interface ChildHomeProfile {
  id: string;
  name: string;
  age: number | null;
  level: number;
  xp: number;
  xpNextLevel: number;
  point: number;
  saldo: number;
  saldoInvested: number;
  savingsBalance: number;
  activeInvestmentTotal: number;
  avatarUrl: string | null;
  petUrl: string | null;
  petName: string | null;
  investReturnPercent: number;
  worldTheme: string;
  activeThemeKey: string | null;
  investmentProgressPercent: number;
}

export interface ChildHomeData {
  profile: ChildHomeProfile;
  streak: StreakInfo;
  todayTasks: TaskOverviewItem[];
  todayProgress: { completed: number; total: number };
  activeInvestment: ActiveInvestmentInfo | null;
  unreadNotifications: number;
  canClaimStreak: boolean;
}

/** Data lengkap untuk halaman Beranda anak (Sprint 5). */
export async function getChildHome(childId: string): Promise<ChildHomeData | null> {
  const session = await requireChild(childId);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, family_id, name, age, level, xp, xp_next_level, point, saldo, saldo_invested, active_avatar_id, active_pet_id, invest_return_percent, world_theme, active_theme_key"
    )
    .eq("id", childId)
    .maybeSingle();

  if (!profile) return null;

  const today = todayISODate();

  const [streak, tasksRes, investmentRes, activeInvestmentsRes, savingsRes, unreadRes, avatarRes, petRes] = await Promise.all([
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
    supabase.from("investments").select("amount").eq("profile_id", profile.id).eq("status", "active"),
    supabase
      .from("pockets")
      .select("balance")
      .eq("family_id", profile.family_id)
      .ilike("name", `Tabungan ${profile.name}`)
      .maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("read", false),
    profile.active_avatar_id
      ? supabase.from("avatars").select("image_url").eq("id", profile.active_avatar_id).maybeSingle()
      : Promise.resolve({ data: null }),
    profile.active_pet_id
      ? supabase.from("pets").select("image_url, name").eq("id", profile.active_pet_id).maybeSingle()
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

  let investmentProgressPercent = 0;
  if (investmentRes.data && investmentRes.data.status === "active") {
    const start = new Date(investmentRes.data.start_at).getTime();
    const end = new Date(investmentRes.data.end_at).getTime();
    investmentProgressPercent = Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)));
  }

  const completed = todayTasks.filter((t) => t.status === "approved").length;
  const avatarData = (avatarRes as { data: { image_url: string } | null }).data;
  const petData = (petRes as { data: { image_url: string; name: string } | null }).data;
  const activeInvestmentTotal = (activeInvestmentsRes.data ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);
  const savingsBalance = Number(savingsRes.data?.balance ?? 0);

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
      savingsBalance,
      activeInvestmentTotal,
      avatarUrl: avatarData?.image_url ?? null,
      petUrl: petData?.image_url ?? null,
      petName: petData?.name ?? null,
      investReturnPercent: Number(profile.invest_return_percent),
      worldTheme: profile.world_theme,
      activeThemeKey: profile.active_theme_key,
      investmentProgressPercent,
    },
    streak,
    todayTasks,
    todayProgress: { completed, total: todayTasks.length },
    activeInvestment,
    unreadNotifications: unreadRes.count ?? 0,
    canClaimStreak: isSunday(today) && streak.isComplete && !streak.bonusClaimed,
  };
}
