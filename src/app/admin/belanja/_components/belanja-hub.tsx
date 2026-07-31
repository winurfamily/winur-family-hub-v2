"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Camera, ClipboardList, Loader2, ShoppingBag } from "lucide-react";
import { Panel, SegmentTabs, StatTile } from "@/components/finance/ui";
import { PlanList } from "./plan-list";
import { ShoppingForm } from "./shopping-form";
import type { PlanView } from "@/app/actions/rencana";
import type { FinanceSummary } from "@/app/actions/keuangan";

/**
 * Scan AI membawa serta kompresi gambar dan layar review; komponennya baru
 * diunduh ketika tab Scan benar-benar dibuka.
 */
const BelanjaScan = dynamic(() => import("./belanja-scan").then((m) => m.BelanjaScan), {
  ssr: false,
  loading: () => (
    <Panel className="flex min-h-[200px] items-center justify-center p-6 text-ink-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
    </Panel>
  ),
});

type Tab = "rencana" | "manual" | "scan";

const TABS = [
  { id: "rencana" as const, label: "Rencana", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "manual" as const, label: "Manual", icon: <ShoppingBag className="h-4 w-4" /> },
  { id: "scan" as const, label: "Scan Struk", icon: <Camera className="h-4 w-4" /> },
];

/**
 * Satu-satunya rumah bagi seluruh fungsi belanja keluarga.
 *
 * Checklist dan penyelesaian belanja hidup di halaman rencana
 * (`/admin/belanja/<id>`) supaya layar toko benar-benar fokus — bukan tab
 * lain yang harus dicari sambil mendorong troli.
 */
export function BelanjaHub({
  plans,
  summary,
}: {
  plans: PlanView[];
  summary: FinanceSummary | null;
}) {
  const [tab, setTab] = useState<Tab>("rencana");
  const pockets = summary?.pockets ?? [];
  const saldoUtama = summary?.saldoUtama ?? 0;

  const aktif = plans.filter((plan) => plan.status === "draft" || plan.status === "active");
  const barangTersisa = aktif.reduce(
    (acc, plan) => acc + Math.max(0, plan.itemCount - plan.cancelledCount - plan.boughtCount),
    0
  );

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden p-0">
        <div className="bg-rose-hero p-4 text-white sm:p-5">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Dana tersedia</p>
          <p className="tabular mt-1 font-mono text-3xl font-black sm:text-4xl">
            {rupiah(saldoUtama + (summary?.totalPockets ?? 0))}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-white/75">
            Semua belanja tercatat sebagai Pengeluaran kategori Belanja di menu Keuangan.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          <StatTile label="Rencana aktif" value={String(aktif.length)} />
          <StatTile label="Barang tersisa" value={String(barangTersisa)} />
          <StatTile label="Saldo utama" value={saldoUtama} />
        </div>
      </Panel>

      <SegmentTabs tabs={TABS} active={tab} onChange={setTab} className="sm:max-w-lg" />

      {tab === "rencana" && <PlanList plans={plans} />}
      {tab === "manual" && <ShoppingForm pockets={pockets} saldoUtama={saldoUtama} />}
      {tab === "scan" && <BelanjaScan pockets={pockets} saldoUtama={saldoUtama} />}
    </div>
  );
}

function rupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}
