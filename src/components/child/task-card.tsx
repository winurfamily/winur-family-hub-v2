"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { TaskIllustration } from "@/components/shared/task-illustration";
import { takeTask, submitTask } from "@/app/actions/child-tasks";
import { soundManager } from "@/lib/sound/sound-manager";
import { formatRupiah, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TugasModal } from "./tugas-modal";
import type { TaskOverviewItem } from "@/app/actions/anak-overview";

interface TaskCardProps {
  childId: string;
  task: TaskOverviewItem;
}

/** Kartu task/tugas harian dengan alur mulai → kumpulkan, sesuai status. */
export function TaskCard({ childId, task }: TaskCardProps) {
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  const isTugas = task.type === "tugas";
  const isLocked = task.status === "skipped" || task.status === "expired";

  const handlePrimary = () => {
    if (task.status === "published") {
      if (isTugas) {
        setModalOpen(true);
        return;
      }
      startTransition(async () => {
        const result = await takeTask(childId, task.id);
        if (!result.success) {
          toast.error(result.error ?? "Gagal memulai tugas.");
        } else {
          soundManager.play("tap");
        }
      });
      return;
    }

    if (task.status === "taken") {
      if (isTugas) {
        setModalOpen(true);
        return;
      }
      startTransition(async () => {
        const result = await submitTask(childId, task.id);
        if (result.success) {
          soundManager.play("task_done");
          toast.success("Tugas selesai! Menunggu cek dari Ayah/Mamah ya 🎉");
        } else {
          toast.error(result.error ?? "Gagal mengumpulkan tugas.");
        }
      });
    }
  };

  return (
    <>
      <div
        className={cn(
          "glass-panel flex h-full w-[150px] shrink-0 flex-col gap-2 rounded-2xl p-3 shadow-card transition-transform hover:-translate-y-0.5 sm:w-40",
          isLocked && "opacity-60 grayscale"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted overflow-hidden">
            {task.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={task.imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <TaskIllustration type={task.type} category={task.category} className="h-full w-full rounded-xl" iconClassName="w-6 h-6" />
            )}
          </div>
          <span
            className={cn(
              "rounded-lg px-1.5 py-0.5 text-[10px] font-extrabold",
              isTugas ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
            )}
          >
            {isTugas ? "TUGAS" : "TASK"}
          </span>
        </div>

        <p className="line-clamp-2 min-h-[2.5em] font-heading text-sm font-bold text-ink-1">{task.title}</p>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-primary">🪙 {formatRupiah(task.rewardMoney)}</span>
          <span className="text-yellow-dark">⭐ {formatNumber(task.rewardPoint)}</span>
        </div>

        {task.status === "published" && (
          <GameButton
            size="sm"
            variant={isTugas ? "accent" : "primary"}
            block
            disabled={isPending}
            onClick={handlePrimary}
            playSound={false}
          >
            {isPending ? "..." : "Mulai →"}
          </GameButton>
        )}
        {task.status === "taken" && (
          <GameButton
            size="sm"
            variant={isTugas ? "accent" : "secondary"}
            block
            disabled={isPending}
            onClick={handlePrimary}
            playSound={false}
          >
            {isPending ? "..." : isTugas ? "Lanjutkan →" : "Selesai ✓"}
          </GameButton>
        )}
        {task.status === "submitted" && (
          <div className="rounded-xl border-2 border-yellow bg-yellow/10 py-2 text-center text-xs font-extrabold text-yellow-dark">
            Menunggu ⏳
            {isTugas && task.score !== null && (
              <span className="block text-[10px] font-bold text-ink-2">
                Skor: {task.score}/{task.questions?.length ?? 0}
              </span>
            )}
          </div>
        )}
        {task.status === "approved" && (
          <div className="rounded-xl border-2 border-secondary bg-secondary/10 py-2 text-center text-xs font-extrabold text-secondary">
            Selesai ✅
          </div>
        )}
        {task.status === "skipped" && (
          <div className="rounded-xl border-2 border-border bg-muted py-2 text-center text-xs font-extrabold text-ink-3">
            Terlewat
          </div>
        )}
        {task.status === "expired" && (
          <div className="rounded-xl border-2 border-border bg-muted py-2 text-center text-xs font-extrabold text-ink-3">
            Kedaluwarsa
          </div>
        )}
      </div>

      {isTugas && <TugasModal open={modalOpen} onOpenChange={setModalOpen} childId={childId} task={task} />}
    </>
  );
}
