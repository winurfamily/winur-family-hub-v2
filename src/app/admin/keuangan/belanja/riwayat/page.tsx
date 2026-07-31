import { getShoppingHistory } from "@/app/actions/belanja";
import { currentMonth } from "@/lib/finance";
import { BelanjaRiwayat } from "../../_components/belanja-riwayat";

export const dynamic = "force-dynamic";

export default async function BelanjaRiwayatPage() {
  const month = currentMonth();
  const data = await getShoppingHistory(month);

  return <BelanjaRiwayat initialMonth={month} initialData={data} />;
}
