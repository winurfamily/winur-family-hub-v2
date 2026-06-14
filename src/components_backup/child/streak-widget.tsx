"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { requestWithdrawal } from "@/app/actions/child-klaim";
import { DAY_LABELS_ID, REWARD } from "@/lib/constants";
import { formatRupiah, formatNumber } from "@/lib/format";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";
import type { StreakInfo } from "@/app/actions/anak-overview";

interface StreakWidgetProps {
  childId: string;
  streak: StreakInfo;
  canClaim: boolean;
  bonusMoney?: number;
  bonusPoint?: number;
}

/** Streak mingguan 7 hari + tombol klaim bonus (hanya muncul hari Minggu jika 7/7). */
export function StreakWidget({
  childId,
  streak,
  canClaim,
  bonusMoney = REWARD.STREAK_BONUS_MONEY,
  bonusPoint = REWARD.STREAK_BONUS_POINT,
}: StreakWidgetProps) {
  const [isPending, startTransition] = useTransition();

  const todayIdx = (new Date().getDay() + 6) % 7;

  const handleClaim = () => {
    startTransition(async () => {
      const result = await requestWithdrawal(childId, 0, true);
      if (result.success) {
        soundManager.play("streak");
        toast.success("Bonus streak diajukan! Tunggu persetujuan Ayah/Mamah ya 🎉");
      } else {
        toast.error(result.error ?? "Gagal mengajukan bonus.");
      }
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-card sm:rounded-3xl sm:p-5">
      <h3 className="mb-3 font-heading text-sm font-extrabold text-ink-1 sm:text-base">🔥 Streak Mingguan</h3>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAY_LABELS_ID.map((label, i) => {
          const done = streak.dayStatus[i];
          const isToday = i === todayIdx;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-ink-3">{label}</span>
              <div
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded-xl border-2 text-base sm:h-11",
                  done
                    ? "animate-streak-pop border-secondary bg-secondary text-white shadow-[0_4px_12px_rgba(76,175,80,0.4)]"
                    : isToday
                      ? "border-yellow bg-yellow/15"
                      : "border-white/15 bg-white/5"
                )}
              >
                {done ? "✅" : isToday ? "⭐" : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border-2 border-yellow bg-yellow/15 px-3 py-2">
        <p className="text-xs font-bold text-ink-1">
          {streak.isComplete ? "Selesai 7/7! Bonus:" : `Selesaikan 7/7 (${streak.daysComplete}/7) untuk bonus:`}
        </p>
        <p className="shrink-0 font-heading text-xs font-extrabold text-yellow-dark">
          🪙 {formatRupiah(bonusMoney)} + ⭐ {formatNumber(bonusPoint)}
        </p>
      </div>

      {canClaim && (
        <GameButton
          variant="yellow"
          block
          size="sm"
          className="mt-3"
          onClick={handleClaim}
          disabled={isPending}
          playSound={false}
        >
          🎁 {isPending ? "Mengirim..." : "Klaim Bonus Minggu Ini"}
        </GameButton>
      )}
      {streak.isComplete && streak.bonusClaimed && (
        <p className="mt-3 text-center text-xs font-bold text-secondary">✅ Bonus minggu ini sudah diklaim!</p>
      )}
    </div>
  );
}
