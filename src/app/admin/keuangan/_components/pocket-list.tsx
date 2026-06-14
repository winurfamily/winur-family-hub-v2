"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { formatRupiah } from "@/lib/format";
import { deletePocket, type PocketSummary } from "@/app/actions/keuangan";
import { PocketDialog } from "./pocket-dialog";

export function PocketList({ pockets }: { pockets: PocketSummary[] }) {
  return (
    <div className="space-y-3">
      {pockets.map((pocket) => (
        <PocketRow key={pocket.id} pocket={pocket} />
      ))}
    </div>
  );
}

function PocketRow({ pocket }: { pocket: PocketSummary }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePocket(pocket.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus pocket.");
        setConfirmDelete(false);
        return;
      }
      toast.success("Pocket dihapus.");
    });
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-heading font-extrabold text-ink-1 truncate">{pocket.name}</p>
        <p className="text-sm text-ink-2">{formatRupiah(pocket.balance)}</p>
        {pocket.type === "default" && <p className="text-xs text-ink-3 mt-0.5">Pocket default</p>}
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <p className="text-xs text-ink-2 mr-1">Hapus?</p>
          <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(false)} disabled={isPending} playSound={false}>
            <X className="w-4 h-4" />
          </GameButton>
          <GameButton variant="primary" size="icon" onClick={handleDelete} disabled={isPending} playSound={false}>
            <Check className="w-4 h-4" />
          </GameButton>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <PocketDialog
            pocket={{ id: pocket.id, name: pocket.name }}
            trigger={
              <GameButton variant="outline" size="icon">
                <Pencil className="w-4 h-4" />
              </GameButton>
            }
          />
          <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </GameButton>
        </div>
      )}
    </div>
  );
}
