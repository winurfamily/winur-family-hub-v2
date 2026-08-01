"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, EmptyState } from "@/components/finance/ui";
import { EntryRow } from "./entry-row";
import {
  exportLedgerCsv,
  getLedger,
  type LedgerEntry,
  type LedgerKind,
  type LedgerResult,
  type LedgerSort,
} from "@/app/actions/riwayat";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
} from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_FILTERS: { id: LedgerKind | "all"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "expense", label: "Pengeluaran" },
  { id: "income", label: "Pendapatan" },
  { id: "transfer", label: "Transfer" },
  { id: "adjustment", label: "Penyesuaian" },
];

const SORT_OPTIONS: { id: LedgerSort; label: string }[] = [
  { id: "newest", label: "Terbaru" },
  { id: "oldest", label: "Terlama" },
  { id: "largest", label: "Terbesar" },
  { id: "smallest", label: "Terkecil" },
];

const PAGE_SIZE = 25;

/**
 * Daftar & pencarian transaksi.
 *
 * Cakupan periode bisa dilepas ke "Semua waktu". Ini bukan sekadar kenyamanan:
 * selama daftar terkunci pada bulan yang sedang dilihat, transaksi bertanggal
 * bulan lain (mis. gaji yang sengaja dicatat untuk bulan depan) ikut menambah
 * Saldo Utama tetapi TIDAK PERNAH muncul di layar mana pun — saldonya seolah
 * datang entah dari mana dan catatannya mustahil dihapus. Dengan "Semua waktu",
 * setiap rupiah yang memengaruhi saldo selalu punya baris yang bisa dibuka.
 *
 * SATU kotak pencarian, bukan sederet kolom. Server yang mengurai ketikannya:
 * "beras" mencari nama barang di dalam struk, "50rb" menjadi filter nominal,
 * "agustus" menjadi rentang tanggal, "mamah" mencocokkan pencatatnya. Filter
 * lanjutan tetap ada, tetapi DISEMBUNYIKAN di balik satu tombol — pada
 * pemakaian sehari-hari yang dibutuhkan hanya mengetik.
 */
