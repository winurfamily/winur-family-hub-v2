import { redirect } from "next/navigation";
import { getChildRiwayat, type RiwayatCategory, type RiwayatFilter } from "@/app/actions/child-riwayat";
import { requireChild } from "@/lib/server/child-helpers";
import { RiwayatFilterChips } from "@/components/child/riwayat-filter";
import { SectionCard } from "@/components/child/layout/section-card";
import { EmptyState } from "@/components/child/layout/empty-state";
import { DashboardGrid, DashboardMain, DashboardAside } from "@/components/child/layout/dashboard-grid";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_EMOJI: Record<RiwayatCategory, string> = {
  tugas: "📋",
  tarik_dana: "💰",
  investasi: "📈",
  streak: "🔥",
  point_shop: "🎁",
};

const CATEGORY_LABEL: Record<RiwayatCategory, string> = {
  tugas: "Tugas",
  tarik_dana: "Tarik Dana",
  investasi: "Investasi",
  streak: "Streak",
  point_shop: "Point Shop",
};

const CATEGORY_COLOR: Record<RiwayatCategory, string> = {
  tugas: "bg-accent/20 text-accent",
  tarik_dana: "bg-secondary/20 text-secondary",
  investasi: "bg-primary/20 text-primary",
  streak: "bg-yellow/20 text-yellow-dark",
  point_shop: "bg-pink/20 text-pink-dark",
};

const VALID_FILTERS: RiwayatFilter[] = ["semua", "tugas", "tarik_dana", "investasi", "streak", "point_shop"];

export default async function ChildRiwayatPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const session = await requireChild(params.id);
  if (!session) redirect("/");

  const filter: RiwayatFilter = VALID_FILTERS.includes(searchParams.filter as RiwayatFilter)
    ? (searchParams.filter as RiwayatFilter)
    : "semua";

  const items = await getChildRiwayat(params.id, filter);

  return (
    <DashboardGrid>
      <DashboardAside>
        <SectionCard title="Filter" icon="🗂️">
          <RiwayatFilterChips active={filter} />
        </SectionCard>
      </DashboardAside>

      <DashboardMain>
        <SectionCard title="Riwayat" icon="📜">
          {items.length === 0 ? (
            <EmptyState icon="🗒️" title="Belum ada riwayat." description="Aktivitasmu akan tercatat di sini." />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {items.map((item) => (
                <div key={item.id} className="glass-panel flex items-center justify-between gap-2 rounded-2xl p-3 shadow-card sm:p-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl",
                        CATEGORY_COLOR[item.category]
                      )}
                    >
                      {CATEGORY_EMOJI[item.category]}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-xs font-extrabold text-ink-1 sm:text-sm">{item.title}</p>
                      {item.note && <p className="truncate text-[11px] text-ink-3">{item.note}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[9px] font-extrabold",
                            CATEGORY_COLOR[item.category]
                          )}
                        >
                          {CATEGORY_LABEL[item.category]}
                        </span>
                        <p className="text-[10px] text-ink-3">{formatDateTime(item.date)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.amountMoney !== null && (
                      <p
                        className={cn(
                          "font-heading text-sm font-extrabold",
                          item.amountMoney >= 0 ? "text-secondary" : "text-destructive"
                        )}
                      >
                        {item.amountMoney >= 0 ? "+" : ""}
                        {formatRupiah(item.amountMoney)}
                      </p>
                    )}
                    {item.amountPoint !== null && (
                      <p
                        className={cn(
                          "font-heading text-xs font-extrabold",
                          item.amountPoint >= 0 ? "text-yellow-dark" : "text-destructive"
                        )}
                      >
                        {item.amountPoint >= 0 ? "+" : ""}
                        {item.amountPoint} ⭐
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </DashboardMain>
    </DashboardGrid>
  );
}
