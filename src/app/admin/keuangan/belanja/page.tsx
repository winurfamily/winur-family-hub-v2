import { getFinanceSummary } from "@/app/actions/keuangan";
import { BelanjaSaldoSummary } from "../_components/belanja-saldo-summary";
import { ShoppingForm } from "../_components/shopping-form";

export const dynamic = "force-dynamic";

export default async function BelanjaManualPage() {
  const summary = await getFinanceSummary();

  return (
    <div className="space-y-4">
      <BelanjaSaldoSummary pockets={summary?.pockets ?? []} saldoUtama={summary?.saldoUtama ?? 0} />
      <ShoppingForm pockets={summary?.pockets ?? []} saldoUtama={summary?.saldoUtama ?? 0} />
    </div>
  );
}
