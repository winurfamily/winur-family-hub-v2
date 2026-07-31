import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  ClipboardList,
  Info,
  PiggyBank,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { KpiCard, DeltaBadge } from "@/components/finance/kpi-card";
import { PeriodFilter } from "@/components/finance/period-filter";
import { TrendChart, CategoryChart, PocketMeter } from "@/components/finance/finance-charts";
import { formatRupiah, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData, RecentTransaction } from "@/app/actions/dashboard";

const KIND_STYLE: Record<
  RecentTransaction["kind"],
  { label: string; sign: string; icon: React.ReactNode; className: string }
> = {
  income: {
    label: "Pendapatan",
    sign: "+",
    icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden />,
    className: "text-[#256F2A] bg-[#256F2A]/10",
  },
  expense: {
    label: "Pengeluaran",
    sign: "−",
    icon: <ShoppingCart className="h-3.5 w-3.5" aria-hidden />,
    className: "text-[#B45309] bg-[#F79009]/15",
  },
  transfer: {
    label: "Transfer",
    sign: "",
    icon: <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />,
    className: "text-[#6D28D9] bg-[#6D28D9]/10",
  },
};

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <PeriodFilter value={data.period.key} />

      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              role="status"
              className={cn(
                "flex gap-2.5 rounded-2xl border-2 p-3",
                alert.level === "danger"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-yellow-dark/40 bg-yellow/10"
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  alert.level === "danger" ? "text-destructive" : "text-yellow-dark"
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-ink-1">{alert.title}</p>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-ink-2">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saldo keluarga — angka utama halaman ini. */}
      <div className="rounded-[22px] bg-[linear-gradient(120deg,#1C1E26,#343948)] p-5 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-white/55">
          Total Saldo Keluarga
        </p>
        <p className="tabular mt-1 break-words font-mono text-[28px] font-bold leading-tight sm:text-4xl">
          {formatRupiah(data.totalKeluarga)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/50">Saldo Utama</dt>
            <dd className="tabular mt-0.5 break-words font-mono text-base font-bold sm:text-lg">
              {formatRupiah(data.saldoUtama)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-white/50">Total Pocket</dt>
            <dd className="tabular mt-0.5 break-words font-mono text-base font-bold sm:text-lg">
              {formatRupiah(data.totalPockets)}
            </dd>
          </div>
        </dl>
      </div>

      {/* KPI periode: satu kolom di HP, tiga di desktop. */}
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={`Pendapatan · ${data.period.label}`}
          value={data.income}
          tone="positive"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          label={`Pengeluaran · ${data.period.label}`}
          value={data.expense}
          tone="negative"
          icon={<TrendingDown className="h-4 w-4" />}
          hint={<DeltaBadge percent={data.expenseChangePercent} invert />}
        />
        <KpiCard
          label="Arus Kas Bersih"
          value={data.netCashFlow}
          tone={data.netCashFlow >= 0 ? "positive" : "negative"}
          icon={<Wallet className="h-4 w-4" />}
          hint={
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" aria-hidden />
              Pendapatan − pengeluaran
            </span>
          }
          className="min-[400px]:col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart data={data.trend} />
        <CategoryChart data={data.categories} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Progress pocket */}
        <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
              <PiggyBank className="h-4 w-4 text-info" aria-hidden /> Pocket
            </h2>
            <Link
              href="/admin/keuangan/pockets"
              className="tap-target flex items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Kelola <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {data.pockets.length === 0 ? (
            <EmptyBlock message="Belum ada pocket. Buat pocket untuk memisahkan dana belanja, tabungan, dan lainnya." />
          ) : (
            <div className="space-y-3">
              {data.pockets.map((pocket) => (
                <PocketMeter
                  key={pocket.id}
                  name={pocket.name}
                  balance={pocket.balance}
                  percent={pocket.sharePercent}
                  isLow={pocket.isLow}
                />
              ))}
            </div>
          )}
        </section>

        {/* Rencana belanja aktif */}
        <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
              <ClipboardList className="h-4 w-4 text-accent" aria-hidden /> Rencana Belanja Aktif
            </h2>
            <Link
              href="/admin/keuangan/belanja/rencana"
              className="tap-target flex items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Lihat <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {data.activePlans.length === 0 ? (
            <EmptyBlock message="Belum ada rencana belanja yang berjalan." />
          ) : (
            <ul className="space-y-3">
              {data.activePlans.map((plan) => (
                <li key={plan.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-extrabold text-ink-1">{plan.name}</span>
                    <span className="tabular shrink-0 text-xs font-bold text-ink-2">
                      {formatRupiah(plan.totalEstimated)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(2, plan.progressPercent)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-ink-3">
                      {plan.boughtCount}/{plan.itemCount}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Transaksi terbaru */}
      <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-black text-ink-1">Transaksi Terbaru</h2>
          <Link
            href="/admin/keuangan/riwayat"
            className="tap-target flex items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Semua riwayat <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {data.recent.length === 0 ? (
          <EmptyBlock message="Belum ada transaksi tercatat." />
        ) : (
          <ul className="divide-y divide-border">
            {data.recent.map((item) => {
              const style = KIND_STYLE[item.kind];
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  {/* Ikon + label teks: jenis transaksi tidak dibedakan warna saja. */}
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      style.className
                    )}
                    aria-hidden
                  >
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-ink-1">{item.title}</p>
                    <p className="truncate text-[11px] font-semibold text-ink-3">
                      {style.label} · {item.subtitle}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[13px] font-extrabold text-ink-1">
                      {style.sign}
                      {formatRupiah(item.amount)}
                    </p>
                    <p className="text-[10px] font-semibold text-ink-3">{formatDate(item.date)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-xs font-semibold text-ink-3">
      {message}
    </p>
  );
}

/** Skeleton untuk Suspense saat data dashboard sedang dimuat (D). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat dashboard">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 w-24 shrink-0 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-[150px] animate-pulse rounded-[22px] bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[18px] bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-[20px] bg-surface-2" />
        <div className="h-64 animate-pulse rounded-[20px] bg-surface-2" />
      </div>
    </div>
  );
}
