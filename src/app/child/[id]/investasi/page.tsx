import { redirect } from "next/navigation";
import { getChildInvestments } from "@/app/actions/child-investasi";
import { ActiveInvestmentCard } from "@/components/child/active-investment-card";
import { NewInvestmentForm } from "@/components/child/new-investment-form";
import { DashboardGrid, DashboardMain, DashboardAside } from "@/components/child/layout/dashboard-grid";
import { SectionCard } from "@/components/child/layout/section-card";
import { StatsCard } from "@/components/child/layout/stats-card";
import { EmptyState } from "@/components/child/layout/empty-state";
import { formatRupiah, formatDate } from "@/lib/format";

export default async function InvestasiPage({ params }: { params: { id: string } }) {
  const data = await getChildInvestments(params.id);
  if (!data) redirect("/");

  const activeInvestments = data.investments.filter((i) => i.status === "active");
  const completedInvestments = data.investments.filter((i) => i.status !== "active");
  const totalEstimated = activeInvestments.reduce((sum, i) => sum + i.amount + i.estimatedReturn, 0);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SectionCard title="Investasi" icon="📈">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatsCard icon="🪙" label="Diinvestasikan" value={formatRupiah(data.saldoInvested)} accent="primary" />
          <StatsCard icon="📊" label="Est. Hasil" value={formatRupiah(totalEstimated)} accent="secondary" />
          <StatsCard icon="🌱" label="Investasi Aktif" value={String(activeInvestments.length)} accent="accent" />
        </div>
      </SectionCard>

      <DashboardGrid>
        <DashboardMain>
          {activeInvestments.map((inv) => (
            <ActiveInvestmentCard key={inv.id} investment={inv} />
          ))}

          {!data.hasActive && (
            <NewInvestmentForm
              childId={params.id}
              saldo={data.saldo}
              returnPercent={data.currentReturnPercent}
              quickAmounts={data.quickAmounts}
            />
          )}
        </DashboardMain>

        <DashboardAside>
          <SectionCard title="Riwayat Investasi" icon="📜">
            {completedInvestments.length === 0 ? (
              <EmptyState icon="🌱" title="Belum ada riwayat investasi." description="Investasi yang sudah selesai akan muncul di sini." />
            ) : (
              <div className="flex flex-col gap-2">
                {completedInvestments.map((inv) => (
                  <div key={inv.id} className="glass-soft rounded-2xl p-3 shadow-card">
                    <div className="flex items-center justify-between">
                      <p className="font-heading text-sm font-extrabold text-ink-1">{formatRupiah(inv.amount)}</p>
                      <span className="rounded-lg bg-secondary/15 px-2 py-0.5 text-[10px] font-extrabold text-secondary">
                        SELESAI
                      </span>
                    </div>
                    <p className="text-xs text-ink-2">
                      {formatDate(inv.startAt)} → {formatDate(inv.endAt)}
                    </p>
                    <p className="text-xs font-bold text-secondary">
                      +{formatRupiah(inv.actualReturn ?? inv.estimatedReturn)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </DashboardAside>
      </DashboardGrid>
    </div>
  );
}
