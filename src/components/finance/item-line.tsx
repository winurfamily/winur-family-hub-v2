import * as React from "react";
import { cn } from "@/lib/utils";
import { formatUnitQty } from "@/lib/shopping-item";

/**
 * Tampilan baku satu barang belanja.
 *
 * Dipakai di SEMUA tempat barang muncul — checklist, pratinjau tempel daftar,
 * barang tambahan, review hasil scan, dan detail transaksi — supaya "Beras
 * 5 kg" ditulis dengan cara yang sama persis di mana pun.
 *
 * Aturan bentuknya:
 *  - nama barang adalah baris pertama dan yang paling besar,
 *  - kuantitas + satuan adalah lencana di sisi kanan nama, bukan angka kecil
 *    yang mengambang di baris kedua tanpa konteks,
 *  - keterangan harga turun ke baris kedua yang lebih redup,
 *  - satu barang tetap satu baris ringkas, bukan kartu besar.
 */

export function QtyBadge({
  qty,
  unit,
  tone = "default",
  className,
}: {
  qty: number;
  unit?: string | null;
  tone?: "default" | "muted" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[13px] font-black leading-none",
        tone === "default" && "bg-surface-2 text-ink-2",
        tone === "muted" && "bg-surface-2 text-ink-3",
        tone === "accent" && "bg-primary-light text-primary",
        className
      )}
    >
      {formatUnitQty(qty, unit)}
    </span>
  );
}

export function ItemLine({
  name,
  qty,
  unit,
  meta,
  trailing,
  state = "default",
  className,
}: {
  name: string;
  qty: number;
  unit?: string | null;
  /** Baris kedua: harga satuan, subtotal, atau catatan status. */
  meta?: React.ReactNode;
  /** Nilai di ujung kanan baris (mis. subtotal transaksi). */
  trailing?: React.ReactNode;
  state?: "default" | "done" | "cancelled";
  className?: string;
}) {
  const struck = state === "done" || state === "cancelled";

  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 break-words text-[15px] font-bold leading-snug text-ink-1 transition-colors duration-200",
              struck && "text-ink-3 line-through",
              state === "cancelled" && "opacity-60"
            )}
          >
            {name}
          </p>
          <QtyBadge qty={qty} unit={unit} tone={struck ? "muted" : "default"} className="mt-px" />
        </div>
        {meta && (
          <p className="tabular mt-0.5 break-words text-[11.5px] font-semibold text-ink-3">{meta}</p>
        )}
      </div>
      {trailing}
    </div>
  );
}
