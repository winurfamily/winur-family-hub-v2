"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, Minus, Plus, Trash2, Undo2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Panel, ProgressBar, EmptyState } from "@/components/finance/ui";
import { PasteListSheet } from "../../_components/paste-list-sheet";
import { CompleteSheet } from "./complete-sheet";
import {
  addPlanItem,
  deletePlanItem,
  setPlanItemQty,
  setPlanItemStatus,
  type PlanItemView,
  type PlanView,
} from "@/app/actions/rencana";
import type { FinanceSummary } from "@/app/actions/keuangan";
import type { ShoppingPlanItemStatus } from "@/lib/supabase/types";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "semua" | "belum" | "sudah";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "belum", label: "Belum dibeli" },
  { id: "sudah", label: "Sudah dibeli" },
];

/**
 * Checklist belanja gaya aplikasi Notes/Reminders.
 *
 * Prinsip yang menentukan bentuknya: dipakai satu tangan sambil mendorong
 * troli. Karena itu satu barang = SATU BARIS ringkas (bukan kartu besar),
 * kotak centangnya lebar 48px di kiri, dan barang yang selesai dicoret lalu
 * turun ke bawah sendiri.
 *
 * Perubahan status ditampilkan optimistik (useOptimistic) sehingga mencentang
 * terasa seketika dan hanya baris itu yang berubah — tidak ada render ulang
 * seluruh halaman menunggu server.
 *
 * Tambah-barang dan "Selesaikan Belanja" hidup di satu bilah yang menempel di
 * bawah layar HP: dua aksi itu dipakai justru ketika daftarnya sudah panjang,
 * jadi menaruhnya di bawah daftar berarti harus menggulir seluruh troli dulu.
 * Di layar lebar bilah yang sama menjadi panel samping yang ikut menggantung.
 */
