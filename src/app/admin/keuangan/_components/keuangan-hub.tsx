"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  PiggyBank,
  ReceiptText,
  Scale,
  Target,
  Wallet,
} from "lucide-react";
import { Panel, SectionTitle, SegmentTabs, StatTile, EmptyState } from "@/components/finance/ui";
import { CalendarCard } from "./calendar-card";
import { TransactionList } from "./transaction-list";
import { BudgetPanel } from "./budget-panel";
import { RecordBar } from "./record-bar";
import { EntryRow } from "./entry-row";
import { TransferForm } from "./transfer-form";
import { TransferHistoryList } from "./transfer-history";
import { PocketDialog } from "./pocket-dialog";
import { PocketList } from "./pocket-list";
import { AlertStack } from "./alert-stack";
import { AdjustBalanceSheet } from "./adjust-balance-sheet";
import { AdjustmentHistory } from "./adjustment-history";
import { RecurringPanel } from "./recurring-panel";
import type { FinanceSummary, MonthlyTrendPoint, TransferHistoryResult } from "@/app/actions/keuangan";
import type { LedgerResult } from "@/app/actions/riwayat";
import type { BudgetOverview } from "@/app/actions/budget";
import type { AdjustmentListResult } from "@/app/actions/penyesuaian";
import type { RecurringOverview } from "@/app/actions/rutin";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/supabase/types";
import { formatRupiah, formatDate } from "@/lib/format";

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

type Tab = "ringkasan" | "transaksi" | "rutin" | "analitik" | "dompet" | "anggaran";

/**
 * Urutan tab mengikuti seberapa sering masing-masing dibuka. "Rutin" duduk
 * tepat setelah "Transaksi" karena keduanya dilihat pada kunjungan harian
 * yang sama: apa yang sudah tercatat, dan apa yang menunggu dikonfirmasi.
 */
const TABS = [
  { id: "ringkasan" as const, label: "Ringkasan", icon: <Wallet className="h-4 w-4" /> },
  { id: "transaksi" as const, label: "Transaksi", icon: <ReceiptText className="h-4 w-4" /> },
  { id: "rutin" as const, label: "Rutin", icon: <CalendarClock className="h-4 w-4" /> },
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
  adjustments,
  recurring,
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
  adjustments: AdjustmentListResult;
  recurring: RecurringOverview;
  dateFrom: string;
  dateTo: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const pockets = summary?.pockets ?? [];
  const saldoUtama = summary?.saldoUtama ?? 0;
  const totalKeluarga = summary?.totalKeluarga ?? 0;
  const income = ledger.totals.income;
  const expense = ledger.totals.expense;
  const diff = income - expense;

  /**
   * Saldo ada, tapi bulan yang sedang dilihat kosong. Tanpa penjelasan ini
   * angkanya terlihat "muncul sendiri" — padahal sumbernya transaksi di bulan
   * lain. Petunjuknya sekaligus mengarahkan ke tempat transaksi itu bisa
   * dibuka dan dihapus.
   */
  const saldoTanpaTransaksiBulanIni = totalKeluarga !== 0 && ledger.entries.length === 0;

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
  const refresh = () => router.refresh();

  /**
   * Saldo Utama + pocket, dalam bentuk yang dipakai pemilih akun penyesuaian.
   * Sengaja tanpa useMemo: daftarnya paling banyak beberapa baris, dan
   * penerimanya hanya membacanya saat panel dibuka.
   */
  const adjustAccounts = [
    { id: "main", name: "Saldo Utama", balance: saldoUtama },
    ...pockets.map((pocket) => ({ id: pocket.id, name: pocket.name, balance: pocket.balance })),
  ];

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
                className="tap-target grid place-items-center rounded-xl bg-white/15 text-white transition-transform duration-150 active:scale-90"
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
                className="tap-target grid place-items-center rounded-xl bg-white/15 text-white transition-transform duration-150 active:scale-90"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <p className="tabular relative mt-1 break-words font-mono text-[34px] font-black leading-tight sm:text-5xl">
            {formatRupiah(totalKeluarga)}
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

      {/* Aksi pencatatan: melayang di zona ibu jari pada HP, menyatu di desktop. */}
      <RecordBar
        pockets={pockets}
        saldoUtama={saldoUtama}
        pocketOptions={options.pockets}
        onChanged={refresh}
      />

      {/* Peringatan berada DI ATAS tab, bukan di dalam salah satunya: anggaran
          yang terlampaui harus terlihat sejak menu dibuka, bukan hanya oleh
          orang yang kebetulan membuka tab Anggaran. */}
      <AlertStack alerts={budget.alerts} onNavigate={setTab} />

      <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />

      {saldoTanpaTransaksiBulanIni && (
        <button
          type="button"
          onClick={() => setTab("transaksi")}
          className="flex w-full items-start gap-2.5 rounded-[18px] bg-accent-light p-3.5 text-left transition-transform duration-150 active:scale-[0.99]"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="text-[12px] font-semibold leading-relaxed text-ink-2">
            Bulan ini belum ada transaksi, tetapi saldo keluarga{" "}
            <strong className="text-ink-1">{formatRupiah(totalKeluarga)}</strong>. Angkanya berasal dari
            transaksi bertanggal bulan lain — buka <strong className="text-ink-1">Transaksi</strong> lalu
            pilih <strong className="text-ink-1">Semua waktu</strong> untuk melihat, mengubah, atau
            menghapusnya.
          </span>
        </button>
      )}

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
                className="tap-target shrink-0 rounded-xl px-2 text-xs font-black text-primary transition-transform duration-150 active:scale-95"
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
                          : "Catat pendapatan atau pengeluaran pertama lewat tombol besar di bawah."
                      }
                    />
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-border">
                  {shown.map((entry) => (
                    <EntryRow
                      key={entry.key}
                      entry={entry}
                      pockets={options.pockets}
                      onChanged={refresh}
                      showDate={!pickedDate}
                    />
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

      {/* ---------- Transaksi rutin ---------- */}
      {tab === "rutin" && <RecurringPanel overview={recurring} pockets={options.pockets} />}

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
                        className="tap-target rounded-xl bg-primary-light px-3 text-xs font-black text-primary transition-transform duration-150 active:scale-95"
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

            {/* Penyesuaian saldo tinggal di Dompet, bukan di bilah pencatatan.
                Ia mengoreksi SEBUAH AKUN, bukan mencatat transaksi baru —
                menaruhnya bersebelahan dengan Pendapatan/Pengeluaran akan
                mengundangnya dipakai sebagai jalan pintas mencatat uang. */}
            <Panel className="p-4">
              <SectionTitle
                icon={<Scale className="h-[18px] w-[18px]" />}
                title="Penyesuaian Saldo"
                action={
                  <AdjustBalanceSheet
                    accounts={adjustAccounts}
                    trigger={
                      <button
                        type="button"
                        className="tap-target rounded-xl bg-primary-light px-3 text-xs font-black text-primary transition-transform duration-150 active:scale-95"
                      >
                        Sesuaikan
                      </button>
                    }
                  />
                }
              />
              <p className="mt-1 text-[11px] font-semibold text-ink-3">
                Dipakai saat saldo aplikasi berbeda dari uang yang sebenarnya. Alasannya wajib diisi
                dan tersimpan permanen.
              </p>
              <div className="mt-3">
                <AdjustmentHistory items={adjustments.items} ready={adjustments.ready} />
              </div>
            </Panel>

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

      {/* Ruang bagi bilah aksi mengambang supaya tidak menutupi baris terakhir. */}
      <div aria-hidden className="h-[68px] lg:hidden" />
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
