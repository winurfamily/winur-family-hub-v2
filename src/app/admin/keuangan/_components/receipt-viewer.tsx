"use client";

import { useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { getReceiptUrl } from "@/app/actions/receipts";
import { formatBytes } from "@/lib/image-compress";

/**
 * Penampil bukti struk.
 *
 * URL bertanda tangan baru diminta saat panel dibuka, bukan saat halaman
 * dirender. URL ini berumur pendek dan tidak tersimpan di HTML halaman —
 * bucket `receipts` bersifat privat dan tidak punya public URL permanen.
 */
export function ReceiptViewer({ receiptId, fileSize }: { receiptId: string; fileSize: number }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next || url) return;

    setLoading(true);
    setError(false);
    const signed = await getReceiptUrl(receiptId);
    setLoading(false);

    if (!signed) setError(true);
    else setUrl(signed);
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => void handleOpenChange(next)}>
      <ResponsiveSheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3 text-left transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Receipt className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
          <span className="flex-1 text-sm font-extrabold text-ink-1">Lihat bukti struk</span>
          <span className="shrink-0 text-[11px] font-bold text-ink-3">{formatBytes(fileSize)}</span>
        </button>
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent title="Bukti Struk" className="sm:max-w-xl">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm font-semibold text-ink-2">
            Bukti struk tidak dapat dimuat.
          </p>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Bukti struk belanja" className="w-full rounded-2xl border-2 border-border" />
        ) : null}
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
