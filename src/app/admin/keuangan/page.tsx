import { getFinanceSummary, getMonthlyTrend, getTransferHistory } from "@/app/actions/keuangan";
import { getIncomeFilterOptions } from "@/app/actions/pendapatan";
import { getLedger } from "@/app/actions/riwayat";
import { getBudgetOverview } from "@/app/actions/budget";
import { currentMonth, monthRange } from "@/lib/finance";
import { KeuanganHub } from "./_components/keuangan-hub";

export const dynamic = "force-dynamic";

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams?: { bulan?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams?.bulan ?? "") ? searchParams!.bulan! : currentMonth();
  const { start, end } = monthRange(month);

  const [summary, ledger, options, transfers, trend, budget] = await Promise.all([
    getFinanceSummary(),
    getLedger({ page: 1, pageSize: 25, dateFrom: start, dateTo: end }),
    getIncomeFilterOptions(),
    getTransferHistory(1, 10),
    getMonthlyTrend(6, month),
    getBudgetOverview(month),
  ]);

  return (
    <KeuanganHub
      month={month}
      summary={summary}
      ledger={ledger}
      options={options}
      transfers={transfers}
      trend={trend}
      budget={budget}
      dateFrom={start}
      dateTo={end}
    />
  );
}
