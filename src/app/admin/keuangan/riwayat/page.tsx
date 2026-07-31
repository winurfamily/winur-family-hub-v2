import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLedger } from "@/app/actions/riwayat";
import { getIncomeFilterOptions } from "@/app/actions/pendapatan";
import { LedgerView } from "../_components/ledger-view";

export const dynamic = "force-dynamic";

export default async function RiwayatPage() {
  const [initial, options] = await Promise.all([
    getLedger({ page: 1, pageSize: 25 }),
    getIncomeFilterOptions(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/admin/keuangan"
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Keuangan
        </Link>
        <h1 className="font-heading text-2xl font-black text-ink-1">🧾 Riwayat</h1>
        <p className="text-sm font-semibold text-ink-2">
          Pendapatan, pengeluaran, dan transfer dalam satu daftar.
        </p>
      </header>

      <LedgerView initial={initial} options={options} />
    </div>
  );
}
