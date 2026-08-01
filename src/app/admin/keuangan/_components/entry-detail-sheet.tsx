"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Pencil, Receipt, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { CategoryBadge } from "@/components/finance/category-picker";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
} from "@/components/finance/responsive-sheet";
import { IncomeFormSheet } from "./income-form-sheet";
import { deleteIncome, getIncomeDetail, type IncomeItem } from "@/app/actions/pendapatan";
import { deletePocketTransfer } from "@/app/actions/keuangan";
import { deleteBalanceAdjustment } from "@/app/actions/penyesuaian";
import type { LedgerEntry } from "@/app/actions/riwayat";
import { ledgerVisual } from "@/lib/finance-categories";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Detail satu transaksi + aksinya.
 *
 * Sebelumnya tombol ubah/hapus berupa ikon mungil yang berdesakan di ujung
 * kanan tiap baris — di layar 360px ikon itu tertekan nominal dan nyaris
 * mustahil ditekan, sehingga pendapatan terasa "tidak bisa dihapus". Sekarang
 * seluruh baris dapat diketuk dan membuka panel ini, tempat Ubah dan Hapus
 * berukuran penuh serta konsekuensinya dijelaskan sebelum dikonfirmasi.
 */
export function EntryDetailSheet({
  entry,
  pockets,
  open,
  onOpenChange,
  onChanged,
}: {
  entry: LedgerEntry;
  pockets: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [income, setIncome] = useState<IncomeItem | null>(null);
  const [isLoading, startLoading] = useTransition();

  // Detail pendapatan hanya diambil ketika panelnya benar-benar dibuka —
  // bukan untuk seluruh daftar sekaligus.
  useEffect(() => {
    if (!open || entry.kind !== "income" || income) return;
    startLoading(async () => {
      setIncome(await getIncomeDetail(entry.id));
    });
  }, [open, entry.kind, entry.id, income]);

  const visual = ledgerVisual(entry.kind, entry.categoryKey);
  // Arah dibaca dari `direction`, bukan dari `kind` — penyesuaian saldo bisa
  // menambah maupun mengurangi.
  const sign = entry.direction === "in" ? "+" : entry.direction === "out" ? "−" : "";
  const amountTone =
    entry.direction === "in"
      ? "text-secondary-dark"
      : entry.direction === "out"
        ? "text-destructive"
        : "text-accent";

  return (
    <>
      <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
        <ResponsiveSheetContent title="Detail transaksi" showTitle={false} className="sm:max-w-md">
          <div className="flex flex-col items-center pb-1 text-center">
            <CategoryBadge visual={visual} size="lg" />
            <p className="mt-2.5 break-words font-heading text-lg font-black text-ink-1">{entry.title}</p>
            <p className={cn("tabular mt-0.5 font-mono text-3xl font-black", amountTone)}>
              {sign}
              {formatRupiah(entry.amount)}
            </p>
            {entry.kind === "adjustment" && (
              <p className="mt-1 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-black text-ink-2">
                Koreksi saldo — bukan pendapatan atau pengeluaran
              </p>
            )}
          </div>

          <dl className="mt-4 divide-y divide-border rounded-2xl bg-surface-2 px-3.5">
            <Row label="Tanggal" value={formatDate(entry.date)} />
            <Row label={entry.kind === "transfer" ? "Perpindahan" : "Akun"} value={entry.account} />
            {entry.categoryLabel && <Row label="Kategori" value={entry.categoryLabel} />}
            <Row label="Dicatat oleh" value={entry.createdByName} />
            {entry.note && (
              <Row label={entry.kind === "adjustment" ? "Alasan" : "Catatan"} value={entry.note} />
            )}
          </dl>

          <div className="mt-4 grid gap-2">
            {entry.kind === "income" && (
              <>
                {/* Form ubah adalah dialog BERSARANG di dalam panel ini.
                    Menutup panel lalu membuka form sebagai dialog terpisah
                    membuat keduanya berebut fokus — form-nya langsung
                    tertutup lagi dan pendapatan tidak pernah bisa diubah. */}
                {income ? (
                  <IncomeFormSheet
                    pockets={pockets}
                    income={income}
                    onSaved={() => {
                      setIncome(null);
                      onOpenChange(false);
                      onChanged();
                    }}
                    trigger={
                      <GameButton type="button" variant="outline" block>
                        <Pencil className="h-4 w-4" aria-hidden /> Ubah Pendapatan
                      </GameButton>
                    }
                  />
                ) : (
                  <GameButton type="button" variant="outline" block disabled>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memuat…
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" aria-hidden /> Ubah Pendapatan
                      </>
                    )}
                  </GameButton>
                )}

                <ConfirmDialog
                  title="Hapus pendapatan?"
                  message={`"${entry.title}" senilai ${formatRupiah(entry.amount)} akan dihapus, dan saldo ${entry.account} berkurang kembali sebesar nominal itu.`}
                  successMessage="Pendapatan dihapus dan saldo disesuaikan."
                  onConfirm={() => deleteIncome(entry.id)}
                  onDone={() => {
                    onOpenChange(false);
                    onChanged();
                  }}
                  trigger={
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-black text-destructive transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden /> Hapus Pendapatan
                    </button>
                  }
                />
              </>
            )}

            {entry.kind === "expense" && (
              <GameButton asChild variant="outline" block>
                <Link href={`/admin/keuangan/transaksi/${entry.id}`}>
                  <Receipt className="h-4 w-4" aria-hidden /> Lihat Rincian & Struk
                </Link>
              </GameButton>
            )}

            {entry.kind === "adjustment" && (
              <ConfirmDialog
                title="Batalkan penyesuaian?"
                message={`Saldo ${entry.account} akan dikembalikan ke angka sebelum koreksi ini. Berbeda dari menghapus riwayat transfer, penyesuaian memang tidak mewakili uang yang berpindah — jadi membatalkannya mengembalikan saldonya.`}
                confirmLabel="Batalkan"
                successMessage="Penyesuaian dibatalkan dan saldo dikembalikan."
                onConfirm={() => deleteBalanceAdjustment(entry.id)}
                onDone={() => {
                  onOpenChange(false);
                  onChanged();
                }}
                trigger={
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-black text-destructive transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Batalkan Penyesuaian
                  </button>
                }
              />
            )}

            {entry.kind === "transfer" && (
              <ConfirmDialog
                title="Hapus riwayat transfer?"
                message="Hanya catatannya yang hilang. Uang yang sudah berpindah TIDAK dikembalikan — buat transfer baru bila ingin memindahkannya kembali."
                successMessage="Riwayat transfer dihapus."
                onConfirm={() => deletePocketTransfer(entry.id)}
                onDone={() => {
                  onOpenChange(false);
                  onChanged();
                }}
                trigger={
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-black text-destructive transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Hapus Riwayat
                  </button>
                }
              />
            )}
          </div>
        </ResponsiveSheetContent>
      </ResponsiveSheet>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-[12px] font-bold text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[13px] font-bold text-ink-1">{value}</dd>
    </div>
  );
}
