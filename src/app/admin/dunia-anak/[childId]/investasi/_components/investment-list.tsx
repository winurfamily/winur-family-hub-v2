"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { confirmInvestmentDone, type InvestmentItem } from "@/app/actions/anak-investasi";
import { formatRupiah, formatDate } from "@/lib/format";

const STATUS_LABEL: Record<InvestmentItem["status"], string> = {
  active: "Aktif",
  completed: "Selesai",
  confirmed: "Dikonfirmasi",
};

export function InvestmentList({ investments }: { investments: InvestmentItem[] }) {
  if (investments.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada investasi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {investments.map((inv) => (
        <InvestmentRow key={inv.id} inv={inv} />
      ))}
    </div>
  );
}

function InvestmentRow({ inv }: { inv: InvestmentItem }) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmInvestmentDone(inv.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal konfirmasi investasi.");
        return;
      }
      toast.success("Investasi dikonfirmasi selesai. Saldo sudah ditambahkan.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1">{formatRupiah(inv.amount)}</p>
          <p className="text-xs text-ink-3">
            Return {inv.returnPercent}% • {formatDate(inv.startAt)} — {formatDate(inv.endAt)}
          </p>
          <p className="text-sm text-ink-2 mt-0.5">
            {inv.status === "confirmed" ? "Return diterima" : "Estimasi return"}:{" "}
            <span className="font-bold text-secondary">
              {formatRupiah(inv.actualReturn ?? inv.estimatedReturn)}
            </span>
          </p>
        </div>
        <span className="text-xs font-bold text-ink-3 shrink-0">{STATUS_LABEL[inv.status]}</span>
      </div>

      {inv.isDue && (
        <GameButton variant="secondary" size="sm" block onClick={handleConfirm} disabled={isPending}>
          <CheckCircle2 className="w-4 h-4" />
          {isPending ? "Memproses..." : "Konfirmasi Selesai"}
        </GameButton>
      )}
    </div>
  );
}
