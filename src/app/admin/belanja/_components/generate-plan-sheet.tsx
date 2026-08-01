"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ChevronRight, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/finance/ui";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ItemFieldsRow, UnitDatalist, parseQty, type ItemDraft } from "@/components/finance/item-fields";
import {
  createPlanFromTemplate,
  getShoppingSources,
  getSourceItems,
  type PlanTemplateItem,
  type PlanView,
  type ShoppingSource,
} from "@/app/actions/rencana";
import { getShoppingInsights } from "@/app/actions/belanja-pintar";
import { formatDate, formatMonthLabel, formatRupiah } from "@/lib/format";
import { nextMonth, nextMonthDate } from "@/lib/period";
import { MAX_ITEM_NAME_LENGTH, formatQtyValue } from "@/lib/shopping-item";
import { cn } from "@/lib/utils";

interface SourceChoice {
  id: string;
  kind: "plan" | "transaction" | "smart";
  label: string;
  date: string | null;
  total: number;
  itemCount: number;
  items?: PlanTemplateItem[];
}

const SOURCE_BADGE: Record<SourceChoice["kind"], { label: string; className: string }> = {
  smart: { label: "Kebiasaan", className: "bg-accent-light text-accent" },
  plan: { label: "Rencana", className: "bg-primary-light text-primary" },
  transaction: { label: "Transaksi", className: "bg-secondary-light text-secondary-dark" },
};

const newRow = (): ItemDraft => ({
  key: crypto.randomUUID(),
  name: "",
  qty: "1",
  unit: "",
  price: 0,
});

const toRow = (item: PlanTemplateItem): ItemDraft => ({
  key: crypto.randomUUID(),
  name: item.name,
  qty: formatQtyValue(item.qty),
  unit: item.unit,
  price: item.estimatedPrice,
});

/**
 * Buat rencana belanja bulan depan dari belanja bulan sebelumnya.
 *
 * Alurnya dua langkah: pilih sumber → tinjau draft. Draft SELALU ditinjau
 * dulu; menyimpannya hanya membuat satu rencana berstatus draft — tidak ada
 * transaksi yang dibuat dan saldo tidak berkurang sama sekali.
 *
 * Ringan: rencana yang sudah ada dipakai langsung dari props halaman Belanja
 * (nol query), dan riwayat transaksi baru diambil sekali saat panel dibuka,
 * lalu disimpan di state — membuka-tutup panel tidak mengulang query.
 */
