import { cn } from "@/lib/utils";
import { formatRupiah, formatNumber } from "@/lib/format";

export function SaldoPill({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-primary bg-primary/10 px-2.5 py-1 font-heading text-[11px] font-extrabold text-primary sm:text-xs",
        className
      )}
    >
      <span>🪙</span>
      <span>{formatRupiah(value)}</span>
    </div>
  );
}

export function PointPill({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-yellow bg-yellow/10 px-2.5 py-1 font-heading text-[11px] font-extrabold text-yellow-dark sm:text-xs",
        className
      )}
    >
      <span>⭐</span>
      <span>{formatNumber(value)}</span>
    </div>
  );
}

export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl px-2 py-0.5 font-heading text-[11px] font-black text-white shadow-[0_2px_8px_rgba(255,107,53,0.4)]",
        className
      )}
      style={{ background: "linear-gradient(135deg, #FFD93D, #FF6B35)" }}
    >
      Lv.{level}
    </div>
  );
}
