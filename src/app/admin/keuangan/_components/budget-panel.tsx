"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { CurrencyInput } from "@/components/finance/currency-input";
import { Panel, SectionTitle, ProgressBar, StatTile } from "@/components/finance/ui";
import { setBudget, type BudgetOverview } from "@/app/actions/budget";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ALIASES } from "@/lib/supabase/types";
import { expenseVisual, INCOME_VISUAL_LIST, type CategoryVisual } from "@/lib/finance-categories";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Anggaran bulanan per kategori + daftar kategori transaksi yang dipakai
 * seluruh aplikasi. Keduanya di satu tempat karena selalu dibaca bersamaan:
 * "kategori apa yang ada" dan "berapa jatahnya bulan ini".
 */
export function BudgetPanel({ overview, month }: { overview: BudgetOverview; month: string }) {
  const sisa = overview.totalBudget - overview.totalSpent;

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
        <Panel className="p-4">
          <SectionTitle icon={<Target className="h-[18px] w-[18px]" />} title="Anggaran Bulanan" />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile label="Anggaran" value={overview.totalBudget} />
            <StatTile label="Terpakai" value={overview.totalSpent} tone="bad" />
            <StatTile label="Sisa" value={sisa} tone={sisa >= 0 ? "good" : "bad"} />
          </div>

          <ul className="mt-4 space-y-3">
            {overview.lines.map((line) => (
              <BudgetRow key={line.categoryKey} line={line} month={month} />
            ))}
          </ul>
        </Panel>
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
            {line.percent}%{over && ` · lebih ${formatRupiah(line.spent - line.amount)}`}
          </p>
        </div>
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
