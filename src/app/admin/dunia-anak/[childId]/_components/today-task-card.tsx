"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Trash2, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { TaskIllustration } from "@/components/shared/task-illustration";
import { formatRupiah } from "@/lib/format";
import { approveTask, rejectTask, deleteTask } from "@/app/actions/anak-tasks";
import type { TaskOverviewItem } from "@/app/actions/anak-overview";

const STATUS_LABEL: Record<TaskOverviewItem["status"], string> = {
  published: "Belum diambil",
  taken: "Sedang dikerjakan",
  submitted: "Menunggu approve",
  approved: "Selesai",
  skipped: "Dilewati",
  expired: "Kedaluwarsa",
};

export function TodayTaskCard({ task, onChanged }: { task: TaskOverviewItem; onChanged?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveTask(task.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal approve task.");
        return;
      }
      toast.success("Task disetujui! Saldo, point, dan XP sudah ditambahkan.");
      onChanged?.();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectTask(task.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menolak task.");
        setConfirmReject(false);
        return;
      }
      toast.success(`${task.type === "tugas" ? "Tugas" : "Task"} ditolak, anak perlu mengerjakan ulang.`);
      setConfirmReject(false);
      onChanged?.();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus.");
        setConfirmDelete(false);
        return;
      }
      toast.success(`${task.type === "tugas" ? "Tugas" : "Task"} dihapus.`);
      router.refresh();
      onChanged?.();
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        {task.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={task.imageUrl} alt={task.title} className="w-14 h-14 rounded-xl object-cover border-2 border-border shrink-0" />
        ) : (
          <TaskIllustration
            type={task.type}
            category={task.category}
            className="w-14 h-14 rounded-xl border-2 border-border shrink-0"
            iconClassName="w-6 h-6"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
              {task.type === "tugas" ? "Tugas" : "Task"}
            </span>
            <span className="text-xs font-bold text-ink-3">•</span>
            <span className="text-xs font-bold text-ink-3 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {STATUS_LABEL[task.status]}
            </span>
          </div>
          <p className="font-heading font-extrabold text-ink-1">{task.title}</p>
          {task.description && <p className="text-sm text-ink-2 mt-0.5">{task.description}</p>}
          <p className="text-xs text-ink-3 mt-1">
            +{formatRupiah(task.rewardMoney)} • +{task.rewardPoint} point • +{task.rewardXp} XP
          </p>
          {task.type === "tugas" && task.score !== null && (
            <p className="text-xs font-bold text-accent mt-1">Skor: {task.score} / 5</p>
          )}
        </div>
      </div>

      {task.type === "tugas" && task.questions && task.userAnswers && (
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold text-primary"
        >
          {showDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showDetail ? "Sembunyikan jawaban" : "Lihat jawaban"}
        </button>
      )}

      {showDetail && task.questions && task.userAnswers && (
        <div className="space-y-2 border-t-2 border-border pt-2">
          {task.questions.map((q, i) => {
            const userAnswer = task.userAnswers?.[i];
            const isCorrect = userAnswer === q.correct_answer;
            return (
              <div key={i} className="text-sm">
                <p className="font-bold text-ink-1">
                  {i + 1}. {q.question}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <p className="text-ink-2">
                    Jawaban: {userAnswer !== undefined && userAnswer !== null ? q.options[userAnswer] : "-"}
                  </p>
                </div>
                {!isCorrect && <p className="text-xs text-ink-3 ml-5">Jawaban benar: {q.options[q.correct_answer]}</p>}
                {q.explanation && <p className="text-xs text-ink-3 ml-5 italic">{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      )}

      {task.status === "submitted" &&
        (confirmReject ? (
          <div className="flex items-center gap-2">
            <GameButton variant="outline" size="sm" block onClick={() => setConfirmReject(false)} disabled={isPending} playSound={false}>
              Batal
            </GameButton>
            <GameButton variant="primary" size="sm" block onClick={handleReject} disabled={isPending} playSound={false}>
              {isPending ? "Memproses..." : "Ya, Tolak"}
            </GameButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <GameButton variant="outline" size="sm" block onClick={() => setConfirmReject(true)} disabled={isPending}>
              <X className="w-4 h-4 text-destructive" /> Tolak
            </GameButton>
            <GameButton variant="secondary" size="sm" block onClick={handleApprove} disabled={isPending}>
              <CheckCircle2 className="w-4 h-4" />
              {isPending ? "Memproses..." : "Approve & Berikan Reward"}
            </GameButton>
          </div>
        ))}

      {task.status === "published" &&
        (confirmDelete ? (
          <div className="flex items-center gap-2">
            <GameButton variant="outline" size="sm" block onClick={() => setConfirmDelete(false)} disabled={isPending} playSound={false}>
              Batal
            </GameButton>
            <GameButton variant="primary" size="sm" block onClick={handleDelete} disabled={isPending} playSound={false}>
              {isPending ? "Menghapus..." : "Yakin Hapus?"}
            </GameButton>
          </div>
        ) : (
          <GameButton variant="outline" size="sm" block onClick={() => setConfirmDelete(true)} disabled={isPending}>
            <Trash2 className="w-4 h-4 text-destructive" /> Hapus
          </GameButton>
        ))}

      {task.status === "approved" && (
        <div className="flex items-center gap-1 text-secondary text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" /> Reward sudah diberikan
        </div>
      )}
    </div>
  );
}
