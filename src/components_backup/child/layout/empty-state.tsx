import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  className?: string;
}

/** Empty state menarik (ikon besar + pesan ramah anak), dipakai di seluruh Dunia Anak. */
export function EmptyState({ icon = "🌤️", title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 p-8 text-center backdrop-blur-sm sm:rounded-3xl sm:p-10",
        className
      )}
    >
      <span className="text-5xl">{icon}</span>
      <p className="font-heading text-sm font-extrabold text-ink-1 sm:text-base">{title}</p>
      {description && <p className="max-w-xs text-xs font-bold text-ink-2 sm:text-sm">{description}</p>}
    </div>
  );
}
