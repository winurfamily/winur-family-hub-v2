import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import type { ActiveInvestmentInfo } from "@/app/actions/anak-overview";

interface InvestmentWidgetProps {
  childId: string;
  investment: ActiveInvestmentInfo;
}

/** Ringkasan investasi aktif di Beranda, tautan ke halaman Investasi. */
export function InvestmentWidget({ childId, investment }: InvestmentWidgetProps) {
  const start = new Date(investment.startAt).getTime();
  const end = new Date(investment.endAt).getTime();
  const now = Date.now();
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const daysPassed = Math.min(totalDays, Math.max(0, Math.round((now - start) / 86400000)));
  const percent = Math.min(100, Math.round((daysPassed / totalDays) * 100));

  return (
    <Link
      href={`/child/${childId}/investasi`}
      className="glass-panel block rounded-2xl p-4 shadow-card transition-transform hover:-translate-y-0.5 active:scale-[0.99] sm:rounded-3xl sm:p-5"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-sm font-extrabold text-ink-1 sm:text-base">📈 Investasi Aktif</h3>
        <span className="text-xs font-bold text-accent">Lihat →</span>
      </div>
      <p className="text-sm font-bold text-ink-2">
        Modal {formatRupiah(investment.amount)} → Est. {formatRupiah(investment.amount + investment.estimatedReturn)}
      </p>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary/20 sm:h-3">
        <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-right text-[11px] font-bold text-ink-3">
        {daysPassed}/{totalDays} hari
      </p>
    </Link>
  );
}
