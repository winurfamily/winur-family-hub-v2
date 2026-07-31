"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { deletePocketTransfer, type TransferHistoryItem } from "@/app/actions/keuangan";

export function TransferHistoryList({ items }: { items: TransferHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-surface-2 px-4 py-8 text-center text-xs font-semibold text-ink-3">
        Belum ada transfer tercatat.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <TransferHistoryRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function TransferHistoryRow({ item }: { item: TransferHistoryItem }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1 text-[13px] font-extrabold text-ink-1">
          <span className="truncate">{item.fromLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="truncate">{item.toLabel}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-ink-3">
          {formatDateTime(item.createdAt)}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>

      <p className="tabular shrink-0 font-heading text-sm font-extrabold text-[#6D28D9]">
        {formatRupiah(item.amount)}
      </p>

      {/*
        Menghapus riwayat TIDAK mengembalikan saldo. Teks konfirmasinya
        menyatakan itu apa adanya agar tidak ada yang menghapus riwayat
        dengan harapan uangnya kembali (E3).
      */}
      <ConfirmDialog
        title="Hapus riwayat transfer?"
        message="Hapus riwayat transfer ini? Riwayat akan dihapus permanen, tetapi saldo yang sudah dipindahkan tidak akan dikembalikan."
        confirmLabel="Hapus riwayat"
        successMessage="Riwayat transfer dihapus. Saldo tidak berubah."
        onConfirm={() => deletePocketTransfer(item.id)}
        trigger={
          <button
            type="button"
            aria-label={`Hapus riwayat transfer ${item.fromLabel} ke ${item.toLabel}`}
            className="tap-target flex shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-destructive transition-colors active:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        }
      />
    </li>
  );
}
