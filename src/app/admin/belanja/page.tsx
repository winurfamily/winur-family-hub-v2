import { getFinanceSummary } from "@/app/actions/keuangan";
import { getShoppingPlans } from "@/app/actions/rencana";
import { BelanjaHub } from "./_components/belanja-hub";

export const dynamic = "force-dynamic";

export default async function BelanjaPage() {
  const [summary, plans] = await Promise.all([getFinanceSummary(), getShoppingPlans()]);

  return <BelanjaHub plans={plans} summary={summary} />;
}
