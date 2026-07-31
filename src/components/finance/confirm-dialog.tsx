"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import type { ActionResult } from "@/lib/server/finance-helpers";

/**
 * Dialog konfirmasi untuk tindakan destruktif (J.13). Menggantikan
 * window.confirm() bawaan browser yang dilarang di J.16, sekaligus
 * menyediakan loading state dan pencegahan klik ganda.
 */
export function ConfirmDialog({
  trigger,
  title,
  message,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  successMessage,
  onConfirm,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  successMessage?: string;
  onConfirm: () => Promise<ActionResult<unknown>>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (isPending) return; // cegah double-submit
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.success) {
        toast.error(result.error ?? "Tindakan gagal.");
        return;
      }
      toast.success(successMessage ?? "Berhasil.");
      setOpen(false);
      onDone?.();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>
      <ResponsiveSheetContent title={title} className="sm:max-w-md">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="pt-1 text-sm font-semibold leading-relaxed text-ink-2">{message}</p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <GameButton
            type="button"
            variant="outline"
            block
            disabled={isPending}
            onClick={() => setOpen(false)}
            className="sm:w-auto sm:min-w-[110px]"
          >
            {cancelLabel}
          </GameButton>
          <GameButton
            type="button"
            variant="primary"
            block
            disabled={isPending}
            onClick={handleConfirm}
            className="bg-destructive shadow-[0_4px_0_#C62828] active:shadow-[0_1px_0_#C62828] sm:w-auto sm:min-w-[110px]"
          >
            {isPending ? "Memproses…" : confirmLabel}
          </GameButton>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
