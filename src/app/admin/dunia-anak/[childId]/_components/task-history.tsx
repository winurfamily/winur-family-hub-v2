"use client";

import { useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTaskHistory, type TaskHistoryItem } from "@/app/actions/anak-tasks";
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
            <div key={item.id} className="flex items-center justify-between gap-2 text-sm pt-3 first:pt-0">
              <div className="min-w-0">
                <p className="font-bold text-ink-1 truncate">{item.title}</p>
                <p className="text-xs text-ink-3">
                  {formatDate(item.dayDate)} • {item.type === "tugas" ? "Tugas" : "Task"}
                  {item.score !== null ? ` • Skor ${item.score}/5` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-bold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</p>
                {item.status === "approved" && (
                  <p className="font-heading font-extrabold text-secondary text-sm">+{formatRupiah(item.rewardMoney)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
