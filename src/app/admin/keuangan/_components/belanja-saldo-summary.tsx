import { Wallet } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { PocketSummary } from "@/app/actions/keuangan";

/** Kartu saldo ringkas di atas modul belanja, agar sumber dana selalu terlihat. */
export function BelanjaSaldoSummary({
  pockets,
  saldoUtama,
}: {
  pockets: PocketSummary[];
  saldoUtama: number;
}) {
  return (
    <section aria-label="Ringkasan saldo" className="rounded-[18px] bg-card p-3.5 shadow-card">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
        <Wallet className="h-3.5 w-3.5" aria-hidden /> Dana tersedia
      </p>
      {/* Geser-snap di layar sempit; tidak ada kartu yang terpotong. */}
      <div className="snap-tabs scroll-no-bar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <SaldoChip label="Saldo Utama" value={saldoUtama} highlight />
        {pockets.map((pocket) => (
          <SaldoChip key={pocket.id} label={pocket.name} value={pocket.balance} />
        ))}
      </div>
    </section>
  );
}

function SaldoChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`min-w-[130px] shrink-0 rounded-xl border-2 px-3 py-2 ${
        highlight ? "border-primary/30 bg-primary-light" : "border-border bg-surface-2"
      }`}
    >
      <p className="truncate text-[10px] font-extrabold uppercase tracking-wide text-ink-3">{label}</p>
      <p className="tabular mt-0.5 font-mono text-sm font-bold text-ink-1">{formatRupiah(value)}</p>
    </div>
  );
}
