import { Wallet, TrendingDown, History, PiggyBank } from "lucide-react";
import { getFinanceSummary, getIncomeHistory } from "@/app/actions/keuangan";
import { formatRupiah } from "@/lib/format";
import { IncomeDialog } from "./_components/income-dialog";
import { IncomeHistory } from "./_components/income-history";

export default async function KeuanganDashboardPage() {
  const [summary, incomeHistory] = await Promise.all([getFinanceSummary(), getIncomeHistory(5)]);

  if (!summary) {
    return <div className="text-center text-ink-2 py-10">Gagal memuat data keuangan.</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      {/* Kolom utama */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink-2 flex items-center gap-1">
                <Wallet className="w-4 h-4 text-primary" /> Saldo Utama
              </p>
              <p className="font-mono font-extrabold text-4xl text-ink-1 mt-1">{formatRupiah(summary.saldoUtama)}</p>
            </div>
            <IncomeDialog />
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-2 border-t-2 border-border pt-3">
            <TrendingDown className="w-4 h-4 text-destructive shrink-0" />
            <span>
              Pengeluaran bulan ini:{" "}
              <strong className="text-ink-1">{formatRupiah(summary.totalExpenseThisMonth)}</strong>
            </span>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
          <h2 className="font-heading font-extrabold text-ink-1 mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-accent" /> Pendapatan Terbaru
          </h2>
          <IncomeHistory items={incomeHistory} />
        </div>
      </div>

      {/* Kolom samping — Pocket */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-secondary" /> Pocket
          </h2>
          <span className="text-xs font-bold text-ink-3">{summary.totalSplitPercent}% / 100%</span>
        </div>
        {summary.pockets.length === 0 ? (
          <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
            Belum ada pocket.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {summary.pockets.map((pocket) => (
              <div key={pocket.id} className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
                <p className="text-xs font-bold text-ink-3 uppercase tracking-wide truncate">{pocket.name}</p>
                <p className="font-mono font-extrabold text-lg text-ink-1 mt-1">{formatRupiah(pocket.balance)}</p>
                <p className="text-xs text-ink-2 mt-1">Split {pocket.splitPercent}%</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
