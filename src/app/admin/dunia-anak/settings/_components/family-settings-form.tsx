"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, Flame, ListChecks, Volume2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateFamilySettings } from "@/app/actions/anak-settings";
import type { FamilySettingsInput } from "@/lib/validation/dunia-anak";

export function FamilySettingsForm({ settings }: { settings: FamilySettingsInput }) {
  const [form, setForm] = useState(settings);
  const [isPending, startTransition] = useTransition();

  const setNumber = (key: keyof FamilySettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateFamilySettings(form);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan pengaturan.");
        return;
      }
      toast.success("Pengaturan keluarga disimpan.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" /> Reward Default Task
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Saldo (Rp)</Label>
            <Input type="number" min={0} value={form.defaultTaskMoney} onChange={setNumber("defaultTaskMoney")} />
          </div>
          <div className="space-y-1">
            <Label>Point</Label>
            <Input type="number" min={0} value={form.defaultTaskPoint} onChange={setNumber("defaultTaskPoint")} />
          </div>
          <div className="space-y-1">
            <Label>XP</Label>
            <Input type="number" min={0} value={form.defaultTaskXp} onChange={setNumber("defaultTaskXp")} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-accent" /> Reward Default Tugas
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Saldo (Rp)</Label>
            <Input type="number" min={0} value={form.defaultTugasMoney} onChange={setNumber("defaultTugasMoney")} />
          </div>
          <div className="space-y-1">
            <Label>Point</Label>
            <Input type="number" min={0} value={form.defaultTugasPoint} onChange={setNumber("defaultTugasPoint")} />
          </div>
          <div className="space-y-1">
            <Label>XP</Label>
            <Input type="number" min={0} value={form.defaultTugasXp} onChange={setNumber("defaultTugasXp")} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Flame className="w-5 h-5 text-yellow-dark" /> Bonus Streak Mingguan
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Saldo (Rp)</Label>
            <Input type="number" min={0} value={form.streakBonusMoney} onChange={setNumber("streakBonusMoney")} />
          </div>
          <div className="space-y-1">
            <Label>Point</Label>
            <Input type="number" min={0} value={form.streakBonusPoint} onChange={setNumber("streakBonusPoint")} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-secondary" /> Suara & Tema
        </h2>
        <div className="flex items-center justify-between">
          <Label>Efek suara aplikasi</Label>
          <Switch checked={form.soundEnabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, soundEnabled: checked }))} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Tema</Label>
          <span className="text-sm font-bold text-ink-2">Sky Adventure (Terang)</span>
        </div>
      </div>

      <GameButton type="button" variant="secondary" block onClick={handleSave} disabled={isPending}>
        {isPending ? "Menyimpan..." : "Simpan Pengaturan"}
      </GameButton>
    </div>
  );
}
