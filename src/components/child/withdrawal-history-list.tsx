import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/child/layout/empty-state";
import { cn } from "@/lib/utils";
import type { WithdrawalHistoryItem } from "@/app/actions/child-klaim";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-yellow/15 text-yellow-dark" },
  approved: { label: "Disetujui", className: "bg-secondary/15 text-secondary" },
  rejected: { label: "Ditolak", className: "bg-destructive/15 text-destructive" },
};

export function WithdrawalHistoryList({ history }: { history: WithdrawalHistoryItem[] }) {
  if (history.length === 0) {
    return <EmptyState icon="📭" title="Belum ada riwayat tarik dana." />;
  }

  return (
    <div className="space-y-2">
      {history.map((h) => {
        const status = STATUS_STYLE[h.status];
        return (
          <div key={h.id} className="glass-soft rounded-2xl p-3 shadow-card">
            <div className="flex items-center justify-between">
              <p className="font-heading text-sm font-extrabold text-ink-1">{formatRupiah(h.amount)}</p>
              <span className={cn("rounded-lg px-2 py-0.5 text-[10px] font-extrabold", status.className)}>
                {status.label}
              </span>
            </div>
            {h.includeStreakBonus && (
              <p className="text-xs font-bold text-yellow-dark">
                + Bonus 🪙 {formatRupiah(h.streakBonusAmount)} + ⭐ {formatNumber(h.streakBonusPoint)}
              </p>
            )}
            <p className="mt-1 text-[11px] text-ink-3">{formatDateTime(h.requestedAt)}</p>
          </div>
        );
      })}
    </div>
  );
}
