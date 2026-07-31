"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Download,
  Paperclip,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedTabs } from "@/components/finance/segmented-nav";
import {
  getLedger,
  exportLedgerCsv,
  type LedgerEntry,
  type LedgerKind,
  type LedgerResult,
} from "@/app/actions/riwayat";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
} from "@/lib/supabase/types";
import { formatRupiah, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KIND_STYLE: Record<
  LedgerKind,
  { label: string; sign: string; icon: React.ReactNode; chip: string; amount: string; href?: (id: string) => string }
> = {
  income: {
    label: "Pendapatan",
    sign: "+",
    icon: <TrendingUp className="h-4 w-4" aria-hidden />,
    chip: "bg-[#256F2A]/10 text-[#256F2A]",
    amount: "text-[#256F2A]",
  },
  expense: {
    label: "Pengeluaran",
    sign: "−",
    icon: <ShoppingCart className="h-4 w-4" aria-hidden />,
    chip: "bg-[#F79009]/15 text-[#B45309]",
    amount: "text-[#B45309]",
    href: (id) => `/admin/keuangan/belanja/${id}`,
  },
  transfer: {
    label: "Transfer",
    sign: "",
    icon: <ArrowRightLeft className="h-4 w-4" aria-hidden />,
    chip: "bg-[#6D28D9]/10 text-[#6D28D9]",
    amount: "text-[#6D28D9]",
  },
};

type KindFilter = "all" | LedgerKind;

export function LedgerView({
  initial,
  options,
}: {
  initial: LedgerResult;
  options: { pockets: { id: string; name: string }[]; creators: { id: string; name: string }[] };
}) {
  const [result, setResult] = useState(initial);
  const [items, setItems] = useState<LedgerEntry[]>(initial.entries);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("all");
  const [account, setAccount] = useState("all");
  const [createdBy, setCreatedBy] = useState("all");

  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      kinds: kind === "all" ? undefined : [kind],
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      category: category === "all" ? undefined : category,
      account: account === "all" ? undefined : account,
      createdBy: createdBy === "all" ? undefined : createdBy,
      pageSize: 25,
    }),
    [search, kind, dateFrom, dateTo, category, account, createdBy]
  );

  const load = (targetPage: number, append: boolean) => {
    startTransition(async () => {
      const next = await getLedger({ ...filter, page: targetPage });
      setResult(next);
      setItems((current) => (append ? [...current, ...next.entries] : next.entries));
      setPage(targetPage);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => load(1, false), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportLedgerCsv(filter);
      if (!csv) {
        toast.error("Tidak ada data untuk diekspor.");
        return;
      }
      // BOM agar Excel di Windows membaca UTF-8 dengan benar.
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `riwayat-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Riwayat diekspor.");
    } finally {
      setExporting(false);
    }
  };

  const hasMore = items.length < result.total;

  return (
    <div className="space-y-3">
      <SegmentedTabs
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: "Semua" },
          { value: "income", label: "Pendapatan" },
          { value: "expense", label: "Pengeluaran" },
          { value: "transfer", label: "Transfer" },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi…"
            aria-label="Cari transaksi"
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3.5 font-heading text-sm font-extrabold text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filter
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || result.total === 0}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card px-3.5 font-heading text-sm font-extrabold text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
          >
            <Download className="h-4 w-4" aria-hidden /> {exporting ? "…" : "CSV"}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-[18px] bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ledger-from">Dari tanggal</Label>
            <Input id="ledger-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger-to">Sampai tanggal</Label>
            <Input id="ledger-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger-category">Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ledger-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {EXPENSE_CATEGORIES.map((key) => (
                  <SelectItem key={`e-${key}`} value={key}>
                    Pengeluaran · {EXPENSE_CATEGORY_LABELS[key]}
                  </SelectItem>
                ))}
                {INCOME_CATEGORIES.map((key) => (
                  <SelectItem key={`i-${key}`} value={key}>
                    Pendapatan · {INCOME_CATEGORY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ledger-account">Akun / pocket</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger id="ledger-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua akun</SelectItem>
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
            <Label htmlFor="ledger-creator">Dibuat oleh</Label>
            <Select value={createdBy} onValueChange={setCreatedBy}>
              <SelectTrigger id="ledger-creator">
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

      {/* Ringkasan periode terfilter */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryChip label="Pendapatan" value={result.totals.income} className="text-[#256F2A]" />
        <SummaryChip label="Pengeluaran" value={result.totals.expense} className="text-[#B45309]" />
        <SummaryChip label="Transfer" value={result.totals.transfer} className="text-[#6D28D9]" />
      </div>

      <p className="text-xs font-bold text-ink-3">{isPending ? "Memuat…" : `${result.total} transaksi`}</p>

      {items.length === 0 && !isPending ? (
        <p className="rounded-[20px] bg-card px-4 py-10 text-center text-xs font-semibold text-ink-3 shadow-card">
          Tidak ada transaksi yang cocok dengan filter ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((entry) => {
            const style = KIND_STYLE[entry.kind];
            const href = style.href?.(entry.id);
            const body = (
              <>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.chip)}>
                  {style.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-extrabold text-ink-1">
                    {entry.title}
                    {entry.hasReceipt && (
                      <Paperclip className="h-3 w-3 shrink-0 text-ink-3" aria-label="Ada bukti struk" />
                    )}
                  </p>
                  {/* Label jenis ditulis, bukan hanya diwarnai. */}
                  <p className="truncate text-[11px] font-semibold text-ink-3">
                    {style.label} · {entry.account}
                    {entry.categoryLabel ? ` · ${entry.categoryLabel}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("tabular text-[13px] font-extrabold", style.amount)}>
                    {style.sign}
                    {formatRupiah(entry.amount)}
                  </p>
                  <p className="text-[10px] font-semibold text-ink-3">{formatDate(entry.date)}</p>
                </div>
              </>
            );

            return (
              <li key={entry.key}>
                {href ? (
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-[18px] bg-card p-3 shadow-card transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-[18px] bg-card p-3 shadow-card">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <GameButton type="button" variant="outline" block disabled={isPending} onClick={() => load(page + 1, true)}>
          {isPending ? "Memuat…" : "Muat lebih banyak"}
        </GameButton>
      )}
    </div>
  );
}

function SummaryChip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-xl bg-card p-2.5 text-center shadow-card">
      <p className="truncate text-[10px] font-extrabold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={cn("tabular mt-0.5 break-words text-xs font-bold", className)}>{formatRupiah(value)}</p>
    </div>
  );
}
