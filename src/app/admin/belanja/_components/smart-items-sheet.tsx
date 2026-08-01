"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Star, TrendingDown, TrendingUp } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/finance/ui";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import {
  getShoppingInsights,
  setProductFavorite,
  type ProductSuggestionItem,
  type ShoppingInsights,
} from "@/app/actions/belanja-pintar";
import { addPlanItemsBulk, type PlanItemView } from "@/app/actions/rencana";
import { formatMonthLabel, formatRupiah } from "@/lib/format";
import { formatUnitQty, itemKey } from "@/lib/shopping-item";
import { SHOPPING_CATEGORY_EMOJI, type ShoppingCategory } from "@/lib/shopping-category";
import { cn } from "@/lib/utils";

type Tab = "rekomendasi" | "favorit" | "sering";

const TABS: { id: Tab; label: string }[] = [
  { id: "rekomendasi", label: "Rekomendasi" },
  { id: "favorit", label: "Favorit" },
  { id: "sering", label: "Sering dibeli" },
];

/**
 * BARANG PINTAR — favorit, sering dibeli, dan rekomendasi 3 bulan terakhir.
 *
 * Aturan yang menentukan seluruh bentuknya: TIDAK ADA BARANG YANG MASUK
 * DAFTAR TANPA DICENTANG. Panel ini hanya mengusulkan; barangnya baru
 * ditambahkan setelah pengguna memilih dan menekan tombol tambah yang
 * menyebutkan jumlahnya. Daftar belanja yang bertambah sendiri berarti ada
 * barang terbeli tanpa pernah diputuskan — dan itu uang sungguhan.
 *
 * Barang yang SUDAH ADA di rencana ditandai dan tidak bisa dicentang, jadi
 * mustahil menambahkan duplikat lewat panel ini.
 *
 * Datanya baru diambil ketika panel dibuka, lalu disimpan di state — membuka
 * dan menutup berulang kali tidak mengulang query.
 */
