"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { RencanaItemForm } from "./rencana-item-form";
import {
  createShoppingPlan,
  updateShoppingPlan,
  deleteShoppingPlan,
  duplicatePlan,
  setPlanStatus,
  setPlanItemStatus,
  deletePlanItem,
  checkoutPlanItem,
  type PlanView,
  type PlanItemView,
} from "@/app/actions/rencana";
import type { PocketSummary } from "@/app/actions/keuangan";
import type { ShoppingPlanStatus } from "@/lib/supabase/types";
import { formatRupiah, formatDate, formatNumber, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_META: Record<ShoppingPlanStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-2 text-ink-2" },
  active: { label: "Berjalan", className: "bg-info/15 text-info-dark" },
  done: { label: "Selesai", className: "bg-[#256F2A]/12 text-[#256F2A]" },
  cancelled: { label: "Dibatalkan", className: "bg-destructive/10 text-destructive" },
  archived: { label: "Diarsipkan", className: "bg-surface-2 text-ink-3" },
};

export function RencanaView({ plans, pockets }: { plans: PlanView[]; pockets: PocketSummary[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <ClipboardList className="h-5 w-5 text-accent" aria-hidden /> Rencana Belanja
        </h2>
        <PlanFormSheet
          trigger={
            <GameButton variant="primary" size="sm" className="gap-1">
              <Plus className="h-4 w-4" aria-hidden /> Rencana Baru
            </GameButton>
          }
        />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-[20px] bg-card px-5 py-10 text-center shadow-card">
          <p className="font-heading text-base font-black text-ink-1">Belum ada rencana belanja</p>
          <p className="mx-auto mt-1 max-w-xs text-xs font-semibold text-ink-3">
            Susun daftar belanja sebelum berangkat, lalu tandai satu per satu saat sudah dibeli.
          </p>
          <div className="mt-4 flex justify-center">
            <PlanFormSheet
              trigger={
                <GameButton variant="primary" className="gap-1.5">
                  <Plus className="h-4 w-4" aria-hidden /> Buat Rencana Pertama
                </GameButton>
              }
            />
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} pockets={pockets} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlanCard({ plan, pockets }: { plan: PlanView; pockets: PocketSummary[] }) {
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = STATUS_META[plan.status];

  const changeStatus = (status: ShoppingPlanStatus) =>
    startTransition(async () => {
      const result = await setPlanStatus(plan.id, status);
      if (!result.success) toast.error(result.error ?? "Gagal mengubah status.");
      else toast.success("Status rencana diperbarui.");
    });

  const handleDuplicate = () =>
    startTransition(async () => {
      const result = await duplicatePlan(plan.id);
      if (!result.success) toast.error(result.error ?? "Gagal menduplikasi rencana.");
      else toast.success("Rencana diduplikasi sebagai draft.");
    });

  return (
    <article className="space-y-3 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-heading text-base font-black text-ink-1">{plan.name}</h3>
          <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
            {plan.plannedDate ? formatDate(plan.plannedDate) : "Tanpa tanggal"} · {plan.itemCount} barang
          </p>
        </div>
        <Badge className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold", meta.className)}>
          {meta.label}
        </Badge>
      </header>

      {/* Progress + ringkasan estimasi vs aktual */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, plan.progressPercent)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-bold text-ink-3">
            {plan.boughtCount}/{Math.max(0, plan.itemCount - plan.cancelledCount)} selesai
          </span>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-2.5 text-center">
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">Estimasi</dt>
            <dd className="tabular mt-0.5 text-xs font-bold text-ink-1">
              {formatRupiah(plan.totalEstimated)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">Aktual</dt>
            <dd className="tabular mt-0.5 text-xs font-bold text-ink-1">{formatRupiah(plan.totalActual)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">Selisih</dt>
            <dd
              className={cn(
                "tabular mt-0.5 text-xs font-bold",
                plan.totalActual === 0
                  ? "text-ink-3"
                  : plan.variance > 0
                    ? "text-destructive"
                    : "text-[#256F2A]"
              )}
            >
              {plan.totalActual === 0
                ? "—"
                : `${plan.variance > 0 ? "+" : ""}${formatRupiah(plan.variance)}`}
            </dd>
          </div>
        </dl>
      </div>

      {plan.items.length > 0 && (
        <ul className="space-y-2">
          {plan.items.map((item) => (
            <li key={item.id}>
              <PlanItemCard item={item} pockets={pockets} planName={plan.name} />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <RencanaItemForm planId={plan.id} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : (
        <GameButton
          type="button"
          variant="outline"
          block
          onClick={() => setAdding(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" aria-hidden /> Tambah Produk
        </GameButton>
      )}

      {/* Aksi rencana — semua tombol minimal 44px dan tidak berdesakan */}
      <div className="grid grid-cols-2 gap-2 border-t-2 border-border pt-3 sm:grid-cols-4">
        <PlanFormSheet
          plan={plan}
          trigger={
            <button
              type="button"
              className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card text-xs font-extrabold text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Ubah
            </button>
          }
        />

        <button
          type="button"
          onClick={handleDuplicate}
          disabled={isPending}
          className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card text-xs font-extrabold text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden /> Duplikat
        </button>

        <Select
          value={plan.status}
          onValueChange={(v) => changeStatus(v as ShoppingPlanStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="h-11 text-xs font-extrabold" aria-label="Ubah status rencana">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_META) as ShoppingPlanStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ConfirmDialog
          title="Hapus rencana belanja?"
          message={`Rencana "${plan.name}" dan seluruh daftar barangnya akan dihapus permanen. Transaksi belanja yang sudah terlanjur dibuat dari rencana ini tidak ikut terhapus dan saldonya tidak berubah.`}
          successMessage="Rencana dihapus."
          onConfirm={() => deleteShoppingPlan(plan.id)}
          trigger={
            <button
              type="button"
              className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card text-xs font-extrabold text-destructive transition-colors active:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
            </button>
          }
        />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------

function PlanItemCard({
  item,
  pockets,
  planName,
}: {
  item: PlanItemView;
  pockets: PocketSummary[];
  planName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: PlanItemView["status"]) =>
    startTransition(async () => {
      const result = await setPlanItemStatus(item.id, status);
      if (!result.success) toast.error(result.error ?? "Gagal memperbarui barang.");
    });

  if (editing) {
    return (
      <RencanaItemForm
        planId=""
        item={item}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const isBought = item.status === "bought";
  const isCancelled = item.status === "cancelled";

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3",
        isBought ? "border-[#256F2A]/25 bg-[#256F2A]/5" : isCancelled ? "border-border bg-surface-2" : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
            isBought ? "border-[#256F2A] bg-[#256F2A] text-white" : "border-border bg-card"
          )}
        >
          {isBought && <CheckCircle2 className="h-3.5 w-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "break-words text-[13px] font-extrabold",
              isCancelled ? "text-ink-3 line-through" : "text-ink-1"
            )}
          >
            {item.name}
          </p>
          <p className="tabular mt-0.5 text-[11px] font-semibold text-ink-3">
            {formatNumber(item.qty)} × {formatRupiah(item.estimatedPrice)}
            {item.actualPrice !== null && ` · aktual ${formatRupiah(item.actualPrice)}`}
          </p>
        </div>

        <p className="tabular shrink-0 text-[13px] font-extrabold text-ink-1">
          {formatRupiah(isBought ? item.actualSubtotal : item.estimatedSubtotal)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {!isBought && !isCancelled && (
          <CheckoutSheet item={item} pockets={pockets} planName={planName} />
        )}

        {isBought && (
          <button
            type="button"
            onClick={() => setStatus("pending")}
            disabled={isPending}
            className="tap-target flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-ink-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Belum dibeli
          </button>
        )}

        {!isBought && (
          <button
            type="button"
            onClick={() => setStatus(isCancelled ? "pending" : "cancelled")}
            disabled={isPending}
            className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-ink-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isCancelled ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Aktifkan
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5" aria-hidden /> Batalkan
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Ubah ${item.name}`}
          className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card px-3 text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>

        <ConfirmDialog
          title="Hapus barang ini?"
          message={`"${item.name}" akan dihapus dari rencana belanja. Transaksi belanja yang sudah dibuat dari barang ini tidak ikut terhapus.`}
          successMessage="Barang dihapus."
          onConfirm={() => deletePlanItem(item.id)}
          trigger={
            <button
              type="button"
              aria-label={`Hapus ${item.name}`}
              className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card px-3 text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Tandai sudah dibeli: masukkan harga aktual + sumber dana → jadi transaksi. */
function CheckoutSheet({
  item,
  pockets,
  planName,
}: {
  item: PlanItemView;
  pockets: PocketSummary[];
  planName: string;
}) {
  const [open, setOpen] = useState(false);
  const [actualPrice, setActualPrice] = useState(item.estimatedPrice);
  const [source, setSource] = useState("main");
  const [merchant, setMerchant] = useState(planName);
  const [date, setDate] = useState(todayISODate());
  const [isPending, startTransition] = useTransition();

  const handleCheckout = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await checkoutPlanItem({
        itemId: item.id,
        actualPrice,
        source,
        date,
        merchant,
        clientToken: crypto.randomUUID(),
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal mencatat pembelian.");
        return;
      }
      toast.success("Barang ditandai dibeli & tercatat sebagai belanja.");
      setOpen(false);
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>
        <button
          type="button"
          className="tap-target flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-extrabold text-secondary-foreground shadow-btn-secondary transition-transform active:translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ShoppingBag className="h-3.5 w-3.5" aria-hidden /> Sudah dibeli
        </button>
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title="Tandai sudah dibeli"
        description={`${item.name} · ${formatNumber(item.qty)} pcs`}
      >
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor={`actual-${item.id}`}>Harga aktual per satuan</Label>
            <CurrencyInput
              id={`actual-${item.id}`}
              value={actualPrice}
              onValueChange={setActualPrice}
              disabled={isPending}
            />
            <p className="tabular text-[11px] font-semibold text-ink-3">
              Total {formatRupiah(Math.round(item.qty * actualPrice))}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`merchant-${item.id}`}>Nama toko</Label>
            <Input
              id={`merchant-${item.id}`}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              maxLength={80}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`source-${item.id}`}>Sumber dana</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id={`source-${item.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Saldo Utama</SelectItem>
                  {pockets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`date-${item.id}`}>Tanggal</Label>
              <Input
                id={`date-${item.id}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <GameButton type="button" variant="secondary" block disabled={isPending} onClick={handleCheckout}>
            {isPending ? "Memproses…" : "Catat sebagai Belanja"}
          </GameButton>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

// ---------------------------------------------------------------------------

function PlanFormSheet({ trigger, plan }: { trigger: React.ReactNode; plan?: PlanView }) {
  const isEdit = Boolean(plan);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [plannedDate, setPlannedDate] = useState(plan?.plannedDate ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (!name.trim()) return setError("Nama rencana wajib diisi.");
    setError(null);

    startTransition(async () => {
      const payload = { name: name.trim(), plannedDate: plannedDate || undefined, note: note || undefined };
      const result = isEdit ? await updateShoppingPlan(plan!.id, payload) : await createShoppingPlan(payload);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan rencana.");
        setError(result.error ?? null);
        return;
      }

      toast.success(isEdit ? "Rencana diperbarui." : "Rencana dibuat.");
      if (!isEdit) {
        setName("");
        setPlannedDate("");
        setNote("");
      }
      setOpen(false);
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>
      <ResponsiveSheetContent title={isEdit ? "Ubah Rencana" : "Rencana Belanja Baru"}>
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Nama rencana</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Contoh: Belanja Bulanan Agustus"
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-date">Tanggal rencana (opsional)</Label>
            <Input
              id="plan-date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-note">Catatan (opsional)</Label>
            <Input
              id="plan-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              disabled={isPending}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <GameButton type="submit" variant="secondary" block disabled={isPending}>
            {isPending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Buat Rencana"}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
