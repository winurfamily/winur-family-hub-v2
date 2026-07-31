import { getFinanceSummary } from "@/app/actions/keuangan";
import { BelanjaSaldoSummary } from "../../_components/belanja-saldo-summary";
import { BelanjaScan } from "../../_components/belanja-scan";

export const dynamic = "force-dynamic";

export default async function BelanjaScanPage() {
  const summary = await getFinanceSummary();

  return (
    <div className="space-y-4">
      <BelanjaSaldoSummary pockets={summary?.pockets ?? []} saldoUtama={summary?.saldoUtama ?? 0} />
      <BelanjaScan pockets={summary?.pockets ?? []} saldoUtama={summary?.saldoUtama ?? 0} />
    </div>
  );
}
