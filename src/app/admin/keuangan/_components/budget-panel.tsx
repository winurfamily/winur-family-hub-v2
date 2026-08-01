"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CopyPlus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { CurrencyInput } from "@/components/finance/currency-input";
import { Panel, SectionTitle, ProgressBar, StatTile } from "@/components/finance/ui";
import { copyBudgetFromPreviousMonth, setBudget, type BudgetOverview } from "@/app/actions/budget";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ALIASES } from "@/lib/supabase/types";
import { expenseVisual, INCOME_VISUAL_LIST, type CategoryVisual } from "@/lib/finance-categories";
import {
  BUDGET_STATUS_LABELS,
  TOTAL_BUDGET_KEY,
  type BudgetStatus,
} from "@/lib/budget-alerts";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Anggaran bulanan: total, per kategori, dan perbandingan dengan bulan lalu.
 *
 * Tiga keputusan yang membentuk panel ini:
 *
 *  - ANGGARAN TOTAL berdiri sendiri di atas, bukan sekadar penjumlahan
 *    kategori. Banyak keluarga hanya punya satu angka di kepala ("jangan lebih
 *    dari 5 juta") dan tidak pernah memecahnya per kategori; memaksa mereka
 *    mengisi dua belas baris dulu membuat fitur anggaran tidak pernah dipakai.
 *    Bila total tidak diisi, jumlah kategori yang dipakai — jadi kedua gaya
 *    sama-sama bekerja.
 *
 *  - STATUS bukan hanya persentase. "Mendekati batas" (75%) dan "Hampir habis"
 *    (90%) memakai kata, bukan warna saja, supaya tetap terbaca oleh siapa pun
 *    yang sulit membedakan warna.
 *
 *  - PERBANDINGAN BULAN LALU melekat pada barisnya. Angka "Rp 1.200.000"
 *    tidak berarti apa-apa sampai diketahui bulan lalu berapa.
 */
export function BudgetPanel({ overview, month }: { overview: BudgetOverview; month: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const copyPrevious = () =>
    startTransition(async () => {
      const result = await copyBudgetFromPreviousMonth(month);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyalin anggaran.");
        return;
      }
      toast.success(`${result.data!.copied} anggaran disalin dari bulan lalu.`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {!overview.ready ? (
        <Panel className="p-4">
          <SectionTitle icon={<Target className="h-[18px] w-[18px]" />} title="Anggaran Bulanan" />
          <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs font-semibold leading-relaxed text-ink-2">
            Tabel anggaran belum ada di database. Jalankan{" "}
            <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
              supabase/migrations/0022_parent_finance_budget_categories.sql
            </code>{" "}
            di SQL Editor Supabase, lalu buka halaman ini lagi. Menu Keuangan lainnya tetap berjalan
            normal tanpa migration ini.
          </p>
        </Panel>
      ) : (
        <>
          <Panel className="p-4">
            <SectionTitle
              icon={<Target className="h-[18px] w-[18px]" />}
              title="Anggaran Bulanan"
              action={
                <button
                  type="button"
                  onClick={copyPrevious}
                  disabled={isPending}
                  className="tap-target flex items-center gap-1 rounded-xl bg-surface-2 px-3 text-xs font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-50"
                >
                  <CopyPlus className="h-3.5 w-3.5" aria-hidden /> Salin bulan lalu
                </button>
              }
            />

            <TotalBudgetRow overview={overview} month={month} />

            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatTile label="Anggaran" value={overview.totalBudget} />
              <StatTile label="Terpakai" value={overview.totalSpent} tone="bad" />
              <StatTile
                label="Sisa"
                value={overview.totalRemaining}
                tone={overview.totalRemaining >= 0 ? "good" : "bad"}
              />
            </div>

            <ChangeNote
              current={overview.totalSpent}
              previous={overview.previousSpent}
              percent={overview.changePercent}
              className="mt-2"
            />
          </Panel>

          <Panel className="p-4">
            <SectionTitle title="Anggaran per Kategori" />
            <p className="mt-1 text-[11px] font-semibold text-ink-3">
              Ketuk nominal di kanan untuk mengatur jatah kategori itu. Isi 0 untuk melepasnya.
            </p>
            <ul className="mt-4 space-y-3.5">
              {overview.lines.map((line) => (
                <BudgetRow key={line.categoryKey} line={line} month={month} />
              ))}
            </ul>
          </Panel>
        </>
      )}

      <Panel className="p-4">
        <SectionTitle title="Kategori Transaksi" />
        <p className="mt-1 text-[11px] font-semibold text-ink-3">
          Kategori bawaan yang dipakai pendapatan dan pengeluaran keluarga.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <CategoryGroup title="Pendapatan" items={INCOME_VISUAL_LIST} />
          <CategoryGroup
            title="Pengeluaran"
            items={EXPENSE_CATEGORIES.filter((key) => !(key in EXPENSE_CATEGORY_ALIASES)).map((key) =>
              expenseVisual(key)
            )}
          />
        </div>
      </Panel>
    </div>
  );
}

const STATUS_STYLE: Record<BudgetStatus, string> = {
  aman: "bg-secondary-light text-secondary-dark",
  mendekati: "bg-accent-light text-accent",
  hampir: "bg-amber-100 text-amber-800",
  lewat: "bg-destructive/10 text-destructive",
};

function StatusChip({ status }: { status: BudgetStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
        STATUS_STYLE[status]
      )}
    >
      {BUDGET_STATUS_LABELS[status]}
    </span>
  );
}

/** "Naik 12% dari bulan lalu (Rp 1.070.000)". */
function ChangeNote({
  current,
  previous,
  percent,
  className,
}: {
  current: number;
  previous: number;
  percent: number | null;
  className?: string;
}) {
  if (previous <= 0) {
    return (
      <p className={cn("text-[11px] font-semibold text-ink-3", className)}>
        Bulan lalu belum ada pengeluaran untuk dibandingkan.
      </p>
    );
  }

  const up = current > previous;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <p className={cn("flex items-center gap-1 text-[11px] font-bold", className)}>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", up ? "text-destructive" : "text-secondary-dark")}
        aria-hidden
      />
      <span className={up ? "text-destructive" : "text-secondary-dark"}>
        {percent === null ? "—" : `${up ? "Naik" : "Turun"} ${Math.abs(percent)}%`}
      </span>
      <span className="text-ink-3">dari bulan lalu ({formatRupiah(previous)})</span>
    </p>
  );
}

