"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Camera, ClipboardList, Loader2, ShoppingBag } from "lucide-react";
import { Panel, ProgressBar, SegmentTabs, StatTile } from "@/components/finance/ui";
import { PlanList } from "./plan-list";
import { ShoppingForm } from "./shopping-form";
import type { PlanView } from "@/app/actions/rencana";
import type { FinanceSummary } from "@/app/actions/keuangan";
import type { BudgetLine } from "@/app/actions/budget";
import { BUDGET_STATUS_LABELS } from "@/lib/budget-alerts";
import { formatMonthLabel, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  belanjaBudget,
  month,
}: {
  plans: PlanView[];
  summary: FinanceSummary | null;
  /** Anggaran kategori Belanja bulan ini. null = fitur anggaran belum siap. */
  belanjaBudget: BudgetLine | null;
  month: string;
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
            {formatRupiah(saldoUtama + (summary?.totalPockets ?? 0))}
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

      {/* Jatah belanja bulan ini dibaca SEBELUM masuk toko, bukan setelah
          transaksinya jadi. Angka sisa itulah yang menentukan isi troli, jadi
          tempatnya di sini — bukan hanya di tab Anggaran menu Keuangan. */}
      {belanjaBudget && belanjaBudget.amount > 0 && <BelanjaBudgetCard line={belanjaBudget} month={month} />}

      <SegmentTabs tabs={TABS} active={tab} onChange={setTab} className="sm:max-w-lg" />

      {tab === "rencana" && <PlanList plans={plans} />}
      {tab === "manual" && <ShoppingForm pockets={pockets} saldoUtama={saldoUtama} />}
      {tab === "scan" && <BelanjaScan pockets={pockets} saldoUtama={saldoUtama} />}
    </div>
  );
}

function BelanjaBudgetCard({ line, month }: { line: BudgetLine; month: string }) {
  const over = line.remaining < 0;

  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-ink-3">
            Jatah belanja {formatMonthLabel(month)}
          </p>
          <p className="tabular mt-0.5 font-mono text-2xl font-black text-ink-1">
            {over ? `−${formatRupiah(Math.abs(line.remaining))}` : formatRupiah(line.remaining)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
            {over ? "melebihi jatah" : "sisa"} · terpakai {formatRupiah(line.spent)} dari{" "}
            {formatRupiah(line.amount)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
            line.status === "lewat"
              ? "bg-destructive/10 text-destructive"
              : line.status === "hampir"
                ? "bg-amber-100 text-amber-800"
                : line.status === "mendekati"
                  ? "bg-accent-light text-accent"
                  : "bg-secondary-light text-secondary-dark"
          )}
        >
          {BUDGET_STATUS_LABELS[line.status]}
        </span>
      </div>

      <div className="mt-2.5">
        <ProgressBar percent={line.percent} tone={over ? "bad" : "primary"} />
      </div>

      {line.previousSpent > 0 && (
        <p className="mt-1.5 text-[11px] font-semibold text-ink-3">
          Bulan lalu belanja {formatRupiah(line.previousSpent)}
          {line.changePercent !== null && (
            <span className={line.changePercent > 0 ? " text-destructive" : " text-secondary-dark"}>
              {" "}
              ({line.changePercent > 0 ? "+" : ""}
              {line.changePercent}%)
            </span>
          )}
        </p>
      )}
    </Panel>
  );
}
