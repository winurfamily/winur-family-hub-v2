"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Wallet, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { reviewWithdrawalRequest, type WithdrawalItem } from "@/app/actions/anak-withdrawal";
import { formatRupiah, formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<WithdrawalItem["status"], string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const STATUS_COLOR: Record<WithdrawalItem["status"], string> = {
  pending: "text-primary",
  approved: "text-secondary",
  rejected: "text-destructive",
};

export function WithdrawalList({ requests, isSunday }: { requests: WithdrawalItem[]; isSunday: boolean }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada permintaan tarik dana.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <WithdrawalRow key={req.id} req={req} isSunday={isSunday} />
      ))}
    </div>
  );
}

function WithdrawalRow({ req, isSunday }: { req: WithdrawalItem; isSunday: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleReview = (approve: boolean) => {
    startTransition(async () => {
      const result = await reviewWithdrawalRequest(req.id, approve);
      if (!result.success) {
        toast.error(result.error ?? "Gagal memproses permintaan.");
        return;
      }
      toast.success(approve ? "Tarik dana disetujui." : "Permintaan ditolak.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1">{formatRupiah(req.amount)}</p>
          <p className="text-xs text-ink-3">{formatDateTime(req.requestedAt)}</p>
          {req.includeStreakBonus && (
            <p className="text-xs font-bold text-yellow-dark mt-1">
              + Bonus streak {formatRupiah(req.streakBonusAmount)} & {req.streakBonusPoint} point
            </p>
          )}
        </div>
        <span className={`text-xs font-bold shrink-0 ${STATUS_COLOR[req.status]}`}>{STATUS_LABEL[req.status]}</span>
      </div>

      {req.status === "pending" && (
        <div className="space-y-1">
          {!isSunday && <p className="text-xs text-ink-3">Tarik dana hanya bisa diproses pada hari Minggu.</p>}
          <div className="flex gap-2">
            <GameButton variant="outline" size="sm" block onClick={() => handleReview(false)} disabled={isPending || !isSunday}>
              <X className="w-4 h-4 text-destructive" /> Tolak
            </GameButton>
            <GameButton variant="secondary" size="sm" block onClick={() => handleReview(true)} disabled={isPending || !isSunday}>
              <Check className="w-4 h-4" /> Setujui
            </GameButton>
          </div>
        </div>
      )}
    </div>
  );
}
