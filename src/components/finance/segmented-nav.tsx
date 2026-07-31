"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/sound/sound-manager";

export interface SegmentedNavItem {
  href: string;
  label: string;
  /** Aktif bila pathname diawali href ini, bukan hanya sama persis. */
  matchPrefix?: boolean;
}

/**
 * Navigasi antar-sub-halaman.
 *
 * Versi lama memakai deretan <Link> dengan padding kecil (~36px) yang sulit
 * ditekan di HP. Di sini setiap tombol memenuhi lebarnya secara merata,
 * tingginya 48px, dan SELURUH area kotak yang bisa ditekan — bukan hanya
 * teksnya. Di layar sangat sempit deretan tetap bisa digeser dengan snap
 * alih-alih terpotong.
 */
export function SegmentedNav({
  items,
  className,
  sticky = false,
}: {
  items: SegmentedNavItem[];
  className?: string;
  sticky?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (item: SegmentedNavItem) =>
    item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;

  return (
    <nav
      aria-label="Navigasi bagian"
      className={cn(
        sticky && "sticky top-[var(--admin-header-h,60px)] z-20 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-md",
        className
      )}
    >
      <div
        className={cn(
          "grid gap-2 rounded-2xl bg-surface-2 p-1.5",
          items.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => soundManager.play("tap")}
              className={cn(
                "flex min-h-12 items-center justify-center rounded-xl px-2 text-center font-heading text-sm font-extrabold leading-tight transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-primary text-primary-foreground shadow-btn-primary"
                  : "bg-transparent text-ink-2 active:bg-card"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Varian tombol (bukan link) untuk tab yang tidak mengubah URL. */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
  scrollable = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "rounded-2xl bg-surface-2 p-1.5",
        scrollable
          ? "snap-tabs scroll-no-bar flex gap-2 overflow-x-auto"
          : cn("grid gap-2", options.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"),
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              soundManager.play("tap");
              onChange(option.value);
            }}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-xl px-3 text-center font-heading text-sm font-extrabold leading-tight transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              scrollable && "shrink-0",
              active
                ? "bg-primary text-primary-foreground shadow-btn-primary"
                : "bg-transparent text-ink-2 active:bg-card"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