/**
 * Baris anggaran TOTAL.
 *
 * Ditandai jelas ketika angkanya berasal dari penjumlahan kategori, supaya
 * tidak terlihat seolah seseorang pernah menetapkannya.
 */
function TotalBudgetRow({ overview, month }: { overview: BudgetOverview; month: string }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(overview.totalIsExplicit ? overview.totalBudget : 0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const save = () =>
    startTransition(async () => {
      const result = await setBudget(month, TOTAL_BUDGET_KEY, amount);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan anggaran total.");
        return;
      }
      toast.success(amount > 0 ? "Anggaran total disimpan." : "Anggaran total dilepas.");
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="mt-3 rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-ink-3">
            Anggaran total bulan ini
          </p>
          <p className="tabular mt-0.5 font-mono text-2xl font-black text-ink-1">
            {formatRupiah(overview.totalBudget)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
            {overview.totalIsExplicit
              ? "Ditetapkan manual."
              : overview.totalBudget > 0
                ? "Dihitung dari jumlah anggaran kategori."
                : "Belum ditetapkan."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusChip status={overview.totalStatus} />
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="min-h-8 text-[12px] font-black text-primary underline-offset-2 hover:underline"
          >
            {overview.totalIsExplicit ? "Ubah" : "Atur total"}
          </button>
        </div>
      </div>

      {overview.totalBudget > 0 && (
        <div className="mt-2.5 space-y-1">
          <ProgressBar
            percent={overview.totalPercent}
            tone={overview.totalStatus === "lewat" ? "bad" : "primary"}
          />
          <p
            className={cn(
              "tabular text-[11px] font-bold",
              overview.totalStatus === "lewat" ? "text-destructive" : "text-ink-3"
            )}
          >
            {overview.totalPercent}% terpakai
            {overview.totalRemaining < 0 && ` · lebih ${formatRupiah(Math.abs(overview.totalRemaining))}`}
          </p>
        </div>
      )}

      {editing && (
        <div className="mt-2.5 flex gap-2">
          <CurrencyInput
            value={amount}
            onValueChange={setAmount}
            disabled={isPending}
            aria-label="Anggaran total bulan ini"
          />
          <GameButton type="button" variant="secondary" size="sm" disabled={isPending} onClick={save}>
            {isPending ? "…" : "Simpan"}
          </GameButton>
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ title, items }: { title: string; items: CategoryVisual[] }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-ink-3">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((visual) => {
          const Icon = visual.Icon;
          return (
            <li
              key={visual.key}
              className="flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[12px] font-bold"
              style={{ backgroundColor: visual.bg, color: visual.fg }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
              {visual.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BudgetRow({
  line,
  month,
}: {
  line: BudgetOverview["lines"][number];
  month: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(line.amount);
  const [isPending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await setBudget(month, line.categoryKey, amount);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan anggaran.");
        return;
      }
      toast.success(`Anggaran ${line.label} disimpan.`);
      setEditing(false);
      router.refresh();
    });

  const over = line.amount > 0 && line.spent > line.amount;
  const visual = expenseVisual(line.categoryKey);
  const Icon = visual.Icon;

  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-black text-ink-1">
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: visual.bg, color: visual.fg }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="truncate">{line.label}</span>
          {line.amount > 0 && line.status !== "aman" && <StatusChip status={line.status} />}
        </span>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="tabular shrink-0 text-[12px] font-bold text-ink-3 underline-offset-2 hover:underline"
        >
          {line.amount > 0 ? `${formatRupiah(line.spent)} / ${formatRupiah(line.amount)}` : "Atur anggaran"}
        </button>
      </div>

      {line.amount > 0 && (
        <div className="mt-1.5 space-y-1">
          <ProgressBar percent={line.percent} tone={over ? "bad" : "primary"} />
          <p className={cn("tabular text-[10px] font-bold", over ? "text-destructive" : "text-ink-3")}>
            {line.percent}%
            {over
              ? ` · lebih ${formatRupiah(line.spent - line.amount)}`
              : ` · sisa ${formatRupiah(line.remaining)}`}
          </p>
        </div>
      )}

      {(line.spent > 0 || line.previousSpent > 0) && (
        <ChangeNote
          current={line.spent}
          previous={line.previousSpent}
          percent={line.changePercent}
          className="mt-1"
        />
      )}

      {editing && (
        <div className="mt-2 flex gap-2">
          <CurrencyInput
            value={amount}
            onValueChange={setAmount}
            disabled={isPending}
            aria-label={`Anggaran ${line.label}`}
          />
          <GameButton type="button" variant="secondary" size="sm" disabled={isPending} onClick={save}>
            {isPending ? "…" : "Simpan"}
          </GameButton>
        </div>
      )}
    </li>
  );
}
