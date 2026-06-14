"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { requestPointReward, type ShopRewardItem } from "@/app/actions/child-shop";
import { soundManager } from "@/lib/sound/sound-manager";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ShopRewardCardProps {
  childId: string;
  reward: ShopRewardItem;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu ⏳", className: "bg-yellow/15 text-yellow-dark" },
  approved: { label: "Disetujui ✅", className: "bg-secondary/15 text-secondary" },
  rejected: { label: "Ditolak ❌", className: "bg-destructive/15 text-destructive" },
};

/** Kartu hadiah point shop (Decision #24/#25 — locked oleh min_point_unlock, point dipotong saat admin approve). */
export function ShopRewardCard({ childId, reward }: ShopRewardCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleRequest = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await requestPointReward(childId, reward.id);
      if (result.success) {
        soundManager.play("claim");
        toast.success("Penukaran diajukan! Tunggu persetujuan Ayah/Mamah ya 🎁");
      } else {
        toast.error(result.error ?? "Gagal mengajukan penukaran.");
      }
    });
  };

  return (
    <div
      className={cn(
        "glass-panel relative flex h-full flex-col gap-2 rounded-2xl p-3 shadow-card transition-transform hover:-translate-y-0.5 sm:rounded-3xl sm:p-4",
        !reward.unlocked && "opacity-80"
      )}
    >
      <span
        className={cn(
          "absolute left-2 top-2 z-10 rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide",
          reward.unlocked ? "bg-secondary/20 text-secondary" : "bg-white/10 text-ink-3"
        )}
      >
        {reward.unlocked ? "TERSEDIA" : "LOCKED"}
      </span>

      <div className="relative mx-auto mt-3 h-16 w-16 sm:h-20 sm:w-20">
        {reward.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reward.imageUrl}
            alt={reward.name}
            className={cn("h-full w-full rounded-xl object-cover", !reward.unlocked && "blur-[2px] grayscale")}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center rounded-xl bg-accent/10 text-3xl sm:text-4xl",
              !reward.unlocked && "blur-[2px] grayscale"
            )}
          >
            🎁
          </div>
        )}
        {!reward.unlocked && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 text-2xl">🔒</span>
        )}
      </div>

      <div className="text-center">
        <p className="line-clamp-1 font-heading text-xs font-extrabold text-ink-1 sm:text-sm">{reward.name}</p>
        {reward.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-3">{reward.description}</p>}
      </div>

      <div className="mt-auto flex items-center justify-center gap-1 rounded-lg bg-yellow/15 py-1 text-xs font-extrabold text-yellow-dark">
        ⭐ {formatNumber(reward.pointCost)}
      </div>

      {!reward.unlocked ? (
        <p className="text-center text-[10px] font-extrabold text-ink-3">Butuh ⭐ {formatNumber(reward.minPointUnlock)} point</p>
      ) : reward.requestStatus === "pending" ? (
        <div className={cn("rounded-lg py-1.5 text-center text-[11px] font-extrabold", STATUS_BADGE.pending.className)}>
          {STATUS_BADGE.pending.label}
        </div>
      ) : (
        <GameButton
          variant={reward.affordable ? "accent" : "outline"}
          size="sm"
          block
          disabled={!reward.affordable || isPending}
          onClick={handleRequest}
          playSound={false}
        >
          {isPending ? "..." : "Tukar"}
        </GameButton>
      )}
    </div>
  );
}