export function ChecklistView({
  plan,
  summary,
}: {
  plan: PlanView;
  summary: FinanceSummary | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("semua");
  const [, startTransition] = useTransition();

  const [items, applyOptimistic] = useOptimistic(
    plan.items,
    (current: PlanItemView[], patch: { id: string; status?: ShoppingPlanItemStatus; qty?: number }) =>
      current.map((item) => (item.id === patch.id ? { ...item, ...patch } : item))
  );

  const counted = items.filter((item) => item.status !== "cancelled");
  const bought = counted.filter((item) => item.status === "bought").length;
  const remaining = counted.length - bought;
  const percent = counted.length > 0 ? Math.round((bought / counted.length) * 100) : 0;
  const locked = plan.status === "done";

  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === "belum") return item.status === "pending";
      if (filter === "sudah") return item.status === "bought";
      return true;
    });
    // Barang selesai/dibatalkan turun ke bawah; urutan asli dipertahankan
    // di dalam masing-masing kelompok.
    return filtered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rank = (status: ShoppingPlanItemStatus) =>
          status === "pending" ? 0 : status === "bought" ? 1 : 2;
        const diff = rank(a.item.status) - rank(b.item.status);
        return diff !== 0 ? diff : a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [items, filter]);

  const mutate = (
    patch: { id: string; status?: ShoppingPlanItemStatus; qty?: number },
    run: () => Promise<{ success: boolean; error?: string }>
  ) => {
    startTransition(async () => {
      applyOptimistic(patch);
      const result = await run();
      if (!result.success) toast.error(result.error ?? "Gagal memperbarui checklist.");
      router.refresh();
    });
  };

  const toggle = (item: PlanItemView) => {
    const next: ShoppingPlanItemStatus = item.status === "bought" ? "pending" : "bought";
    mutate({ id: item.id, status: next }, () => setPlanItemStatus(item.id, next));
  };

  const cancel = (item: PlanItemView) => {
    const next: ShoppingPlanItemStatus = item.status === "cancelled" ? "pending" : "cancelled";
    mutate({ id: item.id, status: next }, () => setPlanItemStatus(item.id, next));
  };

  const changeQty = (item: PlanItemView, delta: number) => {
    const next = Math.max(1, Number((item.qty + delta).toFixed(2)));
    if (next === item.qty) return;
    mutate({ id: item.id, qty: next }, () => setPlanItemQty(item.id, next));
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
      <div className="min-w-0 space-y-3">
        <Panel className="p-4">
          <Link
            href="/admin/belanja"
            className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-ink-2 transition-transform duration-150 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Semua Rencana
          </Link>

          <h1 className="break-words font-heading text-xl font-black text-ink-1">{plan.name}</h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-3">
            {plan.plannedDate ? formatDate(plan.plannedDate) : "Tanpa tanggal"} · {counted.length} barang
          </p>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-black text-ink-3">
              <span>
                {bought} dari {counted.length} selesai
              </span>
              <span className="tabular">{percent}%</span>
            </div>
            <ProgressBar percent={percent} tone={locked ? "good" : "primary"} />
          </div>

          {!locked && (
            <div className="mt-3">
              <PasteListSheet planId={plan.id} />
            </div>
          )}

          {locked && (
            <p className="mt-3 rounded-xl bg-secondary-light px-3 py-2 text-xs font-bold text-secondary-dark">
              Rencana ini sudah diselesaikan dan transaksinya tercatat di Keuangan.
            </p>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          {/* SENGAJA tidak menggantung. Bilah filter yang ikut menggulir akan
              menutupi kotak centang barang teratas — persis bagian yang paling
              sering ditekan sambil mendorong troli. Filter dipakai sekali di
              awal, jadi cukup berada di kepala daftar. */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2.5 sm:px-4">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={cn(
                  "tap-target rounded-full px-3.5 text-[13px] font-black transition-all duration-150 active:scale-95",
                  filter === option.id ? "bg-primary text-white shadow-card" : "bg-surface-2 text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                title={items.length === 0 ? "Daftar masih kosong" : "Tidak ada barang di filter ini"}
                text={
                  items.length === 0
                    ? "Tempel daftar belanja dari WhatsApp atau tambah barang satu per satu."
                    : "Coba pilih filter lain."
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border px-3 sm:px-4">
              {visible.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  locked={locked}
                  onToggle={() => toggle(item)}
                  onCancel={() => cancel(item)}
                  onQty={(delta) => changeQty(item, delta)}
                  onDelete={() =>
                    startTransition(async () => {
                      const result = await deletePlanItem(item.id);
                      if (!result.success) toast.error(result.error ?? "Gagal menghapus barang.");
                      router.refresh();
                    })
                  }
                />
              ))}
            </ul>
          )}
        </Panel>

        {locked && (
          <Panel className="p-4">
            <h2 className="font-heading text-[15px] font-black text-ink-1">Total dibayar</h2>
            <p className="tabular mt-1 font-mono text-2xl font-black text-ink-1">
              {formatRupiah(plan.totalActual)}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-ink-3">
              Perkiraan awal {formatRupiah(plan.totalEstimated)}
              {plan.variance !== 0 && (
                <>
                  {" · "}
                  <span className={plan.variance > 0 ? "text-destructive" : "text-secondary-dark"}>
                    {plan.variance > 0 ? "+" : "−"}
                    {formatRupiah(Math.abs(plan.variance))}
                  </span>
                </>
              )}
            </p>
          </Panel>
        )}

        {/* Ruang bagi bilah aksi mengambang di HP. */}
        {!locked && <div aria-hidden className="h-[76px] lg:hidden" />}
      </div>

      {/* -------- Bilah aksi: melayang di HP, panel menggantung di desktop -------- */}
      {!locked && (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-[68px] z-40 px-3 pb-[env(safe-area-inset-bottom)]",
            "lg:sticky lg:top-20 lg:z-auto lg:mt-0 lg:px-0 lg:pb-0"
          )}
        >
          <div
            className={cn(
              "pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-[26px] border border-border/70 bg-card/95 p-2 shadow-card-deep backdrop-blur",
              "lg:max-w-none lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-[22px] lg:border-0 lg:bg-card lg:p-4 lg:shadow-card lg:backdrop-blur-none"
            )}
          >
            <QuickAddForm planId={plan.id} />
            <CompleteSheet plan={plan} items={items} summary={summary} remaining={remaining} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Satu baris ringkas — tinggi minimum 56px, kotak centang mudah ditekan. */
function ChecklistRow({
  item,
  locked,
  onToggle,
  onCancel,
  onQty,
  onDelete,
}: {
  item: PlanItemView;
  locked: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onQty: (delta: number) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = item.status === "bought";
  const cancelled = item.status === "cancelled";

  return (
    // scroll-mt menjaga baris tidak berhenti tepat di bawah header yang
    // menempel ketika digulir ke posisinya.
    <li className="scroll-mt-[76px]">
      <div className="flex items-center gap-2 py-1">
        <button
          type="button"
          disabled={locked || cancelled}
          onClick={onToggle}
          aria-pressed={done}
          aria-label={`${done ? "Batal tandai" : "Tandai sudah dibeli"}: ${item.name}`}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2",
            "transition-[transform,background-color,border-color] duration-150 ease-out",
            "active:scale-90 disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            done
              ? "border-secondary-dark bg-secondary text-white"
              : "border-border bg-card text-transparent active:bg-primary-light"
          )}
        >
          <Check className="h-6 w-6" strokeWidth={3} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-xl py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p
            className={cn(
              "truncate text-[15px] font-bold transition-colors duration-200",
              done && "text-ink-3 line-through",
              cancelled && "text-ink-3 line-through opacity-60"
            )}
          >
            {item.name}
          </p>
          <p className="tabular truncate text-[11px] font-semibold text-ink-3">
            {formatQty(item.qty)}
            {item.unit ? ` ${item.unit}` : ""}
            {item.estimatedPrice > 0 && ` · ${formatRupiah(item.estimatedPrice)}`}
            {cancelled && " · tidak jadi dibeli"}
          </p>
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={onCancel}
          aria-label={cancelled ? `Kembalikan ${item.name}` : `Tandai ${item.name} tidak jadi dibeli`}
          className="tap-target grid shrink-0 place-items-center rounded-xl text-ink-3 transition-all duration-150 active:scale-90 active:bg-surface-2 disabled:opacity-40"
        >
          {cancelled ? <Undo2 className="h-5 w-5" aria-hidden /> : <X className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {expanded && !locked && (
        <div className="flex items-center gap-2 pb-3 pl-14 pr-1">
          <span className="text-[11px] font-black uppercase text-ink-3">Jumlah</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onQty(-1)}
              aria-label={`Kurangi jumlah ${item.name}`}
              className="tap-target grid place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-transform duration-150 active:scale-90 active:bg-surface-2"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="tabular w-12 text-center text-sm font-black text-ink-1">
              {formatQty(item.qty)}
            </span>
            <button
              type="button"
              onClick={() => onQty(1)}
              aria-label={`Tambah jumlah ${item.name}`}
              className="tap-target grid place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-transform duration-150 active:scale-90 active:bg-surface-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Hapus ${item.name} dari daftar`}
            className="tap-target ml-auto grid place-items-center rounded-xl text-destructive transition-transform duration-150 active:scale-90 active:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

/** Tambah barang mendadak saat sudah berada di toko. */
function QuickAddForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || isPending) return;

    startTransition(async () => {
      const result = await addPlanItem(planId, { name: value, qty: 1, estimatedPrice: 0 });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }
      setName("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-1.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        autoComplete="off"
        placeholder="Barang mendadak…"
        aria-label="Nama barang baru"
        disabled={isPending}
        className="min-w-0"
      />
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        aria-label="Tambah barang"
        className="tap-target grid shrink-0 place-items-center rounded-xl bg-secondary text-white transition-transform duration-150 active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, "");
}
