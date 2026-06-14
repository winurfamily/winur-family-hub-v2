import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  primary: "from-primary/25 to-primary/5 text-primary",
  secondary: "from-secondary/25 to-secondary/5 text-secondary",
  accent: "from-accent/25 to-accent/5 text-accent",
  yellow: "from-yellow/35 to-yellow/5 text-yellow-dark",
  info: "from-info/25 to-info/5 text-info",
  pink: "from-pink/25 to-pink/5 text-pink-dark",
};

interface StatsCardProps {
  icon?: string;
  label: string;
  value: string;
  accent?: keyof typeof ACCENT;
  className?: string;
}

/** Kartu statistik kaca kecil: ikon bulat + nilai + label, dipakai di seluruh dashboard. */
export function StatsCard({ icon, label, value, accent = "primary", className }: StatsCardProps) {
  return (
    <div className={cn("glass-panel flex items-center gap-3 rounded-2xl p-3 shadow-card sm:p-4", className)}>
      {icon && (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl sm:h-12 sm:w-12 sm:text-2xl",
            ACCENT[accent]
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-extrabold leading-tight text-ink-1 sm:text-base">{value}</p>
        <p className="truncate text-[10px] font-bold text-ink-2 sm:text-xs">{label}</p>
      </div>
    </div>
  );
}
