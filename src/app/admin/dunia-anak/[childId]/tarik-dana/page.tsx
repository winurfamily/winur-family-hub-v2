import { Wallet } from "lucide-react";
import { getWithdrawalRequests } from "@/app/actions/anak-withdrawal";
import { todayISODate } from "@/lib/format";
import { isSunday } from "@/lib/dunia-anak";
import { WithdrawalList } from "./_components/withdrawal-list";

export default async function ChildTarikDanaPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const requests = await getWithdrawalRequests(childId);
  const sundayToday = isSunday(todayISODate());

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-secondary" /> Tarik Dana & Klaim Mingguan
        </h2>
        <p className="text-sm text-ink-2 mt-1">
          Anak hanya bisa mengajukan tarik dana di hari Minggu. Persetujuan juga hanya bisa dilakukan hari Minggu.
          {!sundayToday && " Hari ini bukan hari Minggu."}
        </p>
      </div>

      <WithdrawalList requests={requests} isSunday={sundayToday} />
    </div>
  );
}
