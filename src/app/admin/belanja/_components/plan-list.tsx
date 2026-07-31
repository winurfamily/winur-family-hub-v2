"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { Panel, EmptyState, ProgressBar } from "@/components/finance/ui";
import { PlanFormSheet } from "./plan-form-sheet";
import { GeneratePlanSheet } from "./generate-plan-sheet";
import { deleteShoppingPlan, duplicatePlan, setPlanStatus, type PlanView } from "@/app/actions/rencana";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Scope = "aktif" | "selesai";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-2 text-ink-3" },
  active: { label: "Aktif", className: "bg-primary-light text-primary" },
  done: { label: "Selesai", className: "bg-secondary-light text-secondary-dark" },
  cancelled: { label: "Dibatalkan", className: "bg-surface-2 text-ink-3" },
  archived: { label: "Arsip", className: "bg-surface-2 text-ink-3" },
};

export function PlanList({ plans }: { plans: PlanView[] }) {
  const [scope, setScope] = useState<Scope>("aktif");

  const aktif = plans.filter((plan) => plan.status === "draft" || plan.status === "active");
  const selesai = plans.filter((plan) => plan.status !== "draft" && plan.status !== "active");
  const shown = scope === "aktif" ? aktif : selesai;

  return (
    <div className="space-y-3">
      {/* Filter dan aksi dipisah baris supaya keduanya tetap lebar-sentuh di
          layar 360px; dari sm ke atas keduanya berbagi satu baris. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {(["aktif", "selesai"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={cn(
                "tap-target rounded-full px-4 text-[13px] font-black transition-colors",
                scope === key ? "bg-primary text-white shadow-card" : "bg-surface-2 text-ink-3"
              )}
            >
              {key === "aktif" ? `Aktif (${aktif.length})` : `Selesai (${selesai.length})`}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <GeneratePlanSheet
            plans={plans}
            trigger={
              <GameButton type="button" variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none">
                <Sparkles className="h-4 w-4" aria-hidden /> Bulan Depan
              </GameButton>
            }
          />
          <PlanFormSheet
            trigger={
              <GameButton type="button" variant="primary" size="sm" className="flex-1 gap-1.5 sm:flex-none">
                <Plus className="h-4 w-4" aria-hidden /> Rencana
              </GameButton>
            }
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={scope === "aktif" ? "Belum ada rencana aktif" : "Belum ada rencana selesai"}
          text={
            scope === "aktif"
              ? "Buat rencana, tempel daftar belanja dari WhatsApp, lalu pakai checklist-nya saat di toko."
              : "Rencana yang sudah diselesaikan akan tersimpan di sini beserta transaksinya."
          }
          action={
            scope === "aktif" ? (
              <PlanFormSheet
                trigger={
                  <GameButton type="button" variant="primary" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" aria-hidden /> Buat Rencana
                  </GameButton>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = STATUS_STYLE[plan.status] ?? STATUS_STYLE.active;
  const remaining = Math.max(0, plan.itemCount - plan.cancelledCount - plan.boughtCount);

  const duplicate = () =>
    startTransition(async () => {
      const result = await duplicatePlan(plan.id);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menduplikasi rencana.");
        return;
      }
      toast.success("Rencana diduplikasi.");
      router.refresh();
    });

  const cancel = () =>
    startTransition(async () => {
      const result = await setPlanStatus(plan.id, "cancelled");
      if (!result.success) {
        toast.error(result.error ?? "Gagal membatalkan rencana.");
        return;
      }
      toast.success("Rencana dibatalkan.");
      router.refresh();
    });

  return (
    <Panel className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
              status.className
            )}
          >
            {status.label}
          </span>
          <h3 className="mt-1.5 break-words font-heading text-[15px] font-black text-ink-1">{plan.name}</h3>
          {plan.plannedDate && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-ink-3">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatDate(plan.plannedDate)}
            </p>
          )}
          {/* Asal rekomendasi ikut terbaca di kartunya, bukan hanya di panel
              pembuatannya, supaya isi daftar tidak terasa muncul entah dari mana. */}
          {plan.note && (
            <p className="mt-1 line-clamp-2 break-words text-[11px] font-semibold text-ink-3">
              {plan.note}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-ink-3">
          <span>
            {plan.boughtCount} dari {Math.max(0, plan.itemCount - plan.cancelledCount)} selesai
          </span>
          <span className="tabular">{plan.progressPercent}%</span>
        </div>
        <ProgressBar percent={plan.progressPercent} tone={plan.status === "done" ? "good" : "primary"} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-2.5">
          <dt className="text-[10px] font-black uppercase text-ink-3">Perkiraan</dt>
          <dd className="tabular mt-0.5 truncate text-[13px] font-black text-ink-1">
            {formatRupiah(plan.totalEstimated)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2.5">
          <dt className="text-[10px] font-black uppercase text-ink-3">
            {plan.status === "done" ? "Dibayar" : "Sisa barang"}
          </dt>
          <dd className="tabular mt-0.5 truncate text-[13px] font-black text-ink-1">
            {plan.status === "done" ? formatRupiah(plan.totalActual) : `${remaining} barang`}
          </dd>
        </div>
      </dl>

      <div className="mt-auto pt-3">
        <GameButton asChild variant="primary" block size="sm" className="gap-1.5">
          <Link href={`/admin/belanja/${plan.id}`}>
            {plan.status === "done" ? (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Lihat Detail
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4" aria-hidden /> Buka Checklist
              </>
            )}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </GameButton>

        <div className="mt-2 flex items-center justify-end gap-1.5">
          <PlanFormSheet
            plan={plan}
            trigger={
              <button
                type="button"
                aria-label={`Ubah rencana ${plan.name}`}
                className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          <button
            type="button"
            disabled={isPending}
            onClick={duplicate}
            aria-label={`Duplikasi rencana ${plan.name}`}
            className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-50"
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
          {plan.status !== "done" && plan.status !== "cancelled" && (
            <button
              type="button"
              disabled={isPending}
              onClick={cancel}
              className="tap-target rounded-xl border-2 border-border bg-card px-3 text-xs font-black text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-50"
            >
              Batalkan
            </button>
          )}
          <ConfirmDialog
            title="Hapus rencana?"
            message={`Rencana "${plan.name}" beserta daftar barangnya dihapus permanen. Transaksi belanja yang sudah terlanjur dibuat TIDAK ikut terhapus dan saldo tidak berubah.`}
            successMessage="Rencana dihapus."
            onConfirm={() => deleteShoppingPlan(plan.id)}
            onDone={() => router.refresh()}
            trigger={
              <button
                type="button"
                aria-label={`Hapus rencana ${plan.name}`}
                className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-destructive transition-colors active:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            }
          />
        </div>
      </div>
    </Panel>
  );
}