export function SmartItemsSheet({
  planId,
  existingItems,
  trigger,
}: {
  planId: string;
  existingItems: PlanItemView[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("rekomendasi");
  const [insights, setInsights] = useState<ShoppingInsights | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!open || insights !== null || loading) return;
    setLoading(true);
    startTransition(async () => {
      try {
        setInsights(await getShoppingInsights());
      } finally {
        setLoading(false);
      }
    });
  }, [open, insights, loading]);

  /** Kunci barang yang sudah ada di rencana — memakai pembanding yang sama
      dengan pengurai tempel daftar, jadi "Beras" dan "beras" dianggap sama. */
  const taken = useMemo(
    () => new Set(existingItems.map((item) => itemKey(item.name, item.unit))),
    [existingItems]
  );

  const list = useMemo(() => {
    if (!insights) return [];
    const source =
      tab === "favorit"
        ? insights.favorites
        : tab === "sering"
          ? insights.frequent
          : insights.recommendations;

    const needle = query.trim().toLowerCase();
    return needle ? source.filter((item) => item.name.toLowerCase().includes(needle)) : source;
  }, [insights, tab, query]);

  const toggle = (item: ProductSuggestionItem) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  };

  const chosen = useMemo(() => {
    if (!insights) return [];
    const all = [...insights.recommendations, ...insights.favorites, ...insights.frequent];
    const seen = new Set<string>();
    return all.filter((item) => {
      if (!selected.has(item.key) || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }, [insights, selected]);

  const add = () => {
    // Penjaga klik ganda: satu panel hanya boleh menambahkan sekali. Setelah
    // berhasil, panel ditutup dan seleksinya dikosongkan.
    if (isPending || savedRef.current || chosen.length === 0) return;
    savedRef.current = true;

    startTransition(async () => {
      const result = await addPlanItemsBulk(
        planId,
        chosen.map((item) => ({
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          estimatedPrice: item.lastPrice,
        }))
      );

      savedRef.current = false;

      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }

      toast.success(`${result.data!.added} barang ditambahkan ke daftar.`);
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  };

  const period =
    insights && insights.sourceMonths.length > 0
      ? `${formatMonthLabel(insights.sourceMonths[0])} – ${formatMonthLabel(
          insights.sourceMonths[insights.sourceMonths.length - 1]
        )}`
      : "";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) {
          setSelected(new Set());
          setQuery("");
        }
      }}
    >
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title="Barang Pintar"
        description="Usulan dari kebiasaan belanja keluarga. Centang yang diperlukan — tidak ada yang ditambahkan otomatis."
      >
        <div className="space-y-3">
          <div className="scroll-no-bar flex gap-1.5 overflow-x-auto">
            {TABS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                aria-pressed={tab === option.id}
                className={cn(
                  "tap-target shrink-0 rounded-full px-3.5 text-[13px] font-black transition-all duration-150 active:scale-95",
                  tab === option.id ? "bg-primary text-white shadow-card" : "bg-surface-2 text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {tab === "rekomendasi" && period && (
            <p className="rounded-xl bg-accent-light px-3 py-2 text-[11px] font-bold text-ink-2">
              Barang yang muncul di minimal dua bulan berbeda dalam periode{" "}
              <strong className="text-ink-1">{period}</strong>.
            </p>
          )}
          {tab === "favorit" && insights && !insights.favoritesReady && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-2">
              Menandai favorit butuh migration 0025 dijalankan lebih dulu. Rekomendasi dan &ldquo;sering
              dibeli&rdquo; tetap berfungsi tanpa itu.
            </p>
          )}

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Saring barang…"
            aria-label="Saring usulan barang"
            disabled={isPending}
          />

          {loading && !insights ? (
            <div className="flex min-h-[140px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              title={
                tab === "favorit"
                  ? "Belum ada barang favorit"
                  : tab === "sering"
                    ? "Belum ada barang yang sering dibeli"
                    : "Belum ada rekomendasi"
              }
              text={
                tab === "favorit"
                  ? "Tandai barang dengan ikon bintang di tab lain agar selalu muncul di sini."
                  : "Selesaikan beberapa belanja dulu. Setelah ada riwayat dua bulan, usulannya muncul otomatis di sini."
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {list.map((item) => (
                <SuggestionRow
                  key={item.key}
                  item={item}
                  checked={selected.has(item.key)}
                  alreadyInPlan={taken.has(itemKey(item.name, item.unit))}
                  disabled={isPending}
                  onToggle={() => toggle(item)}
                  onFavorite={
                    item.productId && insights?.favoritesReady
                      ? async () => {
                          const result = await setProductFavorite(item.productId!, !item.isFavorite);
                          if (!result.success) {
                            toast.error(result.error ?? "Gagal memperbarui favorit.");
                            return;
                          }
                          // Muat ulang agar tab Favorit langsung mencerminkannya.
                          setInsights(null);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}

          <div className="safe-bottom sticky bottom-0 -mx-5 space-y-2 border-t-2 border-border bg-card/95 px-5 pb-1 pt-3 backdrop-blur">
            <GameButton
              type="button"
              variant="primary"
              block
              disabled={isPending || chosen.length === 0}
              onClick={add}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menambahkan…
                </>
              ) : chosen.length === 0 ? (
                "Pilih barang dulu"
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden /> Tambah {chosen.length} Barang
                </>
              )}
            </GameButton>
            <p className="text-center text-[10.5px] font-semibold text-ink-3">
              Menambahkan hanya mengisi daftar. Tidak ada transaksi dan saldo tidak berkurang.
            </p>
          </div>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

function SuggestionRow({
  item,
  checked,
  alreadyInPlan,
  disabled,
  onToggle,
  onFavorite,
}: {
  item: ProductSuggestionItem;
  checked: boolean;
  alreadyInPlan: boolean;
  disabled: boolean;
  onToggle: () => void;
  onFavorite?: () => void | Promise<void>;
}) {
  const TrendIcon = item.trend === "up" ? TrendingUp : item.trend === "down" ? TrendingDown : null;

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-2xl border-2 p-2",
        checked ? "border-primary bg-primary-light" : "border-border bg-card",
        alreadyInPlan && "opacity-60"
      )}
    >
      <button
        type="button"
        disabled={disabled || alreadyInPlan}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={`${checked ? "Batal pilih" : "Pilih"} ${item.name}`}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-transform duration-150 active:scale-90 disabled:opacity-50",
          checked
            ? "border-primary bg-primary text-white"
            : "border-border bg-card text-transparent"
        )}
      >
        <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink-1">
          <span aria-hidden>{SHOPPING_CATEGORY_EMOJI[item.category as ShoppingCategory] ?? "🛒"} </span>
          {item.name}
        </p>
        <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-[11px] font-semibold text-ink-3">
          <span>{formatUnitQty(item.qty, item.unit)}</span>
          {item.lastPrice > 0 && <span>· {formatRupiah(item.lastPrice)}</span>}
          {TrendIcon && item.changePercent !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-black",
                item.trend === "up" ? "text-destructive" : "text-secondary-dark"
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden />
              {Math.abs(item.changePercent)}%
            </span>
          )}
          {alreadyInPlan && <span className="font-black text-primary">· sudah di daftar</span>}
        </p>
      </div>

      {onFavorite && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onFavorite()}
          aria-pressed={item.isFavorite}
          aria-label={`${item.isFavorite ? "Lepas" : "Tandai"} ${item.name} sebagai favorit`}
          className={cn(
            "tap-target grid shrink-0 place-items-center rounded-xl transition-transform duration-150 active:scale-90",
            item.isFavorite ? "text-amber-500" : "text-ink-3"
          )}
        >
          <Star className="h-4 w-4" fill={item.isFavorite ? "currentColor" : "none"} aria-hidden />
        </button>
      )}
    </li>
  );
}
