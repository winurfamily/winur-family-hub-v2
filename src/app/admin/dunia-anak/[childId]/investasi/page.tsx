import { notFound } from "next/navigation";
import { getInvestments } from "@/app/actions/anak-investasi";
import { InvestReturnForm } from "./_components/invest-return-form";
import { InvestmentList } from "./_components/investment-list";

export default async function ChildInvestasiPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const overview = await getInvestments(childId);

  if (!overview) notFound();

  return (
    <div className="space-y-4">
      <InvestReturnForm childId={childId} currentPercent={overview.currentReturnPercent} />
      <div className="space-y-2">
        <h2 className="font-heading font-extrabold text-ink-1">Riwayat Investasi</h2>
        <InvestmentList investments={overview.investments} />
      </div>
    </div>
  );
}
