"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { EmptyState } from "@/components/finance/ui";
import { deleteBalanceAdjustment, type AdjustmentView } from "@/app/actions/penyesuaian";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Jejak audit penyesuaian saldo, dalam bahasa pengguna.
 *
 * `audit_logs` sudah menyimpan hal yang sama, tetapi tabel itu tidak pernah
 * dilihat siapa pun. Daftar ini menaruh empat hal yang menjawab "kenapa saldo
 * berubah?" dalam satu baris: berapa sebelumnya, berapa sesudahnya, alasannya,
 * dan siapa yang melakukannya.
 */
export function AdjustmentHistory({ items, ready }: { items: AdjustmentView[]; ready: boolean }) {
  const router = useRouter();

  if (!ready) {
    return (
      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-xs font-semibold leading-relaxed text-ink-2">
        Penyesuaian saldo butuh{" "}
        <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
          supabase/migrations/0025_adjustment_recurring_shopping.sql
        </code>{" "}
        dijalankan di SQL Editor Supabase. Menu Keuangan lainnya tetap berjalan normal tanpa
        migration ini.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada penyesuaian"
        text="Kalau saldo aplikasi berbeda dari uang yang sebenarnya, koreksinya akan tercatat di sini beserta alasannya."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-black text-ink-1">{item.accountName}</p>
              <p
                className={cn(
                  "tabular shrink-0 text-[13px] font-black",
                  item.delta > 0 ? "text-secondary-dark" : "text-destructive"
                )}
              >
                {item.delta > 0 ? "+" : "−"}
                {formatRupiah(Math.abs(item.delta))}
              </p>
            </div>

            <p className="tabular mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-ink-3">
              <span>{formatRupiah(item.balanceBefore)}</span>
              <ArrowRight className="h-3 w-3" aria-hidden />
              <span>{formatRupiah(item.balanceAfter)}</span>
            </p>

            <p className="mt-1 break-words text-[12px] font-semibold text-ink-2">{item.reason}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
              {formatDate(item.date)} · {item.createdByName}
            </p>
          </div>

          <ConfirmDialog
            title="Batalkan penyesuaian?"
            message={`Saldo ${item.accountName} akan dikembalikan ${
              item.delta > 0 ? "berkurang" : "bertambah"
            } ${formatRupiah(Math.abs(item.delta))}. Berbeda dari menghapus riwayat transfer, penyesuaian memang tidak mewakili uang yang berpindah — jadi membatalkannya mengembalikan angkanya.`}
            confirmLabel="Batalkan"
            successMessage="Penyesuaian dibatalkan dan saldo dikembalikan."
            onConfirm={() => deleteBalanceAdjustment(item.id)}
            onDone={() => router.refresh()}
            trigger={
              <button
                type="button"
                aria-label={`Batalkan penyesuaian ${item.accountName} ${formatDate(item.date)}`}
                className="tap-target grid shrink-0 place-items-center rounded-xl text-destructive transition-transform duration-150 active:scale-90 active:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
