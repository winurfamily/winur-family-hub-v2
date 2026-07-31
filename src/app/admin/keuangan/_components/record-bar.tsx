"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
} from "@/components/finance/responsive-sheet";
import { IncomeFormSheet } from "./income-form-sheet";
import { ExpenseFormSheet } from "./expense-form-sheet";
import { TransferForm } from "./transfer-form";
import type { FinanceSummary } from "@/app/actions/keuangan";
import { cn } from "@/lib/utils";

/**
 * Bilah aksi pencatatan — SATU komponen, dua bentuk.
 *
 * Mencatat pendapatan & pengeluaran adalah alasan utama menu ini dibuka, jadi
 * keduanya tidak boleh bersembunyi di balik tombol sekunder atau menu bertingkat:
 *
 *  - < lg : melayang tepat di atas navigasi bawah, di zona ibu jari. Selalu
 *           terlihat berapa pun posisi gulir, jadi mencatat tidak pernah lebih
 *           dari satu ketukan.
 *  - ≥ lg : menyatu sebagai baris tombol di dalam halaman (bukan elemen
 *           mengambang, yang di layar lebar hanya menutupi konten).
 *
 * Transfer tetap ada tapi sengaja berupa tombol ikon yang lebih kecil di
 * samping — tersedia, tanpa menyaingi dua aksi utama. Karena hanya ADA SATU
 * instans komponen ini, tidak mungkin muncul aksi pencatatan ganda.
 */
export function RecordBar({
  pockets,
  saldoUtama,
  pocketOptions,
  onChanged,
}: {
  pockets: FinanceSummary["pockets"];
  saldoUtama: number;
  pocketOptions: { id: string; name: string }[];
  onChanged?: () => void;
}) {
  const [income, setIncome] = useState(false);
  const [expense, setExpense] = useState(false);
  const [transfer, setTransfer] = useState(false);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 px-3 pb-[env(safe-area-inset-bottom)]",
          "bottom-[68px]",
          "lg:static lg:z-auto lg:px-0 lg:pb-0"
        )}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-[26px] border border-border/70 bg-card/95 p-2 shadow-card-deep backdrop-blur",
            "lg:max-w-none lg:justify-start lg:rounded-[22px] lg:border-0 lg:bg-card lg:p-3 lg:shadow-card lg:backdrop-blur-none"
          )}
        >
          <ActionButton
            tone="expense"
            label="Pengeluaran"
            icon={<ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={3} />}
            onClick={() => setExpense(true)}
          />
          <ActionButton
            tone="income"
            label="Pendapatan"
            icon={<ArrowDownLeft className="h-[18px] w-[18px]" strokeWidth={3} />}
            onClick={() => setIncome(true)}
          />
          <button
            type="button"
            onClick={() => setTransfer(true)}
            aria-label="Pindahkan dana antar pocket"
            title="Pindahkan dana"
            className={cn(
              "tap-target grid shrink-0 place-items-center rounded-2xl bg-surface-2 text-accent",
              "transition-transform duration-150 ease-out active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "lg:h-12 lg:w-12 lg:gap-1.5 lg:px-4"
            )}
          >
            <ArrowRightLeft className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Sheet dikendalikan dari sini agar tombolnya tetap satu-satunya pemicu. */}
      <ExpenseFormSheet
        pockets={pockets}
        saldoUtama={saldoUtama}
        open={expense}
        onOpenChange={setExpense}
      />
      <IncomeFormSheet
        pockets={pocketOptions}
        open={income}
        onOpenChange={setIncome}
        onSaved={onChanged}
      />
      <ResponsiveSheet open={transfer} onOpenChange={setTransfer}>
        <ResponsiveSheetContent
          title="Pindahkan Dana"
          description="Memindahkan saldo antar pocket. Bukan pendapatan maupun pengeluaran."
        >
          <TransferForm
            bare
            pockets={pockets}
            saldoUtama={saldoUtama}
            onDone={() => {
              setTransfer(false);
              onChanged?.();
            }}
          />
        </ResponsiveSheetContent>
      </ResponsiveSheet>
    </>
  );
}

function ActionButton({
  tone,
  label,
  icon,
  onClick,
}: {
  tone: "income" | "expense";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[14px] font-black text-white",
        "transition-transform duration-150 ease-out active:scale-[0.96]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "lg:min-h-12 lg:flex-none lg:px-6",
        tone === "expense"
          ? "bg-primary shadow-[0_4px_0_var(--primary-dark)] active:shadow-[0_1px_0_var(--primary-dark)] active:translate-y-[3px]"
          : "bg-secondary shadow-[0_4px_0_var(--secondary-dark)] active:shadow-[0_1px_0_var(--secondary-dark)] active:translate-y-[3px]"
      )}
    >
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
        {icon}
      </span>
      {label}
    </button>
  );
}
