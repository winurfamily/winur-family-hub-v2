"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, SlidersHorizontal, Trash2, TrendingUp } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { IncomeFormSheet } from "./income-form-sheet";
import {
  getIncomeList,
  deleteIncome,
  type IncomeItem,
  type IncomeListResult,
  type IncomeSort,
  type IncomeFilterOptions,
} from "@/app/actions/pendapatan";
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS } from "@/lib/supabase/types";
import { formatRupiah, formatDate } from "@/lib/format";

const SORTS: { value: IncomeSort; label: string }[] = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "amount_desc", label: "Nominal terbesar" },
  { value: "amount_asc", label: "Nominal terkecil" },
];

const PAGE_SIZE = 20;

export function IncomeList({
  initial,
  options,
}: {
  initial: IncomeListResult;
  options: IncomeFilterOptions;
}) {
  const [items, setItems] = useState<IncomeItem[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("all");
  const [pocketId, setPocketId] = useState("all");
  const [createdBy, setCreatedBy] = useState("all");
  const [sort, setSort] = useState<IncomeSort>("newest");

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      month: month || undefined,
      category: category === "all" ? undefined : category,
      pocketId: pocketId === "all" ? undefined : pocketId,
      createdBy: createdBy === "all" ? undefined : createdBy,
      sort,
      pageSize: PAGE_SIZE,
    }),
    [search, month, category, pocketId, createdBy, sort]
  );

  const load = (targetPage: number, append: boolean) => {
    startTransition(async () => {
      const result = await getIncomeList({ ...filter, page: targetPage });
      setItems((current) => (append ? [...current, ...result.items] : result.items));
      setTotal(result.total);
      setPage(targetPage);
    });
  };

  // Pencarian & filter di-debounce agar tidak menembak server tiap ketikan.
  useEffect(() => {
    const timer = setTimeout(() => load(1, false), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const refresh = () => load(1, false);
  const hasMore = items.length < total;
  const activeFilterCount = [month, category !== "all" ? category : "", pocketId !== "all" ? pocketId : "", createdBy !== "all" ? createdBy : ""].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari sumber atau catatan…"
            aria-label="Cari pendapatan"
            className="pl-10"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3.5 font-heading text-sm font-extrabold text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-[18px] bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-month">Bulan</Label>
            <Input id="filter-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-category">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="filter-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {INCOME_CATEGORIES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {INCOME_CATEGORY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-account">Masuk ke</Label>
            <Select value={pocketId} onValueChange={setPocketId}>
              <SelectTrigger id="filter-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua rekening</SelectItem>
                <SelectItem value="main">Saldo Utama</SelectItem>
                {options.pockets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-creator">Dibuat oleh</Label>
            <Select value={createdBy} onValueChange={setCreatedBy}>
              <SelectTrigger id="filter-creator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Siapa saja</SelectItem>
                {options.creators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-ink-3">
          {isPending ? "Memuat…" : `${total} pendapatan`}
        </p>
        <Select value={sort} onValueChange={(v) => setSort(v as IncomeSort)}>
          <SelectTrigger className="h-11 w-auto min-w-[160px] gap-2" aria-label="Urutkan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 && !isPending ? (
        <EmptyState pockets={options.pockets} onSaved={refresh} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <IncomeRow key={item.id} item={item} pockets={options.pockets} onChanged={refresh} />
          ))}
        </ul>
      )}

      {hasMore && (
        <GameButton
          type="button"
          variant="outline"
          block
          disabled={isPending}
          onClick={() => load(page + 1, true)}
        >
          {isPending ? "Memuat…" : "Muat lebih banyak"}
        </GameButton>
      )}
    </div>
  );
}

function IncomeRow({
  item,
  pockets,
  onChanged,
}: {
  item: IncomeItem;
  pockets: { id: string; name: string }[];
  onChanged: () => void;
}) {
  return (
    <li className="rounded-[18px] bg-card p-3.5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#256F2A]/10 text-[#256F2A]"
        >
          <TrendingUp className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink-1">{item.source}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
            {formatDate(item.date)} · {item.pocketName} · {INCOME_CATEGORY_LABELS[item.category]}
          </p>
          {item.note && <p className="mt-1 text-xs font-medium text-ink-2">{item.note}</p>}
          <p className="mt-1 text-[10px] font-semibold text-ink-3">Dicatat oleh {item.createdByName}</p>
        </div>

        <p className="tabular shrink-0 font-heading text-sm font-extrabold text-[#256F2A]">
          +{formatRupiah(item.amount)}
        </p>
      </div>

      <div className="mt-2.5 flex justify-end gap-2 border-t border-border pt-2.5">
        <IncomeFormSheet
          pockets={pockets}
          income={item}
          onSaved={onChanged}
          trigger={
            <button
              type="button"
              aria-label={`Ubah pendapatan ${item.source}`}
              className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Ubah
            </button>
          }
        />
        <ConfirmDialog
          title="Hapus pendapatan?"
          message={`Pendapatan "${item.source}" sebesar ${formatRupiah(item.amount)} akan dihapus, dan saldo ${item.pocketName} akan dikurangi sebesar nominal tersebut.`}
          successMessage="Pendapatan dihapus & saldo disesuaikan."
          onConfirm={() => deleteIncome(item.id)}
          onDone={onChanged}
          trigger={
            <button
              type="button"
              aria-label={`Hapus pendapatan ${item.source}`}
              className="tap-target flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-destructive transition-colors active:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
            </button>
          }
        />
      </div>
    </li>
  );
}

function EmptyState({
  pockets,
  onSaved,
}: {
  pockets: { id: string; name: string }[];
  onSaved: () => void;
}) {
  return (
    <div className="rounded-[20px] bg-card px-5 py-10 text-center shadow-card">
      <p className="font-heading text-base font-black text-ink-1">Belum ada pendapatan</p>
      <p className="mx-auto mt-1 max-w-xs text-xs font-semibold text-ink-3">
        Catat gaji, hasil usaha, atau pemasukan lain agar saldo keluarga selalu akurat.
      </p>
      <div className="mt-4 flex justify-center">
        <IncomeFormSheet
          pockets={pockets}
          onSaved={onSaved}
          trigger={
            <GameButton variant="secondary" className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden /> Tambah Pendapatan
            </GameButton>
          }
        />
      </div>
    </div>
  );
}
