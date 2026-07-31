import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getStorageOverview } from "@/app/actions/receipts";
import { StorageManager } from "../_components/storage-manager";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  const overview = await getStorageOverview();

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/admin/pengaturan"
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-ink-2"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Pengaturan
        </Link>
        <h1 className="font-heading text-2xl font-black text-ink-1">Penyimpanan Struk</h1>
        <p className="text-sm font-semibold text-ink-2">
          Bukti struk tersimpan di bucket privat dan hanya dibuka lewat signed URL berumur pendek.
        </p>
      </header>

      {overview ? (
        <StorageManager overview={overview} />
      ) : (
        <p className="rounded-[22px] bg-card px-4 py-10 text-center text-sm font-semibold text-ink-2 shadow-card">
          Gagal memuat data penyimpanan.
        </p>
      )}
    </div>
  );
}
