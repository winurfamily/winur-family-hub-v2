import { Plus } from "lucide-react";
import { getFinanceSummary } from "@/app/actions/keuangan";
import { GameButton } from "@/components/ui/game-button";
import { PocketDialog } from "../_components/pocket-dialog";
import { PocketList } from "../_components/pocket-list";

export default async function PocketsPage() {
  const summary = await getFinanceSummary();
  const pockets = summary?.pockets ?? [];
  const totalSplit = summary?.totalSplitPercent ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-ink-1">Pocket Manager</h2>
          <p className="text-xs text-ink-3">Total split: {totalSplit}% / 100% • Sisa {Math.max(0, 100 - totalSplit)}%</p>
        </div>
        <PocketDialog
          trigger={
            <GameButton variant="primary" size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Pocket
            </GameButton>
          }
        />
      </div>

      {pockets.length === 0 ? (
        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
          Belum ada pocket.
        </div>
      ) : (
        <PocketList pockets={pockets} />
      )}
    </div>
  );
}
