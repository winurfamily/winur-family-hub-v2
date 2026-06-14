"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import type { ActionResult } from "@/lib/server/admin-helpers";
import type { TaskStatus } from "@/lib/supabase/types";

/** Anak mulai mengerjakan task/tugas (published -> taken). */
export async function takeTask(childId: string, taskId: string): Promise<ActionResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: task } = await supabase.from("tasks").select("id, profile_id, status").eq("id", taskId).maybeSingle();
  if (!task || task.profile_id !== childId) return { success: false, error: "Tugas tidak ditemukan." };

  if (task.status !== "published") return { success: true };

  const { error } = await supabase
    .from("tasks")
    .update({ status: "taken" as TaskStatus, taken_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    console.error("takeTask error", error);
    return { success: false, error: "Gagal memulai tugas." };
  }

  revalidatePath(`/child/${childId}`);
  return { success: true };
}

export interface SubmitTaskResult extends ActionResult {
  score?: number;
}

/**
 * Anak mengumpulkan task/tugas (published/taken -> submitted, menunggu approval admin).
 * Untuk type 'tugas', `answers` wajib diisi (index 0-3 per soal) dan akan dinilai otomatis.
 */
export async function submitTask(childId: string, taskId: string, answers?: number[]): Promise<SubmitTaskResult> {
  const session = await requireChild(childId);
  if (!session) return { success: false, error: "Tidak diizinkan." };

  const supabase = createAdminClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task || task.profile_id !== childId) return { success: false, error: "Tugas tidak ditemukan." };

  if (task.status !== "published" && task.status !== "taken") {
    return { success: false, error: "Tugas ini sudah dikumpulkan." };
  }

  let score: number | null = null;

  if (task.type === "tugas") {
    if (!task.questions || !answers || answers.length !== task.questions.length) {
      return { success: false, error: "Jawaban belum lengkap." };
    }
    score = answers.reduce((acc, ans, i) => acc + (ans === task.questions![i].correct_answer ? 1 : 0), 0);
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "submitted" as TaskStatus,
      submitted_at: new Date().toISOString(),
      user_answers: task.type === "tugas" ? answers ?? null : null,
      score,
    })
    .eq("id", taskId);

  if (error) {
    console.error("submitTask error", error);
    return { success: false, error: "Gagal mengumpulkan tugas." };
  }

  revalidatePath(`/child/${childId}`);
  return { success: true, score: score ?? undefined };
}
