"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getChildHome } from "@/app/actions/child-home";
import { submitTask } from "@/app/actions/child-tasks";
import { TugasModal } from "@/components/child/tugas-modal";
import { soundManager } from "@/lib/sound/sound-manager";
import { formatRupiah } from "@/lib/format";
import type { TaskOverviewItem } from "@/app/actions/anak-overview";
import { SheetHeader, SheetLoading, SheetEmpty } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function TaskSheet({ childId, onClose, onChanged }: Props) {
  const [tasks, setTasks] = useState<TaskOverviewItem[] | null>(null);
  const [tugasModal, setTugasModal] = useState<TaskOverviewItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    void getChildHome(childId).then((d) => setTasks(d?.todayTasks ?? []));
  };
  useEffect(load, [childId]);

  const done = (tasks ?? []).filter((t) => t.status === "approved").length;

  const handleFinish = (task: TaskOverviewItem) => {
    startTransition(async () => {
      const res = await submitTask(childId, task.id);
      if (res.success) {
        soundManager.play("task_done");
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal mengirim.");
      }
    });
  };

  return (
    <div>
      <SheetHeader
        title={`📋 Misi Hari Ini${tasks ? ` · ${done}/${tasks.length}` : ""}`}
        onClose={onClose}
      />
      {tasks === null ? (
        <SheetLoading />
      ) : tasks.length === 0 ? (
        <SheetEmpty icon="🎉" text="Belum ada tugas hari ini. Cek lagi nanti ya!" />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-xl border-2 border-[#EDEFF4] p-2.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-lg"
                style={{ background: task.type === "tugas" ? "#EDE9FE" : "#E8F5E9" }}
              >
                {task.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={task.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : task.type === "tugas" ? (
                  "📘"
                ) : (
                  "✅"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[13px] font-extrabold text-[#1C1E26]">{task.title}</p>
                <p className="text-[11px] font-bold text-[#9AA0AE]">
                  🪙 {formatRupiah(task.rewardMoney)} · ⭐{task.rewardPoint}
                </p>
              </div>
              {task.status === "approved" ? (
                <span className="rounded-[11px] bg-[#4CAF50] px-3 py-1.5 text-[11px] font-black text-white">✓ Disetujui</span>
              ) : task.status === "submitted" ? (
                <span className="rounded-[11px] bg-[#FFF4E5] px-3 py-1.5 text-[11px] font-black text-[#B8690A]">⏳ Menunggu</span>
              ) : task.type === "tugas" ? (
                <button
                  type="button"
                  onClick={() => setTugasModal(task)}
                  className="rounded-[11px] bg-[#7C3AED] px-3.5 py-1.5 text-[12px] font-black text-white active:translate-y-0.5"
                >
                  Mulai →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleFinish(task)}
                  className="rounded-[11px] bg-[#FF6B35] px-3.5 py-1.5 text-[12px] font-black text-white active:translate-y-0.5 disabled:opacity-50"
                >
                  Selesai
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tugasModal && (
        <TugasModal
          open={!!tugasModal}
          onOpenChange={(o) => {
            if (!o) {
              setTugasModal(null);
              load();
              onChanged();
            }
          }}
          childId={childId}
          task={tugasModal}
        />
      )}
    </div>
  );
}
