"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Focus,
  Layers,
  Lightbulb,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Panel, ProgressBar, EmptyState } from "@/components/finance/ui";
import { ItemLine } from "@/components/finance/item-line";
import { PasteListSheet } from "../../_components/paste-list-sheet";
import { SmartItemsSheet } from "../../_components/smart-items-sheet";
import { ItemEditSheet } from "./item-edit-sheet";
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
import { formatQtyValue } from "@/lib/shopping-item";
import { groupByCategory, type ShoppingCategory } from "@/lib/shopping-category";
import { parseShoppingLine } from "@/lib/shopping-parser";
import { useWakeLock } from "@/lib/use-wake-lock";
import { cn } from "@/lib/utils";

type Filter = "semua" | "belum" | "sudah" | "batal";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "belum", label: "Belum dibeli" },
  { id: "sudah", label: "Sudah dibeli" },
  { id: "batal", label: "Dibatalkan" },
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
 * seluruh halaman menunggu server. Perubahan itu juga LANGSUNG tersimpan:
 * tidak ada tombol "simpan progres", jadi aplikasi boleh tertutup di tengah
 * belanja tanpa kehilangan centang apa pun.
 *
 * Tiga sakelar di kepala daftar menjawab tiga keluhan nyata di toko:
 *  - KELOMPOK menyusun barang mengikuti rak, bukan urutan pengetikan;
 *  - FOKUS menyisakan barang yang belum dibeli dengan baris besar;
 *  - LAYAR MENYALA mencegah layar mati tiap 30 detik (bila browser mendukung).
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
  const [grouped, setGrouped] = useState(false);
  const [focus, setFocus] = useState(false);
  const [, startTransition] = useTransition();
  const wakeLock = useWakeLock();

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

  // Mode fokus hanya menyisakan yang belum dibeli — filter lain diabaikan
  // selama mode itu aktif, supaya tidak ada dua sakelar yang saling menimpa.
  const effectiveFilter: Filter = focus ? "belum" : filter;

  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      if (effectiveFilter === "belum") return item.status === "pending";
      if (effectiveFilter === "sudah") return item.status === "bought";
      if (effectiveFilter === "batal") return item.status === "cancelled";
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
  }, [items, effectiveFilter]);

  const sections = useMemo(
    () =>
      grouped
        ? groupByCategory(visible, (item) => item.category)
        : [{ key: "semua" as ShoppingCategory, label: "", emoji: "", items: visible }],
    [grouped, visible]
  );

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
            <div className="mt-3 flex flex-wrap gap-2">
              <PasteListSheet planId={plan.id} existingItems={items} />
              <SmartItemsSheet
                planId={plan.id}
                existingItems={items}
                trigger={
                  <button
                    type="button"
                    className="tap-target flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3.5 text-[13px] font-black text-ink-2 transition-transform duration-150 active:scale-95"
                  >
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Barang Pintar
                  </button>
                }
              />
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
          <div className="space-y-2 border-b border-border bg-card px-3 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={focus}
                  onClick={() => setFilter(option.id)}
                  aria-pressed={effectiveFilter === option.id}
                  className={cn(
                    "tap-target rounded-full px-3.5 text-[13px] font-black transition-all duration-150 active:scale-95 disabled:opacity-40",
                    effectiveFilter === option.id
                      ? "bg-primary text-white shadow-card"
                      : "bg-surface-2 text-ink-3"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ModeToggle
                active={grouped}
                onClick={() => setGrouped((value) => !value)}
                icon={<Layers className="h-3.5 w-3.5" aria-hidden />}
                label="Kelompok toko"
                hint="Urutkan barang mengikuti rak toko"
              />
              <ModeToggle
                active={focus}
                onClick={() => setFocus((value) => !value)}
                icon={<Focus className="h-3.5 w-3.5" aria-hidden />}
                label="Mode fokus"
                hint="Baris besar, hanya barang yang belum dibeli"
              />
              {/* Tombol Wake Lock hanya muncul bila browsernya mendukung —
                  menawarkan sesuatu yang pasti gagal lebih buruk daripada
                  tidak menawarkannya sama sekali. */}
              {wakeLock.supported && (
                <ModeToggle
                  active={wakeLock.enabled}
                  onClick={wakeLock.toggle}
                  icon={<Lightbulb className="h-3.5 w-3.5" aria-hidden />}
                  label={wakeLock.enabled && !wakeLock.active ? "Layar menyala…" : "Layar menyala"}
                  hint="Cegah layar mati selama belanja"
                />
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                title={items.length === 0 ? "Daftar masih kosong" : "Tidak ada barang di filter ini"}
                text={
                  items.length === 0
                    ? "Tempel daftar belanja dari WhatsApp, pakai Barang Pintar, atau tambah satu per satu."
                    : "Coba pilih filter lain."
                }
              />
            </div>
          ) : (
            <div className="px-3 sm:px-4">
              {sections.map((section) => (
                <section key={section.key}>
                  {grouped && section.label && (
                    <h2 className="sticky top-0 z-10 -mx-3 bg-surface-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-ink-3 sm:-mx-4 sm:px-4">
                      <span aria-hidden>{section.emoji} </span>
                      {section.label} ({section.items.length})
                    </h2>
                  )}
                  <ul className="divide-y divide-border">
                    {section.items.map((item) => (
                      <ChecklistRow
                        key={item.id}
                        item={item}
                        locked={locked}
                        focus={focus}
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
                </section>
              ))}
            </div>
          )}
        </Panel>

        {locked && <PriceComparison plan={plan} items={items} />}

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

function ModeToggle({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        "flex min-h-9 items-center gap-1.5 rounded-full border-2 px-3 text-[12px] font-black transition-all duration-150 active:scale-95",
        active ? "border-primary bg-primary-light text-primary" : "border-border bg-card text-ink-3"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Perbandingan perkiraan vs harga sebenarnya, per barang.
 *
 * Hanya tampil setelah belanja diselesaikan — sebelum itu "harga aktual" belum
 * ada dan membandingkannya dengan nol hanya menghasilkan angka yang menyesatkan.
 */
function PriceComparison({ plan, items }: { plan: PlanView; items: PlanItemView[] }) {
  const compared = items.filter(
    (item) => item.status === "bought" && item.actualPrice !== null && item.estimatedPrice > 0
  );

  return (
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

      {compared.length > 0 && (
        <>
          <h3 className="mt-4 text-[11px] font-black uppercase tracking-wide text-ink-3">
            Perkiraan vs aktual
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {compared.map((item) => {
              const diff = (item.actualPrice ?? 0) - item.estimatedPrice;
              return (
                <li key={item.id} className="flex items-baseline justify-between gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-1">
                    {item.name}
                  </span>
                  <span className="tabular shrink-0 text-[12px] font-semibold text-ink-3">
                    {formatRupiah(item.estimatedPrice)} → {formatRupiah(item.actualPrice ?? 0)}
                  </span>
                  <span
                    className={cn(
                      "tabular w-[86px] shrink-0 text-right text-[12px] font-black",
                      diff > 0 ? "text-destructive" : diff < 0 ? "text-secondary-dark" : "text-ink-3"
                    )}
                  >
                    {diff === 0 ? "sama" : `${diff > 0 ? "+" : "−"}${formatRupiah(Math.abs(diff))}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

/**
 * Satu baris ringkas.
 *
 * Yang terbaca lebih dulu adalah NAMA barang; jumlah & satuannya duduk sebagai
 * lencana "5 kg" di ujung kanan nama — bukan angka kecil di baris kedua yang
 * mengambang tanpa konteks. Kotak centang 48px tetap di kiri karena itulah
 * satu-satunya tombol yang ditekan berulang kali sambil mendorong troli.
 *
 * Ubah, batalkan, dan hapus SENGAJA tidak ikut tampil di baris: ketiganya
 * jarang dipakai dan hanya mempersempit ruang nama. Menekan barisnya membuka
 * laci berisi pengatur jumlah dan ketiga aksi itu.
 *
 * Pada mode fokus laci itu dinonaktifkan dan barisnya membesar: di depan rak
 * yang dibutuhkan hanya nama, jumlah, dan kotak centang yang mudah dikenai.
 */
function ChecklistRow({
  item,
  locked,
  focus,
  onToggle,
  onCancel,
  onQty,
  onDelete,
}: {
  item: PlanItemView;
  locked: boolean;
  focus: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onQty: (delta: number) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = item.status === "bought";
  const cancelled = item.status === "cancelled";

  const meta = [
    item.estimatedPrice > 0 ? `${formatRupiah(item.estimatedPrice)} / satuan` : null,
    item.estimatedPrice > 0 ? formatRupiah(item.estimatedSubtotal) : null,
    cancelled ? "tidak jadi dibeli" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // scroll-mt menjaga baris tidak berhenti tepat di bawah header yang
    // menempel ketika digulir ke posisinya.
    <li className="scroll-mt-[76px]">
      <div className={cn("flex items-center gap-2 py-1.5", focus && "py-2.5")}>
        <button
          type="button"
          disabled={locked || cancelled}
          onClick={onToggle}
          aria-pressed={done}
          aria-label={`${done ? "Batal tandai" : "Tandai sudah dibeli"}: ${item.name}`}
          className={cn(
            "grid shrink-0 place-items-center rounded-2xl border-2",
            focus ? "h-14 w-14" : "h-12 w-12",
            "transition-[transform,background-color,border-color] duration-150 ease-out",
            "active:scale-90 disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            done
              ? "border-secondary-dark bg-secondary text-white"
              : "border-border bg-card text-transparent active:bg-primary-light"
          )}
        >
          <Check className={focus ? "h-7 w-7" : "h-6 w-6"} strokeWidth={3} aria-hidden />
        </button>

        {focus ? (
          <div className="min-w-0 flex-1 py-1">
            <ItemLine
              name={item.name}
              qty={item.qty}
              unit={item.unit}
              state={done ? "done" : cancelled ? "cancelled" : "default"}
              className="[&_p]:text-[17px]"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={`Pilihan untuk ${item.name}`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl py-1.5 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ItemLine
              className="flex-1"
              name={item.name}
              qty={item.qty}
              unit={item.unit}
              meta={meta || undefined}
              state={done ? "done" : cancelled ? "cancelled" : "default"}
            />
            <ChevronDown
              aria-hidden
              className={cn(
                "h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {expanded && !focus && (
        <div className="flex flex-wrap items-center gap-2 pb-3 pl-14 pr-1">
          {!locked && (
            <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => onQty(-1)}
                aria-label={`Kurangi jumlah ${item.name}`}
                className="grid h-9 w-9 place-items-center rounded-lg bg-card text-ink-2 shadow-sm transition-transform duration-150 active:scale-90"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="tabular min-w-[3rem] text-center text-sm font-black text-ink-1">
                {formatQtyValue(item.qty)}
                {item.unit ? <span className="text-[11px] text-ink-3"> {item.unit}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onQty(1)}
                aria-label={`Tambah jumlah ${item.name}`}
                className="grid h-9 w-9 place-items-center rounded-lg bg-card text-ink-2 shadow-sm transition-transform duration-150 active:scale-90"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {!locked && (
            <ItemEditSheet
              item={item}
              trigger={
                <button
                  type="button"
                  className="tap-target flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-xs font-black text-ink-2 transition-transform duration-150 active:scale-95"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Ubah
                </button>
              }
            />
          )}

          {!locked && (
            <button
              type="button"
              onClick={onCancel}
              className="tap-target flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-xs font-black text-ink-2 transition-transform duration-150 active:scale-95"
            >
              {cancelled ? (
                <>
                  <Undo2 className="h-3.5 w-3.5" aria-hidden /> Kembalikan
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" aria-hidden /> Tidak jadi
                </>
              )}
            </button>
          )}

          {!locked && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Hapus ${item.name} dari daftar`}
              className="tap-target ml-auto grid place-items-center rounded-xl text-destructive transition-transform duration-150 active:scale-90 active:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}

          {locked && (
            <p className="text-[11px] font-semibold text-ink-3">
              Rencana sudah diselesaikan — barang tidak bisa diubah lagi.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Tambah barang mendadak saat sudah berada di toko.
 *
 * Satu kolom saja supaya tetap bisa dipakai satu tangan, tetapi isinya
 * dibaca dengan pengurai yang sama dengan Tempel Daftar: mengetik
 * "Minyak goreng 2 liter" langsung menjadi nama + jumlah + satuan.
 */
function QuickAddForm({ planId }: { planId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseShoppingLine(text);
    if (!parsed || isPending) return;

    startTransition(async () => {
      const result = await addPlanItem(planId, {
        name: parsed.name,
        qty: parsed.qty,
        unit: parsed.unit,
        estimatedPrice: parsed.price,
      });
      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }
      setText("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={100}
        autoComplete="off"
        placeholder="Mis. Telur 1 kg"
        aria-label="Barang baru — nama, jumlah, dan satuan"
        disabled={isPending}
        className="min-w-0"
      />
      <button
        type="submit"
        disabled={isPending || !text.trim()}
        aria-label="Tambah barang"
        className="tap-target grid shrink-0 place-items-center rounded-xl bg-secondary text-white transition-transform duration-150 active:scale-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}