export function GeneratePlanSheet({ plans, trigger }: { plans: PlanView[]; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loadingSources, setLoadingSources] = useState(false);
  const savedRef = useRef(false);

  const [transactionSources, setTransactionSources] = useState<ShoppingSource[] | null>(null);
  const [smartSource, setSmartSource] = useState<SourceChoice | null>(null);
  const [chosen, setChosen] = useState<SourceChoice | null>(null);
  const [rows, setRows] = useState<ItemDraft[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetMonth = nextMonth();

  // Rencana lama yang punya barang — sumber tanpa biaya query sama sekali.
  const planSources = useMemo<SourceChoice[]>(
    () =>
      plans
        .filter((plan) => plan.itemCount > 0)
        .slice(0, 12)
        .map((plan) => ({
          id: plan.id,
          kind: "plan" as const,
          label: plan.name,
          date: plan.plannedDate,
          total: plan.totalActual > 0 ? plan.totalActual : plan.totalEstimated,
          itemCount: plan.itemCount - plan.cancelledCount,
          items: plan.items
            .filter((item) => item.status !== "cancelled")
            .map((item) => ({
              name: item.name,
              qty: item.qty,
              unit: item.unit ?? "",
              // Harga terakhir yang benar-benar dibayar lebih berguna sebagai
              // perkiraan bulan depan daripada perkiraan lama.
              estimatedPrice: item.actualPrice ?? item.estimatedPrice,
            })),
        })),
    [plans]
  );

  const estimatedTotal = rows.reduce((acc, row) => acc + Math.round(parseQty(row.qty) * row.price), 0);
  const filled = rows.filter((row) => row.name.trim().length > 0);

  const loadSources = () => {
    if (transactionSources !== null || loadingSources) return;
    setLoadingSources(true);
    startTransition(async () => {
      try {
        // Dua sumber diambil sekaligus saat panel dibuka: riwayat transaksi
        // satuan, dan ringkasan kebiasaan 3 bulan. Yang kedua biasanya
        // pilihan terbaik untuk rencana bulan depan — ia menggabungkan
        // beberapa kali belanja, bukan menyalin satu struk yang kebetulan.
        const [transactions, insights] = await Promise.all([
          getShoppingSources(),
          getShoppingInsights(),
        ]);
        setTransactionSources(transactions);

        if (insights.recommendations.length > 0) {
          setSmartSource({
            id: "smart",
            kind: "smart",
            label: "Barang yang rutin dibeli",
            date: insights.sourceMonths[insights.sourceMonths.length - 1]
              ? `${insights.sourceMonths[insights.sourceMonths.length - 1]}-01`
              : null,
            total: insights.recommendations.reduce(
              (acc, item) => acc + Math.round(item.qty * item.lastPrice),
              0
            ),
            itemCount: insights.recommendations.length,
            items: insights.recommendations.map((item) => ({
              name: item.name,
              qty: item.qty,
              unit: item.unit,
              estimatedPrice: item.lastPrice,
            })),
          });
        }
      } finally {
        setLoadingSources(false);
      }
    });
  };

  const reset = () => {
    setChosen(null);
    setRows([]);
    setName("");
    setDate("");
    setError(null);
    savedRef.current = false;
  };

  const applySource = (source: SourceChoice, items: PlanTemplateItem[]) => {
    setChosen(source);
    setRows(items.map(toRow));
    setName(`Belanja ${formatMonthLabel(targetMonth)}`.slice(0, 60));
    setDate(nextMonthDate(source.date));
    setError(null);
  };

  const choose = (source: SourceChoice) => {
    if (source.items) {
      applySource(source, source.items);
      return;
    }
    startTransition(async () => {
      const items = await getSourceItems(source.id);
      if (items.length === 0) {
        toast.error("Belanja itu tidak punya rincian barang yang bisa disalin.");
        return;
      }
      applySource(source, items);
    });
  };

  const patch = (key: string, next: Partial<ItemDraft>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...next } : row)));

  const save = () => {
    // Penjaga rencana ganda #1 (klien): satu panel hanya boleh menyimpan sekali.
    // Penjaga #2 ada di server — rencana dengan nama & waktu yang sama dalam
    // 10 menit terakhir dikembalikan apa adanya, bukan dibuat ulang.
    if (isPending || savedRef.current || !chosen) return;
    if (filled.length === 0) {
      setError("Tambahkan minimal satu barang.");
      return;
    }
    setError(null);
    savedRef.current = true;

    startTransition(async () => {
      const result = await createPlanFromTemplate({
        name,
        plannedDate: date || undefined,
        sourceLabel: chosen.label,
        sourceMonth: chosen.date?.slice(0, 7),
        items: filled.map((row) => ({
          name: row.name.trim(),
          qty: parseQty(row.qty),
          unit: row.unit,
          estimatedPrice: row.price,
        })),
      });

      if (!result.success || !result.data) {
        savedRef.current = false;
        toast.error(result.error ?? "Gagal membuat rencana.");
        setError(result.error ?? null);
        return;
      }

      toast.success(
        result.data.reused
          ? "Rencana itu sudah dibuat barusan — dibuka saja."
          : `Rencana ${formatMonthLabel(targetMonth)} dibuat dengan ${result.data.added} barang.`
      );
      setOpen(false);
      reset();
      router.push(`/admin/belanja/${result.data.id}`);
    });
  };

  // Kebiasaan lebih dulu: itulah usulan yang paling sering dipakai apa adanya.
  const allSources = [
    ...(smartSource ? [smartSource] : []),
    ...planSources,
    ...(transactionSources ?? []),
  ].filter((source) => source.itemCount > 0);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (next) loadSources();
        else reset();
      }}
    >
      <ResponsiveSheetTrigger asChild>
        {trigger ?? (
          <GameButton type="button" variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="h-4 w-4" aria-hidden /> Bulan Depan
          </GameButton>
        )}
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title={chosen ? "Tinjau Rencana Bulan Depan" : "Buat Rencana Bulan Depan"}
        description={
          chosen
            ? "Periksa dan ubah dulu. Menyimpan hanya membuat daftar rencana — saldo tidak berkurang."
            : `Pilih belanja sebelumnya untuk disalin menjadi rencana ${formatMonthLabel(targetMonth)}.`
        }
      >
        <UnitDatalist />

        {!chosen ? (
          <div className="space-y-2.5">
            {loadingSources && allSources.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center text-ink-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              </div>
            ) : allSources.length === 0 ? (
              <EmptyState
                title="Belum ada belanja untuk disalin"
                text="Selesaikan satu rencana atau catat satu belanja dulu; bulan berikutnya daftarnya bisa dibuat otomatis dari sini."
              />
            ) : (
              <ul className="space-y-2">
                {allSources.map((source) => (
                  <li key={`${source.kind}-${source.id}`}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => choose(source)}
                      className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 text-left transition-transform duration-150 active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-ink-1">{source.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
                          {source.kind === "smart"
                            ? "Muncul di 2–3 bulan terakhir"
                            : source.date
                              ? formatDate(source.date)
                              : "Tanpa tanggal"}{" "}
                          · {source.itemCount} barang
                          {source.total > 0 ? ` · ${formatRupiah(source.total)}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                          SOURCE_BADGE[source.kind].className
                        )}
                      >
                        {SOURCE_BADGE[source.kind].label}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-xl bg-primary-light px-3 py-2 text-[11px] font-bold text-primary">
              Disalin dari <strong>{chosen.label}</strong>
              {chosen.date ? ` · periode ${formatMonthLabel(chosen.date.slice(0, 7))}` : ""}.{" "}
              <button
                type="button"
                onClick={reset}
                className="underline underline-offset-2"
                disabled={isPending}
              >
                Ganti sumber
              </button>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gen-name">Nama rencana</Label>
                <Input
                  id="gen-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gen-date">Tanggal belanja</Label>
                <Input
                  id="gen-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <ul className="space-y-2.5">
              {rows.map((row, index) => (
                <li key={row.key} className="rounded-2xl border-2 border-border bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
                      Barang {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                      aria-label={`Hapus ${row.name || `barang ${index + 1}`}`}
                      className="tap-target flex items-center justify-center rounded-xl text-destructive transition-colors active:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <Input
                    value={row.name}
                    onChange={(e) => patch(row.key, { name: e.target.value })}
                    maxLength={MAX_ITEM_NAME_LENGTH}
                    placeholder="Nama barang"
                    aria-label={`Nama barang ${index + 1}`}
                    disabled={isPending}
                  />
                  <div className="mt-2.5">
                    <ItemFieldsRow
                      index={index}
                      draft={row}
                      disabled={isPending}
                      priceLabel="Perkiraan"
                      onPatch={(next) => patch(row.key, next)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <GameButton
              type="button"
              variant="outline"
              block
              disabled={isPending}
              onClick={() => setRows((current) => [...current, newRow()])}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" aria-hidden /> Tambah Barang
            </GameButton>

            {error && (
              <p role="alert" className="text-sm font-bold text-destructive">
                {error}
              </p>
            )}

            <div className="safe-bottom sticky bottom-0 -mx-5 space-y-2 border-t-2 border-border bg-card/95 px-5 pb-1 pt-3 backdrop-blur">
              <p className="flex items-baseline justify-between text-sm">
                <span className="font-extrabold text-ink-2">Perkiraan total</span>
                <span className="tabular font-black text-ink-1">{formatRupiah(estimatedTotal)}</span>
              </p>
              <GameButton
                type="button"
                variant="primary"
                block
                disabled={isPending || filled.length === 0}
                onClick={save}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
                  </>
                ) : (
                  <>
                    <CalendarPlus className="h-4 w-4" aria-hidden /> Simpan {filled.length} Barang
                  </>
                )}
              </GameButton>
              <p className="text-center text-[10.5px] font-semibold text-ink-3">
                Rencana disimpan sebagai draft. Tidak ada transaksi dan saldo tidak berkurang.
              </p>
            </div>
          </div>
        )}
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
