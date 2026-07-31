import { getFinanceSummary, getTransferHistory } from "@/app/actions/keuangan";
import { getIncomeFilterOptions } from "@/app/actions/pendapatan";
import { getLedger } from "@/app/actions/riwayat";
import { getShoppingHistory } from "@/app/actions/belanja";
import { getShoppingPlans } from "@/app/actions/rencana";
import { currentMonth, monthRange } from "@/lib/finance";
import { ParentFinanceApp } from "./_components/parent-finance-app";

export const dynamic = "force-dynamic";

export default async function KeuanganDashboardPage() {
  const month = currentMonth();
  const { start, end } = monthRange(month);
  const [summary, ledger, options, plans, shoppingHistory, transfers] = await Promise.all([
    getFinanceSummary(),
    getLedger({ page: 1, pageSize: 100, dateFrom: start, dateTo: end }),
    getIncomeFilterOptions(),
    getShoppingPlans(),
    getShoppingHistory(month),
    getTransferHistory(1, 8),
  ]);

  return (
    <ParentFinanceApp
      month={month}
      summary={summary}
      ledger={ledger}
      options={options}
      plans={plans}
      shoppingHistory={shoppingHistory}
      transfers={transfers}
    />
  );
}
