"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  PiggyBank,
  ReceiptText,
  Target,
  Wallet,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Panel, SectionTitle, SegmentTabs, StatTile, EmptyState } from "@/components/finance/ui";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { CalendarCard } from "./calendar-card";
import { TransactionList } from "./transaction-list";
import { BudgetPanel } from "./budget-panel";
import { IncomeFormSheet } from "./income-form-sheet";
import { ExpenseFormSheet } from "./expense-form-sheet";
import { TransferForm } from "./transfer-form";
import { TransferHistoryList } from "./transfer-history";
import { PocketDialog } from "./pocket-dialog";
import { PocketList } from "./pocket-list";
import type { FinanceSummary, MonthlyTrendPoint, TransferHistoryResult } from "@/app/actions/keuangan";
import type { LedgerResult } from "@/app/actions/riwayat";
import type { BudgetOverview } from "@/app/actions/budget";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/supabase/types";
import { formatRupiah, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Grafik hanya diunduh saat tab Analitik dibuka. */
const AnalyticsSection = dynamic(
  () => import("@/components/finance/analytics-charts").then((m) => m.CategoryDonut),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);
const TrendSection = dynamic(
  () => import("@/components/finance/analytics-charts").then((m) => m.MonthlyTrend),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

function ChartSkeleton() {
  return (
    <Panel className="flex min-h-[220px] items-center justify-center p-6">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
    </Panel>
  );
}

type Tab = "ringkasan" | "transaksi" | "analitik" | "dompet" | "anggaran";

const TABS = [
  { id: "ringkasan" as const, label: "Ringkasan", icon: <Wallet className="h-4 w-4" /> },
  { id: "transaksi" as const, label: "Transaksi", icon: <ReceiptText className="h-4 w-4" /> },
  { id: "analitik" as const, label: "Analitik", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "dompet" as const, label: "Dompet", icon: <PiggyBank className="h-4 w-4" /> },
  { id: "anggaran" as const, label: "Anggaran", icon: <Target className="h-4 w-4" /> },
];

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Menu Keuangan — HANYA pencatatan & pengelolaan keuangan.
 *
 * Tidak ada rencana belanja, checklist, input belanja manual, maupun scan
 * struk di sini, dan tidak ada pintasan menuju Belanja. Transaksi yang lahir
 * dari menu Belanja tetap muncul di daftar & analitik sebagai Pengeluaran
 * kategori "Belanja" — itulah satu-satunya hubungan antara kedua menu.
 */
export function KeuanganHub({
  month,
  summary,
  ledger,
  options,
  transfers,
  trend,
  budget,
  dateFrom,
  dateTo,
}: {
  month: string;
  summary: FinanceSummary | null;
  ledger: LedgerResult;
  options: { pockets: { id: string; name: string }[]; creators: { id: string; name: string }[] };
  transfers: TransferHistoryResult;
  trend: MonthlyTrendPoint[];
  budget: BudgetOverview;
  dateFrom: string;
  dateTo: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const pockets = summary?.pockets ?? [];
  const saldoUtama = summary?.saldoUtama ?? 0;
  const income = ledger.totals.income;
  const expense = ledger.totals.expense;
  const diff = income - expense;

  const goMonth = (delta: number) => {
    const [year, m] = month.split("-").map(Number);
    const next = new Date(year, m - 1 + delta, 1);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/admin/keuangan?bulan=${key}`);
  };

  const dayEntries = useMemo(
    () => (pickedDate ? ledger.entries.filter((entry) => entry.date === pickedDate) : []),
    [ledger.entries, pickedDate]
  );

  const expenseByCategory = useMemo(() => {
    const totals = new Map<string, { label: string; value: number }>();
    for (const entry of ledger.entries) {
      if (entry.kind !== "expense") continue;
      const key = entry.categoryKey ?? "lainnya";
      const label =
        entry.categoryLabel ?? EXPENSE_CATEGORY_LABELS[key as keyof typeof EXPENSE_CATEGORY_LABELS] ?? "Lainnya";
      const current = totals.get(key) ?? { label, value: 0 };
      totals.set(key, { label, value: current.value + entry.amount });
    }
    return Array.from(totals.entries()).map(([key, value]) => ({ key, ...value }));
  }, [ledger.entries]);

  const [year, monthNumber] = month.split("-").map(Number);

  return (
    <div className="space-y-4 pb-4">
      {/* ---------- Hero saldo + navigasi bulan ---------- */}
      <Panel className="overflow-hidden p-0">
        <div className="relative overflow-hidden bg-rose-hero p-4 text-white sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/75">
              Total saldo keluarga
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="tap-target grid place-items-center rounded-xl bg-white/15 text-white transition active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-[104px] text-center text-xs font-black">
                {MONTH_NAMES[(monthNumber ?? 1) - 1]} {year}
              </span>
              <button
                type="button"
                onClick={() => goMonth(1)}
                aria-label="Bulan berikutnya"
                className="tap-target grid place-items-center rounded-xl bg-white/15 text-white transition active:scale-95"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <p className="tabular relative mt-1 break-words font-mono text-[34px] font-black leading-tight sm:text-5xl">
            {formatRupiah(summary?.totalKeluarga ?? 0)}
          </p>

          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:max-w-md">
            <MiniBalance label="Saldo Utama" value={saldoUtama} />
            <MiniBalance label="Total Pocket" value={summary?.totalPockets ?? 0} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3">
          <StatTile label="Pendapatan" value={income} tone="good" />
          <StatTile label="Pengeluaran" value={expense} tone="bad" />
          <StatTile label="Selisih" value={diff} tone={diff >= 0 ? "good" : "bad"} />
        </div>
      </Panel>

      {/* Tombol "Catat" berada di baris tersendiri pada HP agar tidak menutupi
          tab yang sedang digeser; di layar lebar keduanya sebaris. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <SegmentTabs tabs={TABS} active={tab} onChange={setTab} className="min-w-0 sm:flex-1" />
        <QuickAdd pockets={pockets} saldoUtama={saldoUtama} options={options} />
      </div>

      {/* ---------- Ringkasan ---------- */}
      {tab === "ringkasan" && (
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
          <div className="space-y-4">
            <CalendarCard
              month={month}
              entries={ledger.entries}
              selected={pickedDate}
              onSelect={setPickedDate}
            />
          </div>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
              <SectionTitle
                icon={<ReceiptText className="h-[18px] w-[18px]" />}
                title={pickedDate ? formatDate(pickedDate) : "Transaksi Terbaru"}
              />
              <button
                type="button"
                onClick={() => setTab("transaksi")}
                className="tap-target shrink-0 rounded-xl px-2 text-xs font-black text-primary"
              >
                Semua
              </button>
            </div>

            {(() => {
              const shown = pickedDate ? dayEntries : ledger.entries.slice(0, 8);
              if (shown.length === 0) {
                return (
                  <div className="p-4 pt-0">
                    <EmptyState
                      title={pickedDate ? "Tidak ada transaksi" : "Belum ada transaksi"}
                      text={
                        pickedDate
                          ? "Pilih tanggal lain di kalender."
                          : "Catat pendapatan atau pengeluaran pertama lewat tombol Catat."
                      }
                    />
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-border">
                  {shown.map((entry) => (
                    <li key={entry.key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-ink-1">{entry.title}</p>
                        <p className="truncate text-[11px] font-semibold text-ink-3">
                          {formatDate(entry.date)} · {entry.account}
                          {entry.categoryLabel ? ` · ${entry.categoryLabel}` : ""}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "tabular shrink-0 text-[14px] font-black",
                          entry.kind === "income"
                            ? "text-secondary-dark"
                            : entry.kind === "transfer"
                              ? "text-accent"
                              : "text-destructive"
                        )}
                      >
                        {entry.kind === "income" ? "+" : entry.kind === "expense" ? "−" : ""}
                        {formatRupiah(entry.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Panel>
        </div>
      )}

      {/* ---------- Transaksi ---------- */}
      {tab === "transaksi" && (
        <TransactionList
          initial={ledger}
          options={options}
          dateFrom={dateFrom}
          dateTo={dateTo}
          pockets={options.pockets}
        />
      )}

      {/* ---------- Analitik ---------- */}
      {tab === "analitik" && (
        <div className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0">
          <AnalyticsSection
            title="Pengeluaran per Kategori"
            slices={expenseByCategory}
            emptyText="Grafik muncul setelah ada pengeluaran di bulan ini."
          />
          <TrendSection points={trend} />
        </div>
      )}

      {/* ---------- Dompet ---------- */}
      {tab === "dompet" && (
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
          <div className="space-y-4">
            <Panel className="p-4">
              <SectionTitle
                icon={<PiggyBank className="h-[18px] w-[18px]" />}
                title="Pocket Keluarga"
                action={
                  <PocketDialog
                    trigger={
                      <button
                        type="button"
                        className="tap-target rounded-xl bg-primary-light px-3 text-xs font-black text-primary"
                      >
                        Tambah
                      </button>
                    }
                  />
                }
              />
              <p className="mt-1 text-[11px] font-semibold text-ink-3">
                Saldo Utama plus pocket yang benar-benar dipakai. Tabungan anak ikut tampil di sini dan
                tidak boleh dihapus selama masih ada saldonya.
              </p>
              <div className="mt-3">
                {pockets.length === 0 ? (
                  <EmptyState
                    title="Belum ada pocket"
                    text="Buat pocket Belanja, Dana Sekolah, atau Tabungan keluarga."
                  />
                ) : (
                  <PocketList pockets={pockets} />
                )}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <TransferForm pockets={pockets} saldoUtama={saldoUtama} />
            <Panel className="p-4">
              <SectionTitle
                icon={<ArrowRightLeft className="h-[18px] w-[18px]" />}
                title="Riwayat Transfer"
              />
              <p className="mt-1 text-[11px] font-semibold text-ink-3">
                Menghapus riwayat hanya menghilangkan catatannya — saldo tidak berubah.
              </p>
              <div className="mt-3">
                <TransferHistoryList items={transfers.items} />
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ---------- Anggaran & kategori ---------- */}
      {tab === "anggaran" && <BudgetPanel overview={budget} month={month} />}
    </div>
  );
}

function MiniBalance({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 p-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-white/75">{label}</p>
      <p className="tabular mt-0.5 truncate font-mono text-sm font-black">{formatRupiah(value)}</p>
    </div>
  );
}

/** Satu tombol "Catat" → pendapatan, pengeluaran umum, atau transfer. */
function QuickAdd({
  pockets,
  saldoUtama,
  options,
}: {
  pockets: FinanceSummary["pockets"];
  saldoUtama: number;
  options: { pockets: { id: string; name: string }[] };
}) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveSheet open={open} onOpenChange={setOpen}>
      <ResponsiveSheetTrigger asChild>
        <GameButton type="button" variant="primary" size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" aria-hidden /> Catat
        </GameButton>
      </ResponsiveSheetTrigger>
      <ResponsiveSheetContent title="Catat transaksi" description="Pilih jenis catatan keuangan.">
        <div className="grid gap-2">
          <IncomeFormSheet
            pockets={options.pockets}
            trigger={
              <QuickButton
                icon={<Plus className="h-5 w-5" />}
                title="Pendapatan"
                text="Gaji, usaha, bonus, hadiah"
              />
            }
          />
          <ExpenseFormSheet
            pockets={pockets}
            saldoUtama={saldoUtama}
            trigger={
              <QuickButton
                icon={<ReceiptText className="h-5 w-5" />}
                title="Pengeluaran umum"
                text="Tagihan, transportasi, sekolah"
              />
            }
          />
          <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-[11px] font-semibold text-ink-3">
            Untuk transfer antar pocket, buka tab <strong className="text-ink-2">Dompet</strong>.
          </p>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

/**
 * Dipakai sebagai `trigger` sheet lain, yang meneruskan ref lewat
 * `asChild`. Karena itu WAJIB forwardRef — komponen fungsi biasa membuat
 * React melempar peringatan "Function components cannot be given refs" di
 * konsol setiap kali panel dibuka.
 */
const QuickButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: React.ReactNode;
    title: string;
    text: string;
  }
>(({ icon, title, text, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition active:scale-[0.99]"
    {...props}
  >
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block font-black text-ink-1">{title}</span>
      <span className="block truncate text-xs font-semibold text-ink-3">{text}</span>
    </span>
  </button>
));
QuickButton.displayName = "QuickButton";
