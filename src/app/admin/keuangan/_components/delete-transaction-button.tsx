"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { deleteShoppingTransaction } from "@/app/actions/belanja";
import { formatRupiah } from "@/lib/format";

/**
 * Hapus transaksi belanja.
 *
 * Berbeda dari hapus riwayat transfer: dana belanja DIKEMBALIKAN ke sumbernya,
 * karena uangnya memang tidak jadi keluar. Pengguna juga memilih sendiri apakah
 * bukti struknya ikut dihapus (F3.17) — kalau tidak, berkasnya menjadi file
 * lepas yang bisa dibersihkan dari halaman Penggunaan Storage.
 */
export function DeleteTransactionButton({
  transactionId,
  merchant,
  total,
  accountName,
  hasReceipt,
}: {
  transactionId: string;
  merchant: string;
  total: number;
  accountName: string;
  hasReceipt: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alsoDeleteReceipt, setAlsoDeleteReceipt] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteShoppingTransaction(transactionId, hasReceipt && alsoDeleteReceipt);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus transaksi.");
        return;
      }
      toast.success("Transaksi dihapus & dana dikembalikan.");
      setOpen(false);
      router.replace("/admin/keuangan/belanja/riwayat");
      router.refresh();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>
        <GameButton type="button" variant="outline" block className="gap-1.5 text-destructive">
          <Trash2 className="h-4 w-4" aria-hidden /> Hapus Transaksi
        </GameButton>
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent title="Hapus transaksi belanja?" className="sm:max-w-md">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <p className="pt-1 text-sm font-semibold leading-relaxed text-ink-2">
            Transaksi <strong className="text-ink-1">{merchant}</strong> sebesar{" "}
            <strong className="text-ink-1">{formatRupiah(total)}</strong> akan dihapus permanen, dan
            dananya dikembalikan ke <strong className="text-ink-1">{accountName}</strong>.
          </p>
        </div>

        {hasReceipt && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-surface-2 p-3">
            <Label htmlFor="delete-receipt" className="text-sm font-bold text-ink-1">
              Hapus juga foto strukku
              <span className="mt-0.5 block text-[11px] font-semibold text-ink-3">
                Kalau dimatikan, foto tetap tersimpan sebagai file lepas.
              </span>
            </Label>
            <Switch
              id="delete-receipt"
              checked={alsoDeleteReceipt}
              onCheckedChange={setAlsoDeleteReceipt}
              disabled={isPending}
            />
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <GameButton
            type="button"
            variant="outline"
            block
            disabled={isPending}
            onClick={() => setOpen(false)}
            className="sm:w-auto sm:min-w-[110px]"
          >
            Batal
          </GameButton>
          <GameButton
            type="button"
            block
            disabled={isPending}
            onClick={handleDelete}
            className="bg-destructive shadow-[0_4px_0_#C62828] active:shadow-[0_1px_0_#C62828] sm:w-auto sm:min-w-[110px]"
          >
            {isPending ? "Memproses…" : "Hapus"}
          </GameButton>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
