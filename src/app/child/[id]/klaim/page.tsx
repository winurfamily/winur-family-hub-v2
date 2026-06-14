import { redirect } from "next/navigation";
import { getChildKlaim } from "@/app/actions/child-klaim";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WithdrawalForm } from "@/components/child/withdrawal-form";
import { WithdrawalHistoryList } from "@/components/child/withdrawal-history-list";
import { DashboardGrid, DashboardMain, DashboardAside } from "@/components/child/layout/dashboard-grid";
import { SectionCard } from "@/components/child/layout/section-card";
import { StatsCard } from "@/components/child/layout/stats-card";
import { REWARD } from "@/lib/constants";
import { formatRupiah, formatNumber } from "@/lib/format";

export default async function ChildKlaimPage({ params }: { params: { id: string } }) {
  const data = await getChildKlaim(params.id);
  if (!data) redirect("/");

  const totalClaimed = data.history
    .filter((h) => h.status === "approved")
    .reduce((sum, h) => sum + h.amount + (h.includeStreakBonus ? h.streakBonusAmount : 0), 0);

  const pendingTotal = data.pendingRequest
    ? data.pendingRequest.amount + (data.pendingRequest.includeStreakBonus ? data.pendingRequest.streakBonusAmount : 0)
    : 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SectionCard title="Klaim Saldo" icon="💰">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatsCard label="Saldo" value={formatRupiah(data.saldo)} icon="🪙" accent="primary" />
          <StatsCard label="Total Diklaim" value={formatRupiah(totalClaimed)} icon="✅" accent="secondary" />
          <StatsCard label="Menunggu" value={formatRupiah(pendingTotal)} icon="⏳" accent="yellow" />
        </div>
      </SectionCard>

      <DashboardGrid>
        <DashboardMain>
          <SectionCard>
            <Tabs defaultValue="tarik">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white/5 p-1">
                <TabsTrigger
                  value="tarik"
                  className="rounded-xl py-2 font-heading text-xs font-extrabold data-[state=active]:bg-accent data-[state=active]:text-white sm:text-sm"
                >
                  Tarik Dana
                </TabsTrigger>
                <TabsTrigger
                  value="riwayat"
                  className="rounded-xl py-2 font-heading text-xs font-extrabold data-[state=active]:bg-accent data-[state=active]:text-white sm:text-sm"
                >
                  Riwayat
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tarik" className="mt-3">
                <WithdrawalForm
                  childId={params.id}
                  saldo={data.saldo}
                  isSunday={data.isSunday}
                  pendingRequest={data.pendingRequest}
                  streakComplete={data.streakComplete}
                  streakBonusClaimed={data.streakBonusClaimed}
                  streakBonusMoney={data.streakBonusMoney}
                  streakBonusPoint={data.streakBonusPoint}
                />
              </TabsContent>
              <TabsContent value="riwayat" className="mt-3">
                <WithdrawalHistoryList history={data.history} />
              </TabsContent>
            </Tabs>
          </SectionCard>
        </DashboardMain>

        <DashboardAside>
          <SectionCard title="Aturan Tarik Dana" icon="📜">
            <ul className="flex flex-col gap-2 text-xs font-bold text-ink-2 sm:text-sm">
              <li className="glass-soft rounded-xl p-2.5">🗓️ Tarik dana hanya bisa diajukan setiap hari Minggu.</li>
              <li className="glass-soft rounded-xl p-2.5">⏳ Permintaan menunggu persetujuan Ayah/Mamah.</li>
              <li className="glass-soft rounded-xl p-2.5">
                🔥 Selesaikan streak 7/7 untuk bonus 🪙 {formatRupiah(REWARD.STREAK_BONUS_MONEY)} + ⭐{" "}
                {formatNumber(REWARD.STREAK_BONUS_POINT)}.
              </li>
            </ul>
          </SectionCard>
        </DashboardAside>
      </DashboardGrid>
    </div>
  );
}
