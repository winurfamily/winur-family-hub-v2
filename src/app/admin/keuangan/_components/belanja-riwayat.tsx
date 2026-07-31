"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Paperclip, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getShoppingHistory, type ShoppingHistoryResult } from "@/app/actions/belanja";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/supabase/types";
import { formatRupiah, formatDate } from "@/lib/format";

export function BelanjaRiwayat({
  initialMonth,
  initialData,
}: {
  initialMonth: string;
  initialData: ShoppingHistoryResult;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (month === initialMonth) return;
    startTransition(async () => setData(await getShoppingHistory(month)));
  }, [month, initialMonth]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-[18px] bg-card p-4 shadow-card sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Label htmlFor="riwayat-month">Bulan</Label>
          <Input
            id="riwayat-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="sm:w-[200px]"
          />
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
            Total {isPending ? "…" : `${data.count} transaksi`}
          </p>
          <p className="tabular font-mono text-xl font-bold text-ink-1">{formatRupiah(data.total)}</p>
        </div>
      </div>

      {data.items.length === 0 ? (
        <p className="rounded-[20px] bg-card px-4 py-10 text-center text-xs font-semibold text-ink-3 shadow-card">
          Belum ada belanja pada bulan ini.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/keuangan/belanja/${item.id}`}
                className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 shadow-card transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F79009]/15 text-[#B45309]"
                >
                  <ShoppingCart className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-ink-1">
                    {item.merchant}
                    {item.hasReceipt && (
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label="Ada bukti struk" />
                    )}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-ink-3">
                    {formatDate(item.date)} · {EXPENSE_CATEGORY_LABELS[item.category]} · {item.pocketName}
                    {item.itemCount > 0 ? ` · ${item.itemCount} barang` : ""}
                  </p>
                </div>

                <p className="tabular shrink-0 text-sm font-extrabold text-ink-1">
                  −{formatRupiah(item.total)}
                </p>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
