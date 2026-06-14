"use client";

import { useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getShoppingHistory, type ShoppingHistoryResult } from "@/app/actions/keuangan";
import { formatRupiah, formatDate } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  scan: "Scan AI",
  plan: "Rencana",
};

export function BelanjaRiwayat({
  initialMonth,
  initialData,
}: {
  initialMonth: string;
  initialData: ShoppingHistoryResult;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (value: string) => {
    setMonth(value);
    startTransition(async () => {
      const result = await getShoppingHistory(value);
      setData(result);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-accent" /> Riwayat Belanja
        </h2>
        <div className="space-y-1">
          <Label>Bulan</Label>
          <Input type="month" value={month} onChange={(e) => handleMonthChange(e.target.value)} />
        </div>
        <p className="text-sm text-ink-2">
          Total: <span className="font-heading font-extrabold text-ink-1 text-lg">{formatRupiah(data.total)}</span>
        </p>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
        {isPending ? (
          <p className="text-sm text-ink-2 text-center py-4">Memuat...</p>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-ink-2 text-center py-4">Belum ada belanja bulan ini.</p>
        ) : (
          <div className="space-y-3 divide-y divide-border">
            {data.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm pt-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-bold text-ink-1 truncate">
                    {item.name} {item.qty > 1 ? `x${item.qty}` : ""}
                  </p>
                  <p className="text-xs text-ink-3">
                    {formatDate(item.date)} • {item.pocketName ?? "Saldo Utama"} • {SOURCE_LABELS[item.source] ?? item.source}
                  </p>
                </div>
                <p className="font-heading font-extrabold text-ink-1 shrink-0">{formatRupiah(item.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
