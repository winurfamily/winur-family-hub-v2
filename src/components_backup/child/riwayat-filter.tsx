"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RiwayatFilter } from "@/app/actions/child-riwayat";

const FILTERS: { value: RiwayatFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "tugas", label: "📋 Tugas" },
  { value: "tarik_dana", label: "💰 Tarik Dana" },
  { value: "investasi", label: "📈 Investasi" },
  { value: "streak", label: "🔥 Streak" },
  { value: "point_shop", label: "🎁 Shop" },
];

export function RiwayatFilterChips({ active }: { active: RiwayatFilter }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scroll-no-bar lg:flex-col lg:overflow-visible lg:pb-0">
      {FILTERS.map((f) => {
        const params = new URLSearchParams(searchParams.toString());
        if (f.value === "semua") {
          params.delete("filter");
        } else {
          params.set("filter", f.value);
        }
        const query = params.toString();
        const href = query ? `${pathname}?${query}` : pathname;
        const isActive = f.value === active;

        return (
          <Link
            key={f.value}
            href={href}
            className={cn(
              "shrink-0 rounded-xl border-2 px-3 py-1.5 text-center font-heading text-xs font-extrabold transition-all sm:text-sm lg:w-full lg:px-4 lg:py-2.5 lg:text-left",
              isActive
                ? "border-accent bg-accent text-white shadow-card"
                : "glass-soft border-transparent text-ink-2"
            )}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
