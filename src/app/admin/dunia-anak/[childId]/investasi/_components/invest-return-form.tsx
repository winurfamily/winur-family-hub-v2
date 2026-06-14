"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setInvestReturnPercent } from "@/app/actions/anak-investasi";

export function InvestReturnForm({ childId, currentPercent }: { childId: string; currentPercent: number }) {
  const [percent, setPercent] = useState(currentPercent);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await setInvestReturnPercent(childId, percent);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan.");
        return;
      }
      toast.success("Persentase return investasi disimpan.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
      <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
        <Percent className="w-5 h-5 text-accent" /> Setting Return Investasi
      </h2>
      <p className="text-sm text-ink-2">
        Persentase ini berlaku untuk investasi baru yang dibuat anak (1 bulan, tidak bisa dibatalkan).
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>Return per bulan (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value) || 0)}
          />
        </div>
        <GameButton type="button" variant="secondary" onClick={handleSave} disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </GameButton>
      </div>
    </div>
  );
}
