import { cn } from "@/lib/utils";

interface XpBarProps {
  xp: number;
  xpNextLevel: number;
  className?: string;
  showGlow?: boolean;
}

/** Bar XP hijau dengan glow saat penuh (siap naik level). */
export function XpBar({ xp, xpNextLevel, className, showGlow = true }: XpBarProps) {
  const percent = xpNextLevel > 0 ? Math.min(100, Math.round((xp / xpNextLevel) * 100)) : 0;
  const isFull = percent >= 100;

  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-inset ring-white/10", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-secondary to-[#8BC34A] transition-all duration-700 ease-out",
          isFull && showGlow && "animate-xp-glow"
        )}
        style={{ width: `${Math.max(percent, 4)}%` }}
      />
    </div>
  );
}
