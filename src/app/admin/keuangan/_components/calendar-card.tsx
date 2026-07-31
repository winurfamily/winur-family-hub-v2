"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Panel, SectionTitle } from "@/components/finance/ui";
import type { LedgerEntry } from "@/app/actions/riwayat";
import { formatRupiah, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface DayCell {
  key: string;
  date: string | null;
  day: number | null;
  income: number;
  expense: number;
}

/**
 * Kalender transaksi bulanan — mengikuti referensi desain: setiap tanggal
 * memuat pil hijau (pemasukan) dan merah (pengeluaran) dalam bentuk ringkas.
 * Mengetuk satu tanggal memfilter daftar transaksi di bawahnya.
 */
export function CalendarCard({
  month,
  entries,
  selected,
  onSelect,
}: {
  month: string;
  entries: LedgerEntry[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const cells = useMemo(() => buildCalendar(month, entries), [month, entries]);
  const today = todayISODate();

  return (
    <Panel className="p-3 sm:p-4">
      <SectionTitle
        icon={<CalendarDays className="h-[18px] w-[18px]" />}
        title="Kalender Transaksi"
        action={
          selected ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs font-black text-primary underline-offset-2 hover:underline"
            >
              Tampilkan semua
            </button>
          ) : undefined
        }
      />

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((label) => (
          <span key={label} className="text-[10px] font-black uppercase text-ink-3">
            {label}
          </span>
        ))}

        {cells.map((cell) => {
          if (!cell.day) return <span key={cell.key} aria-hidden />;
          const isSelected = cell.date === selected;
          const isToday = cell.date === today;
          const hasData = cell.income > 0 || cell.expense > 0;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(isSelected ? null : cell.date)}
              aria-pressed={isSelected}
              aria-label={`${cell.day} — masuk ${formatRupiah(cell.income)}, keluar ${formatRupiah(cell.expense)}`}
              className={cn(
                "flex min-h-[52px] flex-col items-stretch gap-0.5 rounded-xl p-1 text-left transition-colors sm:min-h-[62px]",
                isSelected ? "bg-primary text-white" : hasData ? "bg-surface-2" : "hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-black",
                  isSelected ? "text-white" : isToday ? "text-primary" : "text-ink-2"
                )}
              >
                {cell.day}
              </span>
              {cell.income > 0 && <Pill value={cell.income} positive muted={isSelected} />}
              {cell.expense > 0 && <Pill value={cell.expense} muted={isSelected} />}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function Pill({ value, positive = false, muted = false }: { value: number; positive?: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "tabular truncate rounded px-1 py-[1px] text-[9px] font-black leading-tight text-white",
        muted ? "bg-white/25" : positive ? "bg-secondary" : "bg-destructive"
      )}
    >
      {positive ? "+" : "−"}
      {compact(value)}
    </span>
  );
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(Math.round(value));
}

function buildCalendar(month: string, entries: LedgerEntry[]): DayCell[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const totalDays = new Date(year, monthNumber, 0).getDate();

  const buckets = new Map<string, { income: number; expense: number }>();
  for (const entry of entries) {
    const bucket = buckets.get(entry.date) ?? { income: 0, expense: 0 };
    if (entry.kind === "income") bucket.income += entry.amount;
    if (entry.kind === "expense") bucket.expense += entry.amount;
    buckets.set(entry.date, bucket);
  }

  const cells: DayCell[] = [];
  for (let index = 0; index < first.getDay(); index++) {
    cells.push({ key: `pad-${index}`, date: null, day: null, income: 0, expense: 0 });
  }
  for (let day = 1; day <= totalDays; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const bucket = buckets.get(date) ?? { income: 0, expense: 0 };
    cells.push({ key: date, date, day, ...bucket });
  }
  return cells;
}
