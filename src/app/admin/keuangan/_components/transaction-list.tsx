"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Download,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { Panel, EmptyState } from "@/components/finance/ui";
import { IncomeFormSheet } from "./income-form-sheet";
import { deleteIncome, getIncomeDetail } from "@/app/actions/pendapatan";
import { deletePocketTransfer } from "@/app/actions/keuangan";
import { exportLedgerCsv, getLedger, type LedgerEntry, type LedgerKind, type LedgerResult } from "@/app/actions/riwayat";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_FILTERS: { id: LedgerKind | "all"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "income", label: "Pendapatan" },
  { id: "expense", label: "Pengeluaran" },
  { id: "transfer", label: "Transfer" },
];

const PAGE_SIZE = 25;

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
    dateFrom,
    dateTo,
    kinds: kind === "all" ? undefined : [kind],
    search: search.trim() || undefined,
    account: account === "all" ? undefined : account,
  };

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
  }, [kind, search, account, dateFrom, dateTo]);

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
      link.download = `riwayat-${dateFrom}-${dateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });

  const grouped = groupByDate(entries);
  const hasMore = entries.length < total;

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
                  "tap-target shrink-0 rounded-full px-3.5 text-[13px] font-black transition-colors",
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
              className="tap-target grid shrink-0 place-items-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <p className="text-[11px] font-bold text-ink-3">
          {total} transaksi{isPending && " · memuat…"}
        </p>
      </Panel>

      {grouped.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          text="Pendapatan, pengeluaran, dan transfer bulan ini akan muncul di sini."
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
                  <EntryRow
                    key={entry.key}
                    entry={entry}
                    pockets={pockets}
                    onChanged={() => {
                      router.refresh();
                      startTransition(async () => {
                        const result = await getLedger({ ...filter, page: 1, pageSize: PAGE_SIZE * page });
                        setEntries(result.entries);
                        setTotal(result.total);
                      });
                    }}
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

function EntryRow({
  entry,
  pockets,
  onChanged,
}: {
  entry: LedgerEntry;
  pockets: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [income, setIncome] = useState<Awaited<ReturnType<typeof getIncomeDetail>>>(null);
  const [, startTransition] = useTransition();

  const positive = entry.kind === "income";
  const Icon = entry.kind === "income" ? Plus : entry.kind === "transfer" ? ArrowRightLeft : ShoppingBag;

  // Detail pendapatan hanya diambil ketika barisnya benar-benar akan diedit,
  // bukan untuk seluruh daftar sekaligus.
  const loadIncome = () =>
    startTransition(async () => {
      setIncome(await getIncomeDetail(entry.id));
    });

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <span
        aria-hidden
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
          positive ? "bg-secondary-light text-secondary-dark" : "bg-primary-light text-primary"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink-1">{entry.title}</p>
        <p className="truncate text-[11px] font-semibold text-ink-3">
          {entry.account}
          {entry.categoryLabel ? ` · ${entry.categoryLabel}` : ""} · {entry.createdByName}
          {entry.hasReceipt && " · 📎"}
        </p>
      </div>

      <p
        className={cn(
          "tabular shrink-0 text-[14px] font-black",
          positive ? "text-secondary-dark" : entry.kind === "transfer" ? "text-accent" : "text-destructive"
        )}
      >
        {positive ? "+" : entry.kind === "expense" ? "−" : ""}
        {formatRupiah(entry.amount)}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        {entry.kind === "income" && (
          <>
            {income ? (
              <IncomeFormSheet
                pockets={pockets}
                income={income}
                onSaved={onChanged}
                trigger={
                  <button
                    type="button"
                    aria-label={`Ubah pendapatan ${entry.title}`}
                    className="tap-target grid place-items-center rounded-xl text-ink-3 active:bg-surface-2"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                onClick={loadIncome}
                aria-label={`Ubah pendapatan ${entry.title}`}
                className="tap-target grid place-items-center rounded-xl text-ink-3 active:bg-surface-2"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            )}

            <ConfirmDialog
              title="Hapus pendapatan?"
              message={`"${entry.title}" senilai ${formatRupiah(entry.amount)} akan dihapus dan saldo ${entry.account} berkurang kembali sebesar nominal itu.`}
              successMessage="Pendapatan dihapus dan saldo disesuaikan."
              onConfirm={() => deleteIncome(entry.id)}
              onDone={onChanged}
              trigger={
                <button
                  type="button"
                  aria-label={`Hapus pendapatan ${entry.title}`}
                  className="tap-target grid place-items-center rounded-xl text-destructive active:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              }
            />
          </>
        )}

        {entry.kind === "expense" && (
          <Link
            href={`/admin/keuangan/transaksi/${entry.id}`}
            aria-label={`Detail transaksi ${entry.title}`}
            className="tap-target grid place-items-center rounded-xl text-ink-3 active:bg-surface-2"
          >
            <Receipt className="h-4 w-4" aria-hidden />
          </Link>
        )}

        {entry.kind === "transfer" && (
          <ConfirmDialog
            title="Hapus riwayat transfer?"
            message="Hanya catatannya yang hilang. Uang yang sudah berpindah TIDAK dikembalikan — gunakan transfer baru bila ingin memindahkannya kembali."
            successMessage="Riwayat transfer dihapus."
            onConfirm={() => deletePocketTransfer(entry.id)}
            onDone={onChanged}
            trigger={
              <button
                type="button"
                aria-label={`Hapus riwayat transfer ${entry.title}`}
                className="tap-target grid place-items-center rounded-xl text-destructive active:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            }
          />
        )}
      </div>
    </li>
  );
}

function groupByDate(entries: LedgerEntry[]) {
  const map = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    map.set(entry.date, [...(map.get(entry.date) ?? []), entry]);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}
