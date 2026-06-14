"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, logAudit, type ActionResult } from "@/lib/server/admin-helpers";
import { generateJSON, generateAndStoreImage, hasOpenAIKey } from "@/lib/ai";
import { applyXpGain } from "@/lib/dunia-anak";
import { unlockAssetsForProfile } from "@/lib/server/assets";
import { pushNotification } from "@/lib/server/notifications";
import { syncSavingsPocket } from "@/lib/server/child-savings";
import { computeWeeklyStreak } from "@/app/actions/anak-overview";
import { currentMonth, monthRange } from "@/lib/finance";
import { formatRupiah, todayISODate } from "@/lib/format";
import { REWARD, findTaskCategory } from "@/lib/constants";
import type { PublishTaskInput, TugasQuestionInput } from "@/lib/validation/dunia-anak";
import type { TaskType, TaskStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Generate draft via AI
// ---------------------------------------------------------------------------

export interface TaskDraft {
  title: string;
  description: string;
  imageUrl: string | null;
  category: string;
  rewardMoney: number;
  rewardPoint: number;
  rewardXp: number;
  questions?: TugasQuestionInput[];
}

export interface GenerateTaskResult {
  success: boolean;
  error?: string;
  draft?: TaskDraft;
}

export async function generateTaskDraft(
  childId: string,
  type: TaskType,
  category: string,
  useAiImage: boolean
): Promise<GenerateTaskResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  if (!hasOpenAIKey()) {
    return {
      success: false,
      error: "OPENAI_API_KEY belum diisi di .env.local. Tambahkan API key untuk mengaktifkan generate AI.",
    };
  }

  const categoryInfo = findTaskCategory(type, category);
  if (!categoryInfo) return { success: false, error: "Kategori tidak valid." };

  const supabase = createAdminClient();
  const [{ data: profile }, { data: family }] = await Promise.all([
    supabase.from("profiles").select("name, age, world_theme").eq("id", childId).maybeSingle(),
    supabase
      .from("families")
      .select(
        "default_task_money, default_task_point, default_task_xp, default_tugas_money, default_tugas_point, default_tugas_xp"
      )
      .eq("id", session.familyId)
      .maybeSingle(),
  ]);

  if (!profile) return { success: false, error: "Profil anak tidak ditemukan." };

  try {
    if (type === "task") {
      const data = await generateJSON<{ title: string; description: string; image_prompt: string }>(
        "Kamu adalah asisten yang membuat tugas rumah harian sederhana untuk anak-anak Indonesia, dalam format JSON. " +
          'Balas HANYA JSON dengan keys: "title" (judul singkat, max 8 kata, Bahasa Indonesia), ' +
          '"description" (instruksi singkat 1-2 kalimat), ' +
          '"image_prompt" (prompt Bahasa Inggris untuk membuat ilustrasi kartun ceria bertema petualangan langit yang menggambarkan tugas ini, cocok untuk anak-anak, tanpa teks/tulisan di gambar).',
        `Buatkan 1 ide tugas rumah harian (chores) untuk anak bernama ${profile.name}, usia ${profile.age ?? "anak-anak"} tahun. Tema dunia anak: ${profile.world_theme}. ` +
          `Kategori tugas WAJIB "${categoryInfo.label}", contoh aktivitas dalam kategori ini: ${categoryInfo.hint}. ` +
          `Pilih salah satu aktivitas yang relevan dengan kategori tersebut, jangan keluar dari kategori.`
      );

      if (!data) return { success: false, error: "Gagal generate task dari AI. Coba lagi." };

      const imageUrl = useAiImage ? await generateAndStoreImage(data.image_prompt, "tasks") : null;

      return {
        success: true,
        draft: {
          title: data.title,
          description: data.description,
          imageUrl,
          category,
          rewardMoney: family?.default_task_money ?? REWARD.TASK_MONEY,
          rewardPoint: family?.default_task_point ?? REWARD.TASK_POINT,
          rewardXp: family?.default_task_xp ?? REWARD.TASK_XP,
        },
      };
    }

    // type === "tugas" — 5 soal pilihan ganda
    const data = await generateJSON<{
      title: string;
      description: string;
      image_prompt: string;
      questions: TugasQuestionInput[];
    }>(
      "Kamu adalah asisten yang membuat kuis edukatif pilihan ganda untuk anak-anak Indonesia, dalam format JSON. " +
        'Balas HANYA JSON dengan keys: "title" (judul singkat, max 8 kata, Bahasa Indonesia), ' +
        '"description" (deskripsi singkat 1 kalimat tentang topik kuis), ' +
        '"image_prompt" (prompt Bahasa Inggris untuk ilustrasi kartun ceria bertema petualangan langit, tanpa teks/tulisan di gambar), ' +
        '"questions" (array berisi TEPAT 5 object, masing-masing dengan keys: "question" (Bahasa Indonesia), ' +
        '"options" (array 4 string pilihan jawaban), "correct_answer" (index 0-3 jawaban benar), ' +
        '"explanation" (penjelasan singkat jawaban benar dalam Bahasa Indonesia)).',
      `Buatkan 1 kuis edukatif (5 soal pilihan ganda) untuk anak bernama ${profile.name}, usia ${profile.age ?? "anak-anak"} tahun, sesuai usia tersebut. ` +
        `Topik kuis WAJIB seputar "${categoryInfo.label}", fokus pada: ${categoryInfo.hint}. Jangan keluar dari topik tersebut.`
    );

    if (!data || !Array.isArray(data.questions) || data.questions.length !== 5) {
      return { success: false, error: "Gagal generate tugas dari AI. Coba lagi." };
    }

    const imageUrl = useAiImage ? await generateAndStoreImage(data.image_prompt, "tasks") : null;

    return {
      success: true,
      draft: {
        title: data.title,
        description: data.description,
        imageUrl,
        category,
        rewardMoney: family?.default_tugas_money ?? REWARD.TUGAS_MONEY,
        rewardPoint: family?.default_tugas_point ?? REWARD.TUGAS_POINT,
        rewardXp: family?.default_tugas_xp ?? REWARD.TUGAS_XP,
        questions: data.questions,
      },
    };
  } catch (err) {
    console.error("generateTaskDraft error", err);
    return { success: false, error: "Terjadi kesalahan saat generate dari AI." };
  }
}

