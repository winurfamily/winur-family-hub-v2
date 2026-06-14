"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { startInvestment } from "@/app/actions/child-investasi";
import { formatRupiah } from "@/lib/format";
import { soundManager } from "@/lib/sound/sound-manager";

interface NewInvestmentFormProps {
  childId: string;
  saldo: number;
  returnPercent: number;
  quickAmounts: readonly number[];
}

/** Form mulai investasi baru: input manual + tombol cepat + estimasi hasil. */
export function NewInvestmentForm({ childId, saldo, returnPercent, quickAmounts }: NewInvestmentFormProps) {
  const [amount, setAmount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const estimated = Math.round((amount * returnPercent) / 100);
  const valid = amount > 0 && amount <= saldo;

  const handleQuick = (add: number) => {
    setAmount((prev) => Math.min(saldo, prev + add));
  };

  const handleSubmit = () => {
    if (!valid) return;
    startTransition(async () => {
      const result = await startInvestment(childId, amount);
      if (result.success) {
        soundManager.play("invest_done");
        toast.success("Investasi dimulai! 🌱");
        setAmount(0);
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal memulai investasi.");
      }
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-card sm:rounded-3xl sm:p-6">
      <h3 className="mb-2 font-heading text-sm font-extrabold text-ink-1 sm:text-base">🌱 Mulai Investasi Baru</h3>
      <p className="mb-2 text-xs font-bold text-ink-2">Saldo kamu: {formatRupiah(saldo)}</p>

      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={saldo}
        value={amount === 0 ? "" : amount}
        onChange={(e) => setAmount(Math.max(0, Math.min(saldo, Math.round(Number(e.target.value) || 0))))}
        placeholder="Masukkan nominal"
        className="mb-2 h-12 rounded-xl border-2 border-border bg-white/10 text-center font-heading text-lg font-extrabold text-ink-1"
      />

      <div className="mb-3 grid grid-cols-4 gap-2">
        {quickAmounts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleQuick(q)}
            className="rounded-xl border-2 border-border bg-white/10 py-2 text-xs font-extrabold text-ink-2 transition-transform active:scale-95"
          >
            +{q / 1000}rb
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(saldo)}
          className="rounded-xl border-2 border-border bg-white/10 py-2 text-xs font-extrabold text-ink-2 transition-transform active:scale-95"
        >
          Semua
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl border-2 border-secondary bg-secondary/10 px-3 py-2">
        <span className="text-xs font-bold text-ink-1">Estimasi hasil</span>
        <span className="font-heading text-sm font-extrabold text-secondary">
          +{formatRupiah(estimated)} ({returnPercent}%)
        </span>
      </div>

      <p className="mb-3 text-center text-xs font-bold text-ink-3">🔒 Setelah dimulai tidak dapat dibatalkan</p>

      <GameButton variant="secondary" block disabled={!valid || isPending} onClick={handleSubmit}>
        {isPending ? "Memproses..." : "Lanjutkan →"}
      </GameButton>
    </div>
  );
}
