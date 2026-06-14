import { cn } from "@/lib/utils";
import { WidgetPanel } from "./widget-panel";

interface SectionCardProps {
  title?: string;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** Kartu section dengan header (judul + ikon + aksi) di atas panel kaca. */
export function SectionCard({ title, icon, action, className, contentClassName, children }: SectionCardProps) {
  return (
    <WidgetPanel className={cn("flex flex-col gap-3 p-4 sm:p-5 lg:p-6", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <h3 className="flex items-center gap-2 font-heading text-sm font-extrabold text-ink-1 sm:text-base lg:text-lg">
              {icon && <span className="text-lg sm:text-xl">{icon}</span>}
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className={cn("flex-1", contentClassName)}>{children}</div>
    </WidgetPanel>
  );
}
