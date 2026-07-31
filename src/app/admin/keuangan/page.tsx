import Link from "next/link";
import { ArrowRight, PiggyBank, TrendingDown, Wallet } from "lucide-react";
import { getFinanceSummary } from "@/app/actions/keuangan";
import { getIncomeHistory } from "@/app/actions/pendapatan";
import { PocketCard } from "./_components/pocket-card";
import { IncomeRecent } from "./_components/income-recent";
import { formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KeuanganDashboardPage() {
  const [summary, incomes] = await Promise.all([getFinanceSummary(), getIncomeHistory(5)]);

  if (!summary) {
    return (
      <p className="rounded-2xl bg-card px-4 py-10 text-center text-sm font-semibold text-ink-2 shadow-card">
        Gagal memuat data keuangan.
      </p>
    );
  }

  const pocketOptions = summary.pockets.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {/* Ringkasan saldo */}
        <div className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
            <Wallet className="h-4 w-4 text-primary" aria-hidden /> Saldo Utama
          </p>
          <p className="tabular mt-1 break-words font-mono text-3xl font-bold text-ink-1 sm:text-4xl">
            {formatRupiah(summary.saldoUtama)}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-3 border-t-2 border-border pt-3">
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-ink-3">Total Pocket</dt>
              <dd className="tabular mt-0.5 break-words font-mono text-base font-bold text-ink-1">
                {formatRupiah(summary.totalPockets)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-3">
                <TrendingDown className="h-3 w-3 text-destructive" aria-hidden /> Pengeluaran bulan ini
              </dt>
              <dd className="tabular mt-0.5 break-words font-mono text-base font-bold text-ink-1">
                {formatRupiah(summary.totalExpenseThisMonth)}
              </dd>
            </div>
          </dl>
        </div>

        <IncomeRecent items={incomes} pockets={pocketOptions} />

        <nav aria-label="Menu keuangan lainnya" className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/admin/keuangan/riwayat"
            className="flex min-h-[60px] items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span aria-hidden className="text-xl">
              🧾
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-ink-1">Riwayat Transaksi</span>
              <span className="block text-[11px] font-semibold text-ink-3">
                Pendapatan, belanja & transfer
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>

          <Link
            href="/admin/keuangan/storage"
            className="flex min-h-[60px] items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span aria-hidden className="text-xl">
              💾
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-ink-1">Penggunaan Storage</span>
              <span className="block text-[11px] font-semibold text-ink-3">Kelola bukti struk</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
        </nav>
      </div>

      {/* Pocket */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
            <PiggyBank className="h-5 w-5 text-info" aria-hidden /> Pocket
          </h2>
          <Link
            href="/admin/keuangan/pockets"
            className="tap-target flex items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Kelola <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {summary.pockets.length === 0 ? (
          <p className="rounded-[20px] bg-card px-4 py-8 text-center text-xs font-semibold text-ink-3 shadow-card">
            Belum ada pocket. Buat pocket untuk memisahkan dana belanja dan tabungan.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {summary.pockets.map((pocket) => (
              <PocketCard key={pocket.id} pocket={pocket} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
