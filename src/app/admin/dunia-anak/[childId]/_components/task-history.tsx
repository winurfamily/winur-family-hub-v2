"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarRange, Trash2, Check, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTaskHistory, deleteTask, type TaskHistoryItem } from "@/app/actions/anak-tasks";
import { formatRupiah, formatDate } from "@/lib/format";

const STATUS_LABEL: Record<TaskHistoryItem["status"], string> = {
  published: "Belum diambil",
  taken: "Dikerjakan",
  submitted: "Menunggu approve",
  approved: "Selesai",
  skipped: "Dilewati",
  expired: "Kedaluwarsa",
};

const STATUS_COLOR: Record<TaskHistoryItem["status"], string> = {
  published: "text-ink-3",
  taken: "text-info",
  submitted: "text-primary",
  approved: "text-secondary",
  skipped: "text-ink-3",
  expired: "text-destructive",
};

export function TaskHistory({
  childId,
  initialMonth,
  initialData,
}: {
  childId: string;
  initialMonth: string;
  initialData: TaskHistoryItem[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (value: string) => {
    setMonth(value);
    startTransition(async () => {
      const result = await getTaskHistory(childId, value);
      setData(result);
    });
  };

  const handleDeleted = (taskId: string) => {
    setData((prev) => prev.filter((item) => item.id !== taskId));
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-accent" /> Riwayat Task & Tugas
      </h2>
      <div className="space-y-1">
        <Label>Bulan</Label>
        <Input type="month" value={month} onChange={(e) => handleMonthChange(e.target.value)} />
      </div>

      {isPending ? (
        <p className="text-sm text-ink-2 text-center py-4">Memuat...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-2 text-center py-4">Belum ada riwayat bulan ini.</p>
      ) : (
        <div className="space-y-3 divide-y divide-border">
          {data.map((item) => (
            <TaskHistoryRow key={item.id} item={item} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskHistoryRow({ item, onDeleted }: { item: TaskHistoryItem; onDeleted: (taskId: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTask(item.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus.");
        setConfirmDelete(false);
        return;
      }
      toast.success(`${item.type === "tugas" ? "Tugas" : "Task"} dihapus.`);
      onDeleted(item.id);
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 text-sm pt-3 first:pt-0">
      <div className="min-w-0">
        <p className="font-bold text-ink-1 truncate">{item.title}</p>
        <p className="text-xs text-ink-3">
          {formatDate(item.dayDate)} • {item.type === "tugas" ? "Tugas" : "Task"}
          {item.score !== null ? ` • Skor ${item.score}/5` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className={`text-xs font-bold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</p>
          {item.status === "approved" && (
            <p className="font-heading font-extrabold text-secondary text-sm">+{formatRupiah(item.rewardMoney)}</p>
          )}
        </div>
        {item.status === "published" &&
          (confirmDelete ? (
            <div className="flex items-center gap-1">
              <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(false)} disabled={isPending} playSound={false}>
                <X className="w-4 h-4" />
              </GameButton>
              <GameButton variant="primary" size="icon" onClick={handleDelete} disabled={isPending} playSound={false}>
                <Check className="w-4 h-4" />
              </GameButton>
            </div>
          ) : (
            <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </GameButton>
          ))}
      </div>
    </div>
  );
}
