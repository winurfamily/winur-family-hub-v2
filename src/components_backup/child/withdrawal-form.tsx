"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/child/layout/empty-state";
import { requestWithdrawal, type WithdrawalHistoryItem } from "@/app/actions/child-klaim";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";
import { soundManager } from "@/lib/sound/sound-manager";

interface WithdrawalFormProps {
  childId: string;
  saldo: number;
  isSunday: boolean;
  pendingRequest: WithdrawalHistoryItem | null;
  streakComplete: boolean;
  streakBonusClaimed: boolean;
  streakBonusMoney: number;
  streakBonusPoint: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Menunggu Persetujuan",
  approved: "✅ Disetujui",
  rejected: "❌ Ditolak",
};

/** Form tarik dana (Decision #20 — hanya hari Minggu, perlu approve admin). */
export function WithdrawalForm({
  childId,
  saldo,
  isSunday,
  pendingRequest,
  streakComplete,
  streakBonusClaimed,
  streakBonusMoney,
  streakBonusPoint,
}: WithdrawalFormProps) {
  const [amount, setAmount] = useState(0);
  const [includeBonus, setIncludeBonus] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (pendingRequest) {
    return (
      <div className="glass-panel rounded-2xl border-2 border-yellow p-4 text-center shadow-card sm:rounded-3xl sm:p-6">
        <p className="font-heading text-sm font-extrabold text-ink-1">{STATUS_LABEL[pendingRequest.status]}</p>
        <p className="mt-1 font-heading text-2xl font-extrabold text-yellow-dark sm:text-3xl">
          {formatRupiah(pendingRequest.amount)}
        </p>
        {pendingRequest.includeStreakBonus && (
          <p className="mt-1 text-xs font-bold text-ink-2">
            + Bonus Streak 🪙 {formatRupiah(pendingRequest.streakBonusAmount)} + ⭐{" "}
            {formatNumber(pendingRequest.streakBonusPoint)}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-3">Diajukan {formatDateTime(pendingRequest.requestedAt)}</p>
      </div>
    );
  }

  if (!isSunday) {
    return (
      <EmptyState
        icon="🗓️"
        title="Tarik dana hanya bisa diajukan pada hari Minggu"
        description={`Saldo kamu sekarang: ${formatRupiah(saldo)}`}
      />
    );
  }

  const canIncludeBonus = streakComplete && !streakBonusClaimed;
  const valid = (amount > 0 && amount <= saldo) || (amount === 0 && includeBonus);

  const handleSubmit = () => {
    if (!valid) return;
    startTransition(async () => {
      const result = await requestWithdrawal(childId, amount, includeBonus);
      if (result.success) {
        soundManager.play("claim");
        toast.success("Tarik dana diajukan! Tunggu persetujuan Ayah/Mamah ya 🎉");
        setAmount(0);
        setIncludeBonus(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal mengajukan tarik dana.");
      }
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-card sm:rounded-3xl sm:p-6">
      <h3 className="mb-2 font-heading text-sm font-extrabold text-ink-1 sm:text-base">💰 Tarik Dana</h3>
      <p className="mb-2 text-xs font-bold text-ink-2">Saldo kamu: {formatRupiah(saldo)}</p>

      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={saldo}
        value={amount === 0 ? "" : amount}
        onChange={(e) => setAmount(Math.max(0, Math.min(saldo, Math.round(Number(e.target.value) || 0))))}
        placeholder="Masukkan nominal"
        className="mb-3 h-12 rounded-xl border-2 border-border bg-white/10 text-center font-heading text-lg font-extrabold text-ink-1"
      />

      {saldo > 0 && (
        <button
          type="button"
          onClick={() => setAmount(saldo)}
          className="mb-3 w-full rounded-xl border-2 border-border bg-white/10 py-2 text-xs font-extrabold text-ink-2 transition-transform active:scale-95"
        >
          Tarik Semua ({formatRupiah(saldo)})
        </button>
      )}

      {canIncludeBonus && (
        <label className="mb-3 flex items-center gap-2 rounded-xl border-2 border-yellow bg-yellow/10 px-3 py-2 text-xs font-bold text-ink-1">
          <input
            type="checkbox"
            checked={includeBonus}
            onChange={(e) => setIncludeBonus(e.target.checked)}
            className="h-4 w-4 accent-yellow-dark"
          />
          Sertakan Bonus Streak 🪙 {formatRupiah(streakBonusMoney)} + ⭐ {formatNumber(streakBonusPoint)}
        </label>
      )}

      <GameButton variant="primary" block disabled={!valid || isPending} onClick={handleSubmit}>
        {isPending ? "Mengirim..." : "Ajukan Tarik Dana"}
      </GameButton>
    </div>
  );
}