// ---------------------------------------------------------------------------
// Publish task / tugas
// ---------------------------------------------------------------------------

function revalidateChild(childId: string) {
  revalidatePath(`/admin/dunia-anak/${childId}`);
  revalidatePath(`/admin/dunia-anak/${childId}/tugas`);
  revalidatePath("/admin/dunia-anak");
}

export async function publishTask(input: PublishTaskInput): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const today = todayISODate();

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("id, type")
    .eq("profile_id", input.childId)
    .eq("day_date", today)
    .neq("status", "skipped");

  const taskCount = (existingTasks ?? []).filter((t) => t.type === "task").length;
  const tugasCount = (existingTasks ?? []).filter((t) => t.type === "tugas").length;

  if (input.type === "task" && taskCount >= REWARD.MAX_TASK_PER_DAY) {
    return { success: false, error: `Maksimal ${REWARD.MAX_TASK_PER_DAY} task per hari.` };
  }
  if (input.type === "tugas" && tugasCount >= REWARD.MAX_TUGAS_PER_DAY) {
    return { success: false, error: `Maksimal ${REWARD.MAX_TUGAS_PER_DAY} tugas per hari.` };
  }
  if (input.type === "tugas" && (!input.questions || input.questions.length !== 5)) {
    return { success: false, error: "Tugas harus memiliki tepat 5 soal pilihan ganda." };
  }

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      profile_id: input.childId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      category: input.category ?? null,
      questions: input.type === "tugas" ? input.questions ?? null : null,
      day_date: today,
      reward_money: input.rewardMoney,
      reward_point: input.rewardPoint,
      reward_xp: input.rewardXp,
      status: "published",
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("publishTask error", error);
    return { success: false, error: "Gagal mempublikasikan task." };
  }

  await logAudit(supabase, session.familyId, session.profileId, "tasks", inserted.id, "publish", null, {
    type: input.type,
    title: input.title,
    reward_money: input.rewardMoney,
    reward_point: input.rewardPoint,
    reward_xp: input.rewardXp,
  });

  revalidateChild(input.childId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Approve task submitted -> saldo + point + xp
// ---------------------------------------------------------------------------

export async function approveTask(taskId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) return { success: false, error: "Task tidak ditemukan." };
  if (task.status !== "submitted") return { success: false, error: "Task belum disubmit oleh anak." };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", task.profile_id).maybeSingle();
  if (!profile || profile.family_id !== session.familyId) {
    return { success: false, error: "Profil anak tidak ditemukan." };
  }

  const xpResult = applyXpGain(profile.level, profile.xp, task.reward_xp);
  const newSaldo = Number(profile.saldo) + Number(task.reward_money);
  const newPoint = profile.point + task.reward_point;
  const now = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({
      saldo: newSaldo,
      point: newPoint,
      level: xpResult.level,
      xp: xpResult.xp,
      xp_next_level: xpResult.xpNextLevel,
    })
    .eq("id", profile.id);

  await syncSavingsPocket(supabase, profile.family_id, profile.name, Number(task.reward_money));

  await supabase
    .from("tasks")
    .update({
      status: "approved" as TaskStatus,
      approved_at: now,
      approved_by: session.profileId,
      reward_claimed: true,
      reward_claimed_at: now,
    })
    .eq("id", taskId);

  await supabase.from("saldo_transactions").insert({
    profile_id: profile.id,
    type: "task_claim",
    amount: Number(task.reward_money),
    balance_after: newSaldo,
    reference_id: task.id,
    note: task.title,
  });

  await logAudit(supabase, session.familyId, session.profileId, "tasks", task.id, "approve", { status: task.status }, {
    status: "approved",
    reward_money: task.reward_money,
    reward_point: task.reward_point,
    reward_xp: task.reward_xp,
    leveled_up: xpResult.leveledUp,
    new_level: xpResult.level,
  });

  const rewardSummary = `+${formatRupiah(task.reward_money)} • +${task.reward_point} poin • +${task.reward_xp} XP`;
  if (task.type === "task") {
    await pushNotification(supabase, profile.id, "task_approved", "Task Disetujui! 🎉", `"${task.title}" — ${rewardSummary}`, {
      taskId: task.id,
      rewardMoney: Number(task.reward_money),
      rewardPoint: task.reward_point,
      rewardXp: task.reward_xp,
    });
  } else {
    await pushNotification(supabase, profile.id, "tugas_approved", "Tugas Disetujui! 📘", `"${task.title}" — ${rewardSummary}`, {
      taskId: task.id,
      rewardMoney: Number(task.reward_money),
      rewardPoint: task.reward_point,
      rewardXp: task.reward_xp,
      score: task.score,
    });
  }

  const streak = await computeWeeklyStreak(supabase, profile.id, task.day_date);
  if (streak.justCompleted) {
    await pushNotification(
      supabase,
      profile.id,
      "streak_complete",
      "Streak 7 Hari Lengkap! 🔥",
      "Kamu rajin banget minggu ini! Klaim bonus streak di halaman Klaim Saldo.",
      { weekStart: streak.weekStart }
    );
  }

  if (xpResult.leveledUp) {
    await pushNotification(
      supabase,
      profile.id,
      "level_up",
      "Naik Level! ⭐",
      `Selamat, kamu naik ke Level ${xpResult.level}!`,
      { level: xpResult.level }
    );

    const unlocked = await unlockAssetsForProfile(supabase, profile.family_id, profile.id, xpResult.level);
    for (const avatar of unlocked.avatars) {
      await pushNotification(supabase, profile.id, "unlock_avatar", "Avatar Baru Terbuka! 🎭", `"${avatar.name}" sekarang bisa dipakai.`, {
        avatarId: avatar.id,
        name: avatar.name,
      });
    }
    for (const pet of unlocked.pets) {
      await pushNotification(supabase, profile.id, "unlock_pet", "Pet Baru Terbuka! 🐾", `"${pet.name}" sekarang bisa dipilih.`, {
        petId: pet.id,
        name: pet.name,
      });
    }
  }

  revalidateChild(profile.id);
  revalidatePath(`/child/${profile.id}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Riwayat task per anak
// ---------------------------------------------------------------------------

export interface TaskHistoryItem {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  rewardMoney: number;
  rewardPoint: number;
  rewardXp: number;
  dayDate: string;
  score: number | null;
}

export async function getTaskHistory(childId: string, month?: string): Promise<TaskHistoryItem[]> {
  const session = await requireAdmin();
  if (!session) return [];

  const supabase = createAdminClient();
  const targetMonth = month ?? currentMonth();
  const { start, end } = monthRange(targetMonth);

  const { data } = await supabase
    .from("tasks")
    .select("id, type, title, status, reward_money, reward_point, reward_xp, day_date, score")
    .eq("profile_id", childId)
    .gte("day_date", start)
    .lte("day_date", end)
    .order("day_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    status: t.status,
    rewardMoney: Number(t.reward_money),
    rewardPoint: t.reward_point,
    rewardXp: t.reward_xp,
    dayDate: t.day_date,
    score: t.score,
  }));
}
