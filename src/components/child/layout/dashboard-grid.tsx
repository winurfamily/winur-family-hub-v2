import { cn } from "@/lib/utils";

interface DashboardGridProps {
  className?: string;
  children: React.ReactNode;
}

/** Grid adaptif 12-kolom untuk halaman dashboard — mengisi seluruh lebar layar. */
export function DashboardGrid({ className, children }: DashboardGridProps) {
  return <div className={cn("grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6", className)}>{children}</div>;
}

/** Kolom utama (konten primer) — melebar penuh di mobile/tablet, 8/12 di desktop. */
export function DashboardMain({ className, children }: DashboardGridProps) {
  return <div className={cn("flex flex-col gap-4 sm:col-span-2 lg:col-span-8 lg:gap-6 xl:col-span-9", className)}>{children}</div>;
}

/** Kolom samping (widget pendukung) — melebar penuh di mobile/tablet, 4/12 di desktop. */
export function DashboardAside({ className, children }: DashboardGridProps) {
  return <div className={cn("flex flex-col gap-4 sm:col-span-2 lg:col-span-4 lg:gap-6 xl:col-span-3", className)}>{children}</div>;
}
