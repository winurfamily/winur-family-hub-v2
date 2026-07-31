import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

/**
 * Kartu KPI.
 *
 * Nominal memakai `break-words` + ukuran responsif supaya angka besar seperti
 * "Rp 123.456.789" tetap utuh di lebar 320px — tidak terpotong dan tidak
 * memaksa halaman menggeser ke samping.
 */
export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: number;
  hint?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative";
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[18px] bg-card p-3.5 shadow-card sm:p-4", className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
        <p className="truncate text-[11px] font-extrabold uppercase tracking-wide text-ink-3">{label}</p>
      </div>
      <p
        className={cn(
          "tabular mt-1.5 break-words font-mono text-xl font-bold leading-tight sm:text-2xl",
          tone === "positive" && "text-[#256F2A]",
          tone === "negative" && "text-destructive",
          tone === "neutral" && "text-ink-1"
        )}
      >
        {formatRupiah(value)}
      </p>
      {hint && <div className="mt-1 text-[11px] font-semibold text-ink-3">{hint}</div>}
    </div>
  );
}

/** Penanda perubahan terhadap periode sebelumnya. */
export function DeltaBadge({ percent, invert = false }: { percent: number | null; invert?: boolean }) {
  if (percent === null) {
    return <span className="text-ink-3">Tidak ada pembanding</span>;
  }

  const rounded = Math.round(percent);
  const flat = rounded === 0;
  // Untuk pengeluaran, naik = buruk. `invert` membalik makna warnanya.
  const isGood = invert ? rounded < 0 : rounded > 0;

  const Icon = flat ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold",
        flat ? "text-ink-3" : isGood ? "text-[#256F2A]" : "text-destructive"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {flat ? "Sama" : `${Math.abs(rounded)}%`}
      <span className="font-semibold text-ink-3">vs periode lalu</span>
    </span>
  );
}
