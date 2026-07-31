"use client";

import { Check } from "lucide-react";
import type { CategoryVisual } from "@/lib/finance-categories";
import { cn } from "@/lib/utils";

/**
 * Pemilih kategori berbentuk grid ikon (bukan daftar teks / dropdown).
 *
 * Kenapa grid: memilih kategori adalah langkah yang paling sering diulang saat
 * mencatat, dan dropdown menuntut dua ketukan plus membaca. Grid 4 kolom
 * menampilkan seluruh pilihan sekaligus — satu ketukan, dikenali dari ikonnya.
 *
 * Setiap petak berukuran ≥ 64px (jauh di atas minimum 44×44), punya keadaan
 * terpilih yang jelas (cincin + centang + warna kategori), dan bereaksi saat
 * ditekan. Seluruh grid adalah satu radiogroup sehingga tetap bisa dipakai
 * dengan keyboard maupun pembaca layar.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  disabled,
  label,
  columns = 4,
}: {
  categories: CategoryVisual[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  label: string;
  columns?: 3 | 4;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1.5", columns === 3 ? "grid-cols-3" : "grid-cols-4")}
    >
      {categories.map((category) => {
        const selected = category.key === value;
        const Icon = category.Icon;
        return (
          <button
            key={category.key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(category.key)}
            className={cn(
              "group relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2",
              "transition-[transform,background-color,box-shadow] duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:scale-[0.94] disabled:opacity-50",
              selected ? "bg-primary-light ring-2 ring-primary" : "bg-surface-2 hover:bg-primary-light/60"
            )}
          >
            <span
              aria-hidden
              className="grid h-10 w-10 place-items-center rounded-2xl transition-transform duration-150 group-active:scale-90"
              style={{ backgroundColor: category.bg, color: category.fg }}
            >
              <Icon className="h-[20px] w-[20px]" strokeWidth={2.2} />
            </span>
            <span
              className={cn(
                "line-clamp-2 px-0.5 text-center text-[11px] font-black leading-tight",
                selected ? "text-primary" : "text-ink-2"
              )}
            >
              {category.label}
            </span>
            {selected && (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-white"
              >
                <Check className="h-3 w-3" strokeWidth={3.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Lencana ikon kategori untuk baris riwayat & detail. */
export function CategoryBadge({
  visual,
  size = "md",
  className,
}: {
  visual: CategoryVisual;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = visual.Icon;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl",
        size === "sm" && "h-9 w-9",
        size === "md" && "h-11 w-11",
        size === "lg" && "h-14 w-14",
        className
      )}
      style={{ backgroundColor: visual.bg, color: visual.fg }}
    >
      <Icon
        className={cn(size === "sm" && "h-4 w-4", size === "md" && "h-5 w-5", size === "lg" && "h-6 w-6")}
        strokeWidth={2.2}
      />
    </span>
  );
}
