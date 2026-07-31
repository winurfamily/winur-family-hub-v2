"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Eraser, HardDrive, Link2Off, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/finance/confirm-dialog";
import { SegmentedTabs } from "@/components/finance/segmented-nav";
import {
  getStorageFiles,
  deleteReceipts,
  cleanupOrphanReceipts,
  type StorageOverview,
  type StorageFileItem,
} from "@/app/actions/receipts";
import { formatBytes } from "@/lib/image-compress";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m - 1) % 12]} ${year}`;
}

export function StorageManager({ overview }: { overview: StorageOverview }) {
  const [tab, setTab] = useState<"largest" | "orphan">("largest");
  const [files, setFiles] = useState<StorageFileItem[]>(overview.largest);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minKb, setMinKb] = useState("");
  const [isPending, startTransition] = useTransition();

  const warn = overview.usedPercent >= 90 ? "danger" : overview.usedPercent >= 75 ? "warning" : null;

  const reload = (nextTab: "largest" | "orphan" = tab) =>
    startTransition(async () => {
      const rows = await getStorageFiles({
        onlyOrphan: nextTab === "orphan",
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        minBytes: minKb ? Number(minKb) * 1024 : undefined,
        limit: 100,
      });
      setFiles(rows);
      setSelected(new Set());
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleBulkDelete = async () => {
    const result = await deleteReceipts(Array.from(selected));
    if (result.success) {
      setFiles((current) => current.filter((f) => !selected.has(f.id)));
      setSelected(new Set());
    }
    return result;
  };

  return (
    <div className="space-y-4">
      {/* Ringkasan kuota */}
      <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <HardDrive className="h-4 w-4 text-info" aria-hidden /> Penggunaan Storage
        </h2>

        <p className="tabular mt-2 font-mono text-3xl font-bold text-ink-1">
          {formatBytes(overview.totalBytes)}
        </p>
        <p className="text-[11px] font-semibold text-ink-3">
          dari {formatBytes(overview.quotaBytes)}
          {overview.quotaIsEstimate && " (perkiraan — dari konfigurasi STORAGE_QUOTA_MB)"}
        </p>

        <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              warn === "danger" ? "bg-destructive" : warn === "warning" ? "bg-yellow-dark" : "bg-info"
            )}
            style={{ width: `${Math.max(1, Math.min(100, overview.usedPercent))}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] font-bold text-ink-3">
          {overview.usedPercent.toFixed(1)}% terpakai
        </p>

        {warn && (
          <div
            role="status"
            className={cn(
              "mt-3 flex gap-2.5 rounded-2xl border-2 p-3",
              warn === "danger"
                ? "border-destructive/30 bg-destructive/5"
                : "border-yellow-dark/40 bg-yellow/10"
            )}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                warn === "danger" ? "text-destructive" : "text-yellow-dark"
              )}
              aria-hidden
            />
            <p className="text-xs font-semibold text-ink-2">
              {warn === "danger"
                ? "Penyimpanan sudah lebih dari 90% terpakai. Bersihkan file lama atau file lepas."
                : "Penyimpanan sudah lebih dari 75% terpakai. Pertimbangkan membersihkan file lepas."}
            </p>
          </div>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t-2 border-border pt-3 text-center">
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">Jumlah file</dt>
            <dd className="tabular mt-0.5 text-sm font-bold text-ink-1">{overview.fileCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">File lepas</dt>
            <dd className="tabular mt-0.5 text-sm font-bold text-ink-1">{overview.orphanCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase text-ink-3">Ukuran lepas</dt>
            <dd className="tabular mt-0.5 text-sm font-bold text-ink-1">
              {formatBytes(overview.orphanBytes)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Per bulan */}
      {overview.byMonth.length > 0 && (
        <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5">
          <h2 className="mb-3 font-heading text-base font-black text-ink-1">Ukuran per Bulan</h2>
          <ul className="space-y-2">
            {overview.byMonth.slice(0, 12).map((row) => {
              const percent = overview.totalBytes > 0 ? (row.bytes / overview.totalBytes) * 100 : 0;
              return (
                <li key={row.month}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-bold text-ink-2">{monthLabel(row.month)}</span>
                    <span className="tabular font-extrabold text-ink-1">
                      {formatBytes(row.bytes)}
                      <span className="ml-1.5 font-semibold text-ink-3">{row.fileCount} file</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${Math.max(2, percent)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Daftar file */}
      <section className="space-y-3 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <SegmentedTabs
          value={tab}
          onChange={(next) => {
            setTab(next);
            reload(next);
          }}
          options={[
            { value: "largest", label: "File terbesar" },
            { value: "orphan", label: `File lepas (${overview.orphanCount})` },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="storage-from">Dari tanggal</Label>
            <Input id="storage-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storage-to">Sampai tanggal</Label>
            <Input id="storage-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storage-min">Ukuran minimum (KB)</Label>
            <Input
              id="storage-min"
              type="text"
              inputMode="numeric"
              value={minKb}
              onChange={(e) => setMinKb(e.target.value.replace(/\D/g, ""))}
              placeholder="mis. 300"
            />
          </div>
        </div>

        <GameButton type="button" variant="outline" block disabled={isPending} onClick={() => reload()}>
          {isPending ? "Memuat…" : "Terapkan Filter"}
        </GameButton>

        {selected.size > 0 && (
          <ConfirmDialog
            title={`Hapus ${selected.size} file?`}
            message="File yang dipilih akan dihapus permanen dari Supabase Storage beserta catatannya. Transaksi belanja terkait tidak ikut terhapus."
            confirmLabel={`Hapus ${selected.size} file`}
            successMessage="File dihapus."
            onConfirm={handleBulkDelete}
            trigger={
              <GameButton type="button" variant="outline" block className="gap-1.5 text-destructive">
                <Trash2 className="h-4 w-4" aria-hidden /> Hapus {selected.size} file terpilih
              </GameButton>
            }
          />
        )}

        {files.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-8 text-center text-xs font-semibold text-ink-3">
            {tab === "orphan"
              ? "Tidak ada file lepas. Semua struk terhubung ke transaksi."
              : "Belum ada file struk tersimpan."}
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-start gap-3 rounded-2xl border-2 border-border bg-surface-2 p-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggle(file.id)}
                  aria-label={`Pilih file ${file.storagePath.split("/").pop()}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-ink-1">
                    {file.storagePath.split("/").pop()}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
                    {formatBytes(file.fileSize)} · {formatDateTime(file.createdAt)}
                  </p>

                  {file.transactionId ? (
                    <Link
                      href={`/admin/keuangan/transaksi/${file.transactionId}`}
                      className="mt-1.5 inline-flex min-h-11 items-center text-[11px] font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Lihat transaksi: {file.transactionLabel}
                    </Link>
                  ) : (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-yellow/20 px-2 py-0.5 text-[10px] font-extrabold text-yellow-dark">
                      <Link2Off className="h-3 w-3" aria-hidden /> Tidak terhubung transaksi
                    </span>
                  )}
                </div>

                <ConfirmDialog
                  title="Hapus file ini?"
                  message="File akan dihapus permanen dari Supabase Storage. Tindakan ini tidak bisa dibatalkan."
                  successMessage="File dihapus."
                  onConfirm={() => deleteReceipts([file.id])}
                  onDone={() => setFiles((current) => current.filter((f) => f.id !== file.id))}
                  trigger={
                    <button
                      type="button"
                      aria-label="Hapus file"
                      className="tap-target flex shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pembersihan file lepas — selalu lewat konfirmasi, tidak pernah otomatis. */}
      {overview.orphanCount > 0 && (
        <ConfirmDialog
          title="Bersihkan semua file lepas?"
          message={`${overview.orphanCount} file (${formatBytes(overview.orphanBytes)}) tidak terhubung ke transaksi mana pun dan akan dihapus permanen.`}
          confirmLabel="Bersihkan sekarang"
          successMessage="File lepas dibersihkan."
          onConfirm={cleanupOrphanReceipts}
          trigger={
            <GameButton type="button" variant="outline" block className="gap-1.5">
              <Eraser className="h-4 w-4" aria-hidden /> Bersihkan {overview.orphanCount} file lepas
            </GameButton>
          }
        />
      )}
    </div>
  );
}
