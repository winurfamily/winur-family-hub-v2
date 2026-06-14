import Link from "next/link";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { getFinanceSummary, getTransferHistory } from "@/app/actions/keuangan";
import { GameButton } from "@/components/ui/game-button";
import { TransferForm } from "../_components/transfer-form";
import { TransferHistoryList } from "../_components/transfer-history";

export default async function TransferPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const [summary, history] = await Promise.all([getFinanceSummary(), getTransferHistory(page, 20)]);
  const pockets = summary?.pockets ?? [];
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));

  return (
    <div className="space-y-4">
      <TransferForm pockets={pockets} />

      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Riwayat Transfer
        </h2>
        <TransferHistoryList items={history.items} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t-2 border-border pt-3">
            {page > 1 ? (
              <GameButton asChild variant="outline" size="sm">
                <Link href={`/admin/keuangan/transfer?page=${page - 1}`}>
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
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
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </Link>
              </GameButton>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
