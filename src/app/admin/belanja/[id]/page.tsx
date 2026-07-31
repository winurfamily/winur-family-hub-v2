import { notFound } from "next/navigation";
import { getFinanceSummary } from "@/app/actions/keuangan";
import { getShoppingPlans } from "@/app/actions/rencana";
import { ChecklistView } from "./_components/checklist-view";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const [plans, summary] = await Promise.all([getShoppingPlans(true), getFinanceSummary()]);
  const plan = plans.find((item) => item.id === params.id);

  // getShoppingPlans() sudah memfilter family_id, jadi rencana milik keluarga
  // lain otomatis tidak ditemukan di sini.
  if (!plan) notFound();

  return <ChecklistView plan={plan} summary={summary} />;
}
