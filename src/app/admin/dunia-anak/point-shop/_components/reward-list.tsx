"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Gift, Star } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { togglePointRewardActive, type PointRewardItem } from "@/app/actions/anak-pointshop";

export function RewardList({ rewards }: { rewards: PointRewardItem[] }) {
  if (rewards.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
        Belum ada hadiah. Tambahkan hadiah pertama di atas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rewards.map((reward) => (
        <RewardRow key={reward.id} reward={reward} />
      ))}
    </div>
  );
}

function RewardRow({ reward }: { reward: PointRewardItem }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await togglePointRewardActive(reward.id, !reward.isActive);
      if (!result.success) {
        toast.error(result.error ?? "Gagal mengubah status hadiah.");
        return;
      }
      toast.success(reward.isActive ? "Hadiah diarsipkan." : "Hadiah diaktifkan kembali.");
    });
  };

  return (
    <div className={`rounded-2xl border-2 border-border bg-card shadow-card p-4 ${!reward.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {reward.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.imageUrl} alt={reward.name} className="w-14 h-14 rounded-xl object-cover border-2 border-border shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-accent" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-ink-1 truncate">{reward.name}</p>
          {reward.description && <p className="text-xs text-ink-2 mt-0.5">{reward.description}</p>}
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3.5 h-3.5 text-accent" />
            <span className="text-sm font-bold text-ink-1">{reward.pointCost} point</span>
          </div>
          {reward.minPointUnlock > 0 && (
            <p className="text-xs text-ink-3 mt-0.5">Terbuka mulai {reward.minPointUnlock} point</p>
          )}
        </div>
        <GameButton type="button" variant="outline" size="sm" onClick={handleToggle} disabled={isPending} className="shrink-0">
          {reward.isActive ? "Arsipkan" : "Aktifkan"}
        </GameButton>
      </div>
    </div>
  );
}
