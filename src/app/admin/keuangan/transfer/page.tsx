import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { getFinanceSummary, getTransferHistory } from "@/app/actions/keuangan";
import { GameButton } from "@/components/ui/game-button";
import { TransferForm } from "../_components/transfer-form";
import { TransferHistoryList } from "../_components/transfer-history";

export const dynamic = "force-dynamic";

export default async function TransferPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const [summary, history] = await Promise.all([getFinanceSummary(), getTransferHistory(page, 20)]);
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));

  return (
    <div className="space-y-4">
      <TransferForm pockets={summary?.pockets ?? []} saldoUtama={summary?.saldoUtama ?? 0} />

      <section className="space-y-2 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <History className="h-4 w-4 text-accent" aria-hidden /> Riwayat Transfer
        </h2>
        <p className="text-[11px] font-semibold text-ink-3">
          Menghapus riwayat hanya menghilangkan catatannya. Saldo yang sudah dipindahkan tetap di
          tempatnya.
        </p>

        <TransferHistoryList items={history.items} />

        {totalPages > 1 && (
          <nav
            aria-label="Halaman riwayat transfer"
            className="flex items-center justify-between gap-2 border-t-2 border-border pt-3"
          >
            {page > 1 ? (
              <GameButton asChild variant="outline" size="sm">
                <Link href={`/admin/keuangan/transfer?page=${page - 1}`}>
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Sebelumnya
                </Link>
              </GameButton>
            ) : (
              <span />
            )}
            <p className="text-xs font-bold text-ink-3">
              Halaman {page} / {totalPages}
            </p>
            {page < totalPages ? (
              <GameButton asChild variant="outline" size="sm">
                <Link href={`/admin/keuangan/transfer?page=${page + 1}`}>
                  Berikutnya <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </GameButton>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
