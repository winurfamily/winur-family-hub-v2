import { formatRupiah, formatDate } from "@/lib/format";
import type { ChildInvestmentItem } from "@/app/actions/child-investasi";

interface ActiveInvestmentCardProps {
  investment: ChildInvestmentItem;
}

/** Kartu investasi yang sedang berjalan, dengan progress bar 30 hari. */
export function ActiveInvestmentCard({ investment }: ActiveInvestmentCardProps) {
  const start = new Date(investment.startAt).getTime();
  const end = new Date(investment.endAt).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const daysPassed = Math.min(totalDays, Math.round((investment.progressPercent / 100) * totalDays));
  const daysLeft = Math.max(0, totalDays - daysPassed);

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl border-2 border-secondary/60 p-4 shadow-card sm:rounded-3xl sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
      <div className="relative mb-2 flex items-center justify-between">
        <span className="rounded-lg bg-secondary/15 px-2 py-0.5 text-[10px] font-extrabold text-secondary">AKTIF</span>
        <p className="text-[11px] font-bold text-ink-3">
          {formatDate(investment.startAt)} → {formatDate(investment.endAt)}
        </p>
      </div>
      <p className="relative font-heading text-base font-extrabold text-ink-1 sm:text-lg">
        Modal: {formatRupiah(investment.amount)} → Est: {formatRupiah(investment.amount + investment.estimatedReturn)}
      </p>
      <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary/20 sm:h-4">
        <div
          className="h-full rounded-full bg-secondary transition-all duration-500"
          style={{ width: `${investment.progressPercent}%` }}
        />
      </div>
      <div className="relative mt-1 flex items-center justify-between text-[11px] font-bold text-ink-3">
        <span>
          {daysPassed}/{totalDays} hari
        </span>
        <span>{investment.isDue ? "Jatuh tempo ✅" : `Sisa ${daysLeft} hari`}</span>
      </div>
      {investment.isDue ? (
        <p className="relative mt-2 text-center text-xs font-bold text-secondary">
          ✅ Sudah jatuh tempo, menunggu konfirmasi Ayah/Mamah
        </p>
      ) : (
        <p className="relative mt-2 text-center text-xs font-bold text-ink-3">🔒 Investasi tidak dapat dibatalkan</p>
      )}
    </div>
  );
}
