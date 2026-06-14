import { History } from "lucide-react";
import { getFinanceSummary, getTransferHistory } from "@/app/actions/keuangan";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { TransferForm } from "../_components/transfer-form";

export default async function TransferPage() {
  const [summary, history] = await Promise.all([getFinanceSummary(), getTransferHistory(20)]);
  const pockets = summary?.pockets ?? [];

  return (
    <div className="space-y-4">
      <TransferForm pockets={pockets} />

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
        <h2 className="font-heading font-extrabold text-ink-1 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Riwayat Transfer
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-2 text-center py-4">Belum ada transfer.</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-ink-1 truncate">
                    {item.fromLabel} → {item.toLabel}
                  </p>
                  <p className="text-xs text-ink-3">
                    {formatDateTime(item.createdAt)}
                    {item.note ? ` • ${item.note}` : ""}
                  </p>
                </div>
                <p className="font-heading font-extrabold text-ink-1 shrink-0">{formatRupiah(item.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