export function TransactionList({
  initial,
  options,
  dateFrom,
  dateTo,
  pockets,
}: {
  initial: LedgerResult;
  options: { pockets: { id: string; name: string }[]; creators: { id: string; name: string }[] };
  dateFrom: string;
  dateTo: string;
  pockets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<LedgerKind | "all">("all");
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [createdBy, setCreatedBy] = useState("all");
  const [sort, setSort] = useState<LedgerSort>("newest");
  const [scope, setScope] = useState<"bulan" | "semua">("bulan");
  const [showFilters, setShowFilters] = useState(false);

  const [entries, setEntries] = useState<LedgerEntry[]>(initial.entries);
  const [total, setTotal] = useState(initial.total);
  const [searchText, setSearchText] = useState(initial.searchText);
  const [hints, setHints] = useState<string[]>(initial.searchHints);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);

  // Data awal datang dari server; ganti bulan berarti props baru.
  useEffect(() => {
    setEntries(initial.entries);
    setTotal(initial.total);
    setSearchText(initial.searchText);
    setHints(initial.searchHints);
    setPage(1);
  }, [initial]);

  const filter = useMemo(
    () => ({
      dateFrom: scope === "bulan" ? dateFrom : undefined,
      dateTo: scope === "bulan" ? dateTo : undefined,
      kinds: kind === "all" ? undefined : [kind],
      search: search.trim() || undefined,
      account: account === "all" ? undefined : account,
      category: category === "all" ? undefined : category,
      createdBy: createdBy === "all" ? undefined : createdBy,
      sort,
    }),
    [scope, dateFrom, dateTo, kind, search, account, category, createdBy, sort]
  );

  const activeFilterCount =
    (account !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) + (createdBy !== "all" ? 1 : 0);

  const apply = (result: LedgerResult) => {
    setEntries(result.entries);
    setTotal(result.total);
    setSearchText(result.searchText);
    setHints(result.searchHints);
  };

  // Filter dijalankan ulang dengan jeda 300ms agar mengetik tidak memicu satu
  // query per huruf — pencarian ini menyentuh lima tabel, jadi jedanya bukan
  // kemewahan.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        apply(await getLedger({ ...filter, page: 1, pageSize: PAGE_SIZE }));
        setPage(1);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [filter]);

  const loadMore = () =>
    startTransition(async () => {
      const next = page + 1;
      const result = await getLedger({ ...filter, page: next, pageSize: PAGE_SIZE });
      setEntries((current) => [...current, ...result.entries]);
      setTotal(result.total);
      setPage(next);
    });

  const exportCsv = () =>
    startTransition(async () => {
      const csv = await exportLedgerCsv(filter);
      if (!csv) {
        toast.error("Tidak ada data untuk diexport.");
        return;
      }
      const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = scope === "bulan" ? `riwayat-${dateFrom}-${dateTo}.csv` : "riwayat-semua.csv";
      link.click();
      URL.revokeObjectURL(url);
    });

  const resetFilters = () => {
    setAccount("all");
    setCategory("all");
    setCreatedBy("all");
  };

  const grouped = useMemo(() => groupByDate(entries, sort), [entries, sort]);
  const hasMore = entries.length < total;

  const onChanged = () => {
    router.refresh();
    startTransition(async () => {
      apply(await getLedger({ ...filter, page: 1, pageSize: PAGE_SIZE * page }));
    });
  };

  return (
    <div className="space-y-3">
      <Panel className="space-y-3 p-3 sm:p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari toko, barang, nominal, bulan…"
            aria-label="Cari transaksi"
            className={cn("pl-10", search && "pr-10")}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Hapus kata kunci"
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Ketikan yang sudah diterjemahkan menjadi filter ditampilkan sebagai
            chip. Tanpa ini, mengetik "50rb" lalu mendapat hasil di luar dugaan
            terasa seperti pencarian yang rusak, bukan pencarian yang pintar. */}
        {hints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-3">Dibaca sebagai:</span>
            {hints.map((hint) => (
              <span
                key={hint}
                className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-black text-accent"
              >
                {hint}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="scroll-no-bar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {KIND_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                aria-pressed={kind === option.id}
                className={cn(
                  "tap-target shrink-0 rounded-full px-3.5 text-[13px] font-black transition-all duration-150 active:scale-95",
                  kind === option.id ? "bg-primary text-white shadow-card" : "bg-surface-2 text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            aria-label="Filter lanjutan"
            className={cn(
              "tap-target relative grid shrink-0 place-items-center rounded-xl border-2 px-3 transition-all duration-150 active:scale-95",
              showFilters || activeFilterCount > 0
                ? "border-primary bg-primary-light text-primary"
                : "border-border bg-card text-ink-2"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-black text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={isPending || total === 0}
            aria-label="Export CSV"
            className="tap-target grid shrink-0 place-items-center rounded-xl border-2 border-border bg-card px-3 text-ink-2 transition-all duration-150 active:scale-95 active:bg-surface-2 disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {showFilters && (
          <div className="grid gap-2 rounded-2xl bg-surface-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <FilterSelect
              label="Sumber dana"
              value={account}
              onChange={setAccount}
              options={[
                { value: "all", label: "Semua akun" },
                { value: "main", label: "Saldo Utama" },
                ...options.pockets.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <FilterSelect
              label="Kategori"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "Semua kategori" },
                ...EXPENSE_CATEGORIES.filter((key) => !(key in EXPENSE_CATEGORY_ALIASES)).map((key) => ({
                  value: key,
                  label: `Pengeluaran · ${EXPENSE_CATEGORY_LABELS[key]}`,
                })),
                ...INCOME_CATEGORIES.map((key) => ({
                  value: key,
                  label: `Pendapatan · ${INCOME_CATEGORY_LABELS[key]}`,
                })),
              ]}
            />
            <FilterSelect
              label="Dicatat oleh"
              value={createdBy}
              onChange={setCreatedBy}
              options={[
                { value: "all", label: "Siapa saja" },
                ...options.creators.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="tap-target justify-self-start rounded-xl px-3 text-[12px] font-black text-primary underline-offset-2 hover:underline sm:col-span-2 lg:col-span-3"
              >
                Bersihkan {activeFilterCount} filter
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Cakupan periode" className="flex rounded-full bg-surface-2 p-1">
            {(
              [
                { id: "bulan", label: "Bulan ini" },
                { id: "semua", label: "Semua waktu" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={scope === option.id}
                onClick={() => setScope(option.id)}
                className={cn(
                  "min-h-9 rounded-full px-3.5 text-[12px] font-black transition-colors duration-150",
                  scope === option.id ? "bg-card text-primary shadow-card" : "text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(value) => setSort(value as LedgerSort)}>
              <SelectTrigger className="h-9 w-[124px] text-[12px]" aria-label="Urutkan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-3">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {total} transaksi
            </p>
          </div>
        </div>
      </Panel>

      {grouped.length === 0 ? (
        <EmptyState
          title={search.trim() ? `Tidak ada hasil untuk "${search.trim()}"` : "Belum ada transaksi"}
          text={
            search.trim()
              ? "Coba kata yang lebih pendek, lepas filter lanjutan, atau pilih “Semua waktu”. Pencarian mencakup nama toko, barang di dalam struk, kategori, catatan, nominal, dan bulan."
              : scope === "bulan"
                ? "Tidak ada catatan di bulan ini. Coba pilih “Semua waktu” untuk melihat seluruh riwayat."
                : "Pendapatan, pengeluaran, transfer, dan penyesuaian akan muncul di sini setelah dicatat."
          }
          action={
            search.trim() || activeFilterCount > 0 ? (
              <GameButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  resetFilters();
                }}
              >
                Bersihkan pencarian
              </GameButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <Panel key={group.date} className="overflow-hidden">
              <p className="bg-surface-2 px-4 py-2 text-[11px] font-black text-ink-3">
                {group.ranked
                  ? sort === "largest"
                    ? "Nominal terbesar lebih dulu"
                    : "Nominal terkecil lebih dulu"
                  : formatDate(group.date)}
              </p>
              <ul className="divide-y divide-border">
                {group.items.map((entry) => (
                  <EntryRow
                    key={entry.key}
                    entry={entry}
                    pockets={pockets}
                    onChanged={onChanged}
                    // Pada urutan peringkat tanggalnya tidak lagi menjadi
                    // judul kelompok, jadi harus ikut di setiap baris.
                    showDate={group.ranked}
                    highlight={searchText}
                  />
                ))}
              </ul>
            </Panel>
          ))}

          {hasMore && (
            <GameButton type="button" variant="outline" block disabled={isPending} onClick={loadMore}>
              {isPending ? "Memuat…" : `Muat ${Math.min(PAGE_SIZE, total - entries.length)} lagi`}
            </GameButton>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Kelompokkan per tanggal — tetapi HANYA saat urutannya kronologis.
 *
 * Pada urutan "terbesar"/"terkecil" pengelompokan tanggal justru merusak
 * maksudnya: hasil terbesar akan terpecah menjadi puluhan kartu satu-baris
 * yang tidak lagi terbaca sebagai peringkat.
 */
function groupByDate(entries: LedgerEntry[], sort: LedgerSort) {
  if (sort === "largest" || sort === "smallest") {
    return entries.length > 0 ? [{ date: entries[0].date, items: entries, ranked: true }] : [];
  }

  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items, ranked: false }));
}
