"use client";

import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { PocketDialog } from "./pocket-dialog";
import { formatRupiah } from "@/lib/format";
import { deletePocket, type PocketSummary } from "@/app/actions/keuangan";

export function PocketList({ pockets }: { pockets: PocketSummary[] }) {
  return (
    <ul className="space-y-2.5">
      {pockets.map((pocket) => (
        <li key={pocket.id}>
          <PocketRow pocket={pocket} />
        </li>
      ))}
    </ul>
  );
}

function PocketRow({ pocket }: { pocket: PocketSummary }) {
  const hasBalance = pocket.balance > 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-card p-3.5 shadow-card">
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-extrabold text-ink-1">{pocket.name}</p>
        <p className="tabular text-sm font-bold text-ink-2">{formatRupiah(pocket.balance)}</p>
        {pocket.totalSpent > 0 && (
          <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
            Terpakai {formatRupiah(pocket.totalSpent)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PocketDialog
          pocket={{ id: pocket.id, name: pocket.name }}
          trigger={
            <button
              type="button"
              aria-label={`Ubah nama pocket ${pocket.name}`}
              className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          }
        />

        {/* Pocket bersaldo tidak bisa dihapus — dananya harus dipindahkan dulu
            supaya tidak ada uang yang hilang dari pembukuan. */}
        <ConfirmDialog
          title="Hapus pocket?"
          message={
            hasBalance
              ? `Pocket "${pocket.name}" masih menyimpan ${formatRupiah(pocket.balance)}. Pindahkan saldonya lewat menu Transfer sebelum menghapus.`
              : `Pocket "${pocket.name}" akan dihapus permanen. Riwayat transaksi yang pernah memakai pocket ini tetap tersimpan.`
          }
          successMessage="Pocket dihapus."
          onConfirm={() => deletePocket(pocket.id)}
          trigger={
            <button
              type="button"
              aria-label={`Hapus pocket ${pocket.name}`}
              className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-destructive transition-colors active:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          }
        />
      </div>
    </div>
  );
}
