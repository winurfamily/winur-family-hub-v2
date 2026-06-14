"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Gift, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { reviewPointRequest, type PointRequestItem } from "@/app/actions/anak-pointshop";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<PointRequestItem["status"], string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const STATUS_COLOR: Record<PointRequestItem["status"], string> = {
  pending: "text-primary",
  approved: "text-secondary",
  rejected: "text-destructive",
};

export function RequestList({ requests }: { requests: PointRequestItem[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada permintaan tukar point.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <RequestRow key={req.id} req={req} />
      ))}
    </div>
  );
}

function RequestRow({ req }: { req: PointRequestItem }) {
  const [isPending, startTransition] = useTransition();

  const handleReview = (approve: boolean) => {
    startTransition(async () => {
      const result = await reviewPointRequest(req.id, approve);
      if (!result.success) {
        toast.error(result.error ?? "Gagal memproses permintaan.");
        return;
      }
      toast.success(approve ? "Permintaan disetujui." : "Permintaan ditolak.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
          <Gift className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1 truncate">{req.rewardName}</p>
          <p className="text-xs text-ink-2">
            {req.childName} &middot; {req.pointCost} point
          </p>
          <p className="text-xs text-ink-3">{formatDateTime(req.requestedAt)}</p>
        </div>
        <span className={`text-xs font-bold shrink-0 ${STATUS_COLOR[req.status]}`}>{STATUS_LABEL[req.status]}</span>
      </div>

      {req.status === "pending" && (
        <div className="flex gap-2">
          <GameButton variant="outline" size="sm" block onClick={() => handleReview(false)} disabled={isPending}>
            <X className="w-4 h-4 text-destructive" /> Tolak
          </GameButton>
          <GameButton variant="secondary" size="sm" block onClick={() => handleReview(true)} disabled={isPending}>
            <Check className="w-4 h-4" /> Setujui
          </GameButton>
        </div>
      )}
    </div>
  );
}
