import { cn } from "@/lib/utils";

interface WidgetPanelProps {
  className?: string;
  children: React.ReactNode;
}

/** Panel kaca dasar (glassmorphism) — fondasi semua kartu di Dunia Anak. */
export function WidgetPanel({ className, children }: WidgetPanelProps) {
  return <div className={cn("glass-panel relative rounded-2xl shadow-card sm:rounded-3xl", className)}>{children}</div>;
}
