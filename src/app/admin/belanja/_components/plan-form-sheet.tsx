"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { createShoppingPlan, updateShoppingPlan, type PlanView } from "@/app/actions/rencana";
import { todayISODate } from "@/lib/format";

/** Buat atau ubah satu rencana belanja (nama, tanggal, catatan). */
export function PlanFormSheet({
  trigger,
  plan,
  onSaved,
}: {
  trigger: React.ReactNode;
  plan?: PlanView;
  onSaved?: (id: string) => void;
}) {
  const isEdit = Boolean(plan);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(plan?.name ?? "");
  const [date, setDate] = useState(plan?.plannedDate ?? todayISODate());
  const [note, setNote] = useState(plan?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setDate(plan?.plannedDate ?? todayISODate());
    setNote(plan?.note ?? "");
    setError(null);
  }, [open, plan]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (!name.trim()) return setError("Nama rencana wajib diisi.");
    setError(null);

    startTransition(async () => {
      const payload = { name: name.trim(), plannedDate: date || undefined, note: note.trim() || undefined };
      const result = isEdit
        ? await updateShoppingPlan(plan!.id, payload)
        : await createShoppingPlan(payload);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan rencana.");
        setError(result.error ?? null);
        return;
      }

      toast.success(isEdit ? "Rencana diperbarui." : "Rencana dibuat.");
      setOpen(false);

      const newId = !isEdit && "data" in result ? (result.data as { id: string } | undefined)?.id : undefined;
      if (newId) {
        onSaved?.(newId);
        router.push(`/admin/belanja/${newId}`);
      } else {
        onSaved?.(plan!.id);
        router.refresh();
      }
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>
      <ResponsiveSheetContent
        title={isEdit ? "Ubah Rencana" : "Rencana Belanja Baru"}
        description="Beri nama dan tanggal, lalu isi daftar barangnya."
      >
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Nama rencana</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Contoh: Belanja Bulanan Agustus"
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-date">Tanggal belanja</Label>
            <Input
              id="plan-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-note">Catatan (opsional)</Label>
            <Textarea
              id="plan-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={isPending}
              className="min-h-[64px] rounded-xl border-2"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <GameButton type="submit" variant="primary" block disabled={isPending}>
            {isPending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Buat Rencana"}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
