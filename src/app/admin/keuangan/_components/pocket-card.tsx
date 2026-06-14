"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Wallet } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { withdrawPocketBalance, type PocketSummary } from "@/app/actions/keuangan";

export function PocketCard({ pocket }: { pocket: PocketSummary }) {
  const [open, setOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalSaldo = pocket.balance + pocket.totalSpent;

  const handleWithdraw = () => {
    startTransition(async () => {
      const result = await withdrawPocketBalance(pocket.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menarik saldo pocket.");
        setConfirmWithdraw(false);
        return;
      }
      toast.success(`Saldo "${pocket.name}" dikembalikan ke Saldo Utama.`);
      setConfirmWithdraw(false);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-border bg-card shadow-card p-4 text-left transition-transform active:translate-y-[2px]"
      >
        <p className="text-xs font-bold text-ink-3 uppercase tracking-wide truncate">{pocket.name}</p>
        <p className="font-mono font-extrabold text-lg text-ink-1 mt-1">{formatRupiah(pocket.balance)}</p>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmWithdraw(false);
        }}
      >
        <DialogContent className="rounded-2xl border-2 border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-ink-1">{pocket.name}</DialogTitle>
            <DialogDescription>{pocket.type === "default" ? "Pocket default" : "Pocket custom"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="rounded-xl border-2 border-border bg-muted/40 p-3">
              <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Sisa Saldo</p>
              <p className="font-mono font-extrabold text-2xl text-ink-1">{formatRupiah(pocket.balance)}</p>
            </div>

            {pocket.totalSpent > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border-2 border-border p-3">
                  <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Total Saldo</p>
                  <p className="font-mono font-bold text-ink-1">{formatRupiah(totalSaldo)}</p>
                </div>
                <div className="rounded-xl border-2 border-border p-3">
                  <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Dana Terpakai</p>
                  <p className="font-mono font-bold text-ink-1">{formatRupiah(pocket.totalSpent)}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:flex-col sm:space-x-0">
            {confirmWithdraw ? (
              <div className="w-full space-y-2 rounded-xl border-2 border-destructive/50 bg-destructive/5 p-3">
                <p className="text-sm text-ink-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  Kembalikan {formatRupiah(pocket.balance)} ke Saldo Utama?
                </p>
                <div className="flex gap-2">
                  <GameButton
                    type="button"
                    variant="outline"
                    size="sm"
                    block
                    onClick={() => setConfirmWithdraw(false)}
                    disabled={isPending}
                    playSound={false}
                  >
                    Batal
                  </GameButton>
                  <GameButton
                    type="button"
                    variant="primary"
                    size="sm"
                    block
                    onClick={handleWithdraw}
                    disabled={isPending}
                    playSound={false}
                  >
                    {isPending ? "Memproses..." : "Ya, Kembalikan"}
                  </GameButton>
                </div>
              </div>
            ) : (
              <GameButton
                type="button"
                variant="outline"
                size="sm"
                block
                onClick={() => setConfirmWithdraw(true)}
                disabled={pocket.balance <= 0}
              >
                <Wallet className="w-4 h-4" /> Hapus Saldo ke Saldo Utama
              </GameButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
