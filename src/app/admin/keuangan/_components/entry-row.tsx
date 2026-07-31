"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CategoryBadge } from "@/components/finance/category-picker";
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
}: {
  entry: LedgerEntry;
  pockets: { id: string; name: string }[];
  onChanged: () => void;
  showDate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visual = ledgerVisual(entry.kind, entry.categoryKey);
  const positive = entry.kind === "income";

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
          <span className="block truncate text-[14px] font-bold text-ink-1">{entry.title}</span>
          <span className="block truncate text-[11px] font-semibold text-ink-3">
            {showDate && `${formatDate(entry.date)} · `}
            {entry.account}
            {entry.categoryLabel ? ` · ${entry.categoryLabel}` : ""}
            {entry.hasReceipt && " · 📎"}
          </span>
        </span>

        <span
          className={cn(
            "tabular shrink-0 text-[14px] font-black",
            positive ? "text-secondary-dark" : entry.kind === "transfer" ? "text-accent" : "text-destructive"
          )}
        >
          {positive ? "+" : entry.kind === "expense" ? "−" : ""}
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
