"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Search } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, EmptyState } from "@/components/finance/ui";
import { EntryRow } from "./entry-row";
import { exportLedgerCsv, getLedger, type LedgerEntry, type LedgerKind, type LedgerResult } from "@/app/actions/riwayat";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_FILTERS: { id: LedgerKind | "all"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "income", label: "Pendapatan" },
  { id: "expense", label: "Pengeluaran" },
  { id: "transfer", label: "Transfer" },
];

const PAGE_SIZE = 25;

/**
 * Daftar transaksi.
 *
 * Cakupan periode bisa dilepas ke "Semua waktu". Ini bukan sekadar kenyamanan:
 * selama daftar terkunci pada bulan yang sedang dilihat, transaksi bertanggal
 * bulan lain (mis. gaji yang sengaja dicatat untuk bulan depan) ikut menambah
 * Saldo Utama tetapi TIDAK PERNAH muncul di layar mana pun — saldonya seolah
 * datang entah dari mana dan catatannya mustahil dihapus. Dengan "Semua waktu",
 * setiap rupiah yang memengaruhi saldo selalu punya baris yang bisa dibuka.
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
  const [scope, setScope] = useState<"bulan" | "semua">("bulan");
  const [entries, setEntries] = useState<LedgerEntry[]>(initial.entries);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);

  // Data awal datang dari server; ganti bulan berarti props baru.
  useEffect(() => {
    setEntries(initial.entries);
    setTotal(initial.total);
    setPage(1);
  }, [initial]);

  const filter = {
    dateFrom: scope === "bulan" ? dateFrom : undefined,
    dateTo: scope === "bulan" ? dateTo : undefined,
    kinds: kind === "all" ? undefined : [kind],
    search: search.trim() || undefined,
    account: account === "all" ? undefined : account,
  };

  const reload = (targetPage = 1, size = PAGE_SIZE) =>
    startTransition(async () => {
      const result = await getLedger({ ...filter, page: 1, pageSize: size * targetPage });
      setEntries(result.entries);
      setTotal(result.total);
    });

  // Filter dijalankan ulang dengan jeda 300ms agar mengetik tidak memicu
  // satu query per huruf.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await getLedger({ ...filter, page: 1, pageSize: PAGE_SIZE });
        setEntries(result.entries);
        setTotal(result.total);
        setPage(1);
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, search, account, scope, dateFrom, dateTo]);

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

  const grouped = groupByDate(entries);
  const hasMore = entries.length < total;

  const onChanged = () => {
    router.refresh();
    reload(page);
  };

  return (
    <div className="space-y-3">
      <Panel className="space-y-3 p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi…"
            aria-label="Cari transaksi"
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="scroll-no-bar flex gap-1.5 overflow-x-auto">
            {KIND_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                className={cn(
                  "tap-target shrink-0 rounded-full px-3.5 text-[13px] font-black transition-all duration-150 active:scale-95",
                  kind === option.id ? "bg-primary text-white shadow-card" : "bg-surface-2 text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="h-11 w-[150px]" aria-label="Filter akun">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua akun</SelectItem>
                <SelectItem value="main">Saldo Utama</SelectItem>
                {options.pockets.map((pocket) => (
                  <SelectItem key={pocket.id} value={pocket.id}>
                    {pocket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={exportCsv}
              disabled={isPending || total === 0}
              aria-label="Export CSV"
              className="tap-target grid shrink-0 place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-all duration-150 active:scale-95 active:bg-surface-2 disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="radiogroup"
            aria-label="Cakupan periode"
            className="flex rounded-full bg-surface-2 p-1"
          >
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

          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-3">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {total} transaksi
          </p>
        </div>
      </Panel>

      {grouped.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          text={
            scope === "bulan"
              ? "Tidak ada catatan di bulan ini. Coba pilih “Semua waktu” untuk melihat seluruh riwayat."
              : "Pendapatan, pengeluaran, dan transfer akan muncul di sini setelah dicatat."
          }
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <Panel key={group.date} className="overflow-hidden">
              <p className="bg-surface-2 px-4 py-2 text-[11px] font-black text-ink-3">
                {formatDate(group.date)}
              </p>
              <ul className="divide-y divide-border">
                {group.items.map((entry) => (
                  <EntryRow key={entry.key} entry={entry} pockets={pockets} onChanged={onChanged} />
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

function groupByDate(entries: LedgerEntry[]) {
  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}
