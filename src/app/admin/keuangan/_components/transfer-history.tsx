"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Check, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { deletePocketTransfer, type TransferHistoryItem } from "@/app/actions/keuangan";

export function TransferHistoryList({ items }: { items: TransferHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-2 text-center py-4">Belum ada transfer.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <TransferHistoryRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function TransferHistoryRow({ item }: { item: TransferHistoryItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePocketTransfer(item.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menghapus riwayat transfer.");
        setConfirmDelete(false);
        return;
      }
      toast.success("Riwayat transfer dihapus & saldo dikembalikan.");
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="font-bold text-ink-1 truncate">
          {item.fromLabel} → {item.toLabel}
        </p>
        <p className="text-xs text-ink-3">
          {formatDateTime(item.createdAt)}
          {item.note ? ` • ${item.note}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="font-heading font-extrabold text-ink-1">{formatRupiah(item.amount)}</p>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(false)} disabled={isPending} playSound={false}>
              <X className="w-4 h-4" />
            </GameButton>
            <GameButton variant="primary" size="icon" onClick={handleDelete} disabled={isPending} playSound={false}>
              <Check className="w-4 h-4" />
            </GameButton>
          </div>
        ) : (
          <GameButton variant="outline" size="icon" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </GameButton>
        )}
      </div>
    </div>
  );
}
