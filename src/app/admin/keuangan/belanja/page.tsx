import { getFinanceSummary, getShoppingPlans, getShoppingHistory } from "@/app/actions/keuangan";
import { currentMonth } from "@/lib/finance";
import { BelanjaTabs } from "../_components/belanja-tabs";

export default async function BelanjaPage() {
  const month = currentMonth();
  const [summary, plans, history] = await Promise.all([
    getFinanceSummary(),
    getShoppingPlans(),
    getShoppingHistory(month),
  ]);

  return (
    <BelanjaTabs
      pockets={summary?.pockets ?? []}
      plans={plans}
      historyMonth={month}
      historyData={history}
    />
  );
}
