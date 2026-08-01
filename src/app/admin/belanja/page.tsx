import { getFinanceSummary } from "@/app/actions/keuangan";
import { getShoppingPlans } from "@/app/actions/rencana";
import { getBudgetOverview } from "@/app/actions/budget";
import { currentMonth } from "@/lib/finance";
import { BelanjaHub } from "./_components/belanja-hub";

export const dynamic = "force-dynamic";

export default async function BelanjaPage() {
  const month = currentMonth();

  // Anggaran kategori Belanja diambil di sini — bukan pintasan ke menu
  // Keuangan, melainkan angka yang memang dibutuhkan SEBELUM belanja: berapa
  // jatah yang tersisa bulan ini.
  const [summary, plans, budget] = await Promise.all([
    getFinanceSummary(),
    getShoppingPlans(),
    getBudgetOverview(month),
  ]);

  return (
    <BelanjaHub
      plans={plans}
      summary={summary}
      belanjaBudget={budget.ready ? budget.belanja : null}
      month={month}
    />
  );
}
