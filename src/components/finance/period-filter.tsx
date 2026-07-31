"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/period";

/**
 * Filter periode dashboard (D.14). Nilainya disimpan di query string supaya
 * pilihan bertahan saat halaman disegarkan atau dibagikan sebagai tautan.
 * Deretan bisa digeser dengan snap di layar sempit — bukan terpotong.
 */
export function PeriodFilter({ value }: { value: PeriodKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const select = (key: PeriodKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periode", key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div
      role="group"
      aria-label="Filter periode"
      className={cn(
        "snap-tabs scroll-no-bar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5",
        isPending && "opacity-60"
      )}
    >
      {PERIOD_KEYS.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            disabled={isPending}
            onClick={() => select(key)}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-xl border-2 px-3.5 font-heading text-[13px] font-extrabold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-primary-dark bg-primary text-primary-foreground"
                : "border-border bg-card text-ink-2 active:bg-surface-2"
            )}
          >
            {PERIOD_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
