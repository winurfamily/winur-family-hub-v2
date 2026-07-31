import { getFinanceSummary } from "@/app/actions/keuangan";
import { getShoppingPlans } from "@/app/actions/rencana";
import { RencanaView } from "../../_components/rencana-view";

export const dynamic = "force-dynamic";

export default async function BelanjaRencanaPage() {
  const [summary, plans] = await Promise.all([getFinanceSummary(), getShoppingPlans()]);

  return <RencanaView plans={plans} pockets={summary?.pockets ?? []} />;
}
