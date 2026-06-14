import { Wallet } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { PocketSummary } from "@/app/actions/keuangan";

export function BelanjaSaldoSummary({ pockets }: { pockets: PocketSummary[] }) {
  const belanja = pockets.find((p) => p.type === "default" && p.name.toLowerCase() === "belanja");
  if (!belanja) return null;

  const totalSaldo = belanja.balance + belanja.totalSpent;

  return (
    <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
      <h2 className="font-heading font-extrabold text-ink-1 mb-3 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" /> Saldo Belanja
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border-2 border-border p-3">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Total Saldo</p>
          <p className="font-mono font-extrabold text-ink-1 mt-1">{formatRupiah(totalSaldo)}</p>
        </div>
        <div className="rounded-xl border-2 border-border p-3">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Dana Terpakai</p>
          <p className="font-mono font-extrabold text-ink-1 mt-1">{formatRupiah(belanja.totalSpent)}</p>
        </div>
        <div className="rounded-xl border-2 border-border bg-muted/40 p-3">
          <p className="text-xs font-bold text-ink-3 uppercase tracking-wide">Sisa Saldo</p>
          <p className="font-mono font-extrabold text-ink-1 mt-1">{formatRupiah(belanja.balance)}</p>
        </div>
      </div>
    </div>
  );
}
