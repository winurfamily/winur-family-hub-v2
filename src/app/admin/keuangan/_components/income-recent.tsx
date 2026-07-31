import Link from "next/link";
import { ArrowRight, History, Plus, TrendingUp } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { IncomeFormSheet } from "./income-form-sheet";
import { formatRupiah, formatDate } from "@/lib/format";
import { INCOME_CATEGORY_LABELS } from "@/lib/supabase/types";
import type { IncomeItem } from "@/app/actions/pendapatan";

/** Card "Pendapatan Terbaru" pada dashboard keuangan, dengan pintasan
 *  "Lihat Semua Pendapatan" ke halaman daftar lengkap (E2). */
export function IncomeRecent({
  items,
  pockets,
}: {
  items: IncomeItem[];
  pockets: { id: string; name: string }[];
}) {
  return (
    <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <History className="h-4 w-4 text-accent" aria-hidden /> Pendapatan Terbaru
        </h2>
        <IncomeFormSheet
          pockets={pockets}
          trigger={
            <GameButton variant="secondary" size="sm" className="gap-1">
              <Plus className="h-4 w-4" aria-hidden /> Tambah
            </GameButton>
          }
        />
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-8 text-center text-xs font-semibold text-ink-3">
          Belum ada pendapatan tercatat.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#256F2A]/10 text-[#256F2A]"
              >
                <TrendingUp className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-ink-1">{item.source}</p>
                <p className="truncate text-[11px] font-semibold text-ink-3">
                  {formatDate(item.date)} · {item.pocketName} · {INCOME_CATEGORY_LABELS[item.category]}
                </p>
              </div>
              <p className="tabular shrink-0 text-[13px] font-extrabold text-[#256F2A]">
                +{formatRupiah(item.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/admin/keuangan/pendapatan"
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card font-heading text-sm font-extrabold text-primary transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Lihat Semua Pendapatan <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}
