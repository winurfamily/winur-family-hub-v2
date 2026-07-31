import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { getIncomeList, getIncomeFilterOptions } from "@/app/actions/pendapatan";
import { IncomeList } from "../_components/income-list";
import { IncomeFormSheet } from "../_components/income-form-sheet";

export const dynamic = "force-dynamic";

export default async function PendapatanPage() {
  const [initial, options] = await Promise.all([
    getIncomeList({ page: 1, pageSize: 20 }),
    getIncomeFilterOptions(),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/keuangan"
            className="mb-1 inline-flex min-h-11 items-center gap-1 -ml-2 rounded-xl px-2 text-xs font-extrabold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Keuangan
          </Link>
          <h1 className="font-heading text-2xl font-black text-ink-1">Pendapatan</h1>
          <p className="text-sm font-semibold text-ink-2">Semua pemasukan keluarga.</p>
        </div>

        <IncomeFormSheet
          pockets={options.pockets}
          trigger={
            <GameButton variant="secondary" size="sm" className="mt-8 shrink-0 gap-1">
              <Plus className="h-4 w-4" aria-hidden /> Tambah
            </GameButton>
          }
        />
      </header>

      <IncomeList initial={initial} options={options} />
    </div>
  );
}
