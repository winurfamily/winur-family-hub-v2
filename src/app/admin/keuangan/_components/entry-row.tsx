"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CategoryBadge } from "@/components/finance/category-picker";
import { HighlightText } from "@/components/finance/highlight-text";
import { EntryDetailSheet } from "./entry-detail-sheet";
import type { LedgerEntry } from "@/app/actions/riwayat";
import { ledgerVisual } from "@/lib/finance-categories";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Satu baris riwayat. SELURUH baris adalah tombol — bukan ikon kecil di ujung
 * kanan — sehingga membuka detail (dan dari sana Ubah/Hapus) selalu mudah
 * ditekan, termasuk di layar 360px.
 */
export function EntryRow({
  entry,
  pockets,
  onChanged,
  showDate = false,
  highlight = "",
}: {
  entry: LedgerEntry;
  pockets: { id: string; name: string }[];
  onChanged: () => void;
  showDate?: boolean;
  /** Kata kunci pencarian yang sedang aktif; disorot pada teks yang cocok. */
  highlight?: string;
}) {
  const [open, setOpen] = useState(false);
  const visual = ledgerVisual(entry.kind, entry.categoryKey);

  // Arah dibaca dari `direction`, bukan dari `kind`: penyesuaian saldo bisa
  // menambah maupun mengurangi, jadi tandanya tidak boleh ditebak dari jenis.
  const sign = entry.direction === "in" ? "+" : entry.direction === "out" ? "−" : "";
  const tone =
    entry.direction === "in"
      ? "text-secondary-dark"
      : entry.direction === "out"
        ? "text-destructive"
        : "text-accent";

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Detail ${entry.title}, ${formatRupiah(entry.amount)}`}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
      >
        <CategoryBadge visual={visual} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-ink-1">
            <HighlightText text={entry.title} term={highlight} />
          </span>
          <span className="block truncate text-[11px] font-semibold text-ink-3">
            {showDate && `${formatDate(entry.date)} · `}
            {entry.account}
            {entry.categoryLabel ? ` · ${entry.categoryLabel}` : ""}
            {entry.hasReceipt && " · 📎"}
          </span>
          {/* Barang yang cocok ikut ditampilkan: mencari "beras" lalu mendapat
              baris "Indomaret" tanpa penjelasan terasa seperti hasil yang keliru. */}
          {entry.matchedItems && entry.matchedItems.length > 0 && (
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink-2">
              🧾 <HighlightText text={entry.matchedItems.join(", ")} term={highlight} />
            </span>
          )}
        </span>

        <span className={cn("tabular shrink-0 text-[14px] font-black", tone)}>
          {sign}
          {formatRupiah(entry.amount)}
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      </button>

      {open && (
        <EntryDetailSheet
          entry={entry}
          pockets={pockets}
          open={open}
          onOpenChange={setOpen}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}
