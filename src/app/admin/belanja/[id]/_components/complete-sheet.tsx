"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput, QtyInput } from "@/components/finance/currency-input";
import { Panel } from "@/components/finance/ui";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ReceiptUploader, type AttachedReceipt } from "../../_components/receipt-uploader";
import { completeShoppingPlan, type PlanItemView, type PlanView } from "@/app/actions/rencana";
import type { FinanceSummary } from "@/app/actions/keuangan";
import { formatRupiah, todayISODate } from "@/lib/format";

interface ExtraRow {
  key: string;
  name: string;
  qty: number;
  price: number;
}

const newExtra = (): ExtraRow => ({ key: crypto.randomUUID(), name: "", qty: 1, price: 0 });

/**
 * Penyelesaian belanja: satu layar untuk total yang dibayar, toko, tanggal,
 * sumber dana, catatan, struk, dan barang tambahan.
 *
 * Menyimpan menghasilkan TEPAT SATU transaksi Pengeluaran kategori Belanja.
 * Ada dua penjaga transaksi ganda: tombol dikunci selama proses berjalan, dan
 * `clientToken` idempotency dikirim ke RPC — mengirim ulang token yang sama
 * mengembalikan transaksi yang sudah ada, bukan membuat yang kedua.
 */
export function CompleteSheet({
  plan,
  items,
  summary,
  remaining = 0,
}: {
  plan: PlanView;
  items: PlanItemView[];
  summary: FinanceSummary | null;
  /** Barang yang belum dicentang — dipakai untuk peringatan halus. */
  remaining?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  const pockets = summary?.pockets ?? [];
  const saldoUtama = summary?.saldoUtama ?? 0;

  const [merchant, setMerchant] = useState(plan.name);
  const [date, setDate] = useState(plan.plannedDate ?? todayISODate());
  const [source, setSource] = useState("main");
  const [note, setNote] = useState("");
  const [totalPaid, setTotalPaid] = useState(0);
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [receipt, setReceipt] = useState<AttachedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = items.filter((item) => item.status !== "cancelled");

  const estimated = useMemo(
    () =>
      active.reduce((acc, item) => acc + Math.round(item.qty * (item.actualPrice ?? item.estimatedPrice)), 0) +
      extras.reduce((acc, row) => acc + Math.round(row.qty * row.price), 0),
    [active, extras]
  );

  const total = totalPaid > 0 ? totalPaid : estimated;
  const available = source === "main" ? saldoUtama : pockets.find((p) => p.id === source)?.balance ?? 0;
  const insufficient = total > available;

  const patchExtra = (key: string, next: Partial<ExtraRow>) =>
    setExtras((current) => current.map((row) => (row.key === key ? { ...row, ...next } : row)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    const cleanExtras = extras
      .map((row) => ({ name: row.name.trim(), qty: row.qty, price: row.price }))
      .filter((row) => row.name.length > 0);

    if (!merchant.trim()) return setError("Nama toko wajib diisi.");
    if (active.length === 0 && cleanExtras.length === 0) {
      return setError("Tidak ada barang untuk diselesaikan.");
    }
    if (total <= 0) return setError("Isi total yang dibayar atau harga barangnya.");
    if (insufficient) {
      return setError(`Saldo tidak cukup. Total ${formatRupiah(total)}, tersedia ${formatRupiah(available)}.`);
    }
    setError(null);

    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const result = await completeShoppingPlan({
        planId: plan.id,
        source,
        date,
        merchant: merchant.trim(),
        note: note.trim() || undefined,
        extraItems: cleanExtras,
        totalPaid: totalPaid > 0 ? totalPaid : undefined,
        receiptIds: receipt ? [receipt.id] : undefined,
        clientToken: tokenRef.current!,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyelesaikan belanja.");
        setError(result.error ?? null);
        return;
      }

      toast.success("Belanja selesai. Transaksi tercatat di Keuangan.");
      tokenRef.current = null;
      setOpen(false);
      router.push(`/admin/keuangan/transaksi/${result.data!.id}`);
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>
        {/* Ringkas di HP (berbagi satu baris dengan input tambah barang),
            melebar penuh di panel samping desktop. */}
        <button
          type="button"
          className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-black text-white shadow-[0_4px_0_var(--primary-dark)] transition-transform duration-150 active:translate-y-[3px] active:shadow-[0_1px_0_var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-12 lg:w-full lg:rounded-2xl lg:text-[15px]"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span className="lg:hidden">Selesai</span>
          <span className="hidden lg:inline">Selesaikan Belanja</span>
        </button>
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title="Selesaikan Belanja"
        description="Satu transaksi Pengeluaran kategori Belanja akan dibuat dan saldo berkurang."
      >
        <form onSubmit={submit} className="space-y-3.5" noValidate>
          {remaining > 0 && (
            <p className="rounded-xl bg-primary-light px-3 py-2 text-[11px] font-bold text-primary">
              Masih ada {remaining} barang yang belum dicentang. Rencana tetap bisa diselesaikan — barang
              itu dianggap tidak jadi dibeli.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="done-total">Total harga yang dibayar</Label>
            <CurrencyInput
              id="done-total"
              size="hero"
              value={totalPaid}
              onValueChange={setTotalPaid}
              disabled={isPending}
              autoFocus
            />
            <p className="text-[11px] font-semibold text-ink-3">
              Perkiraan dari daftar {formatRupiah(estimated)}. Kosongkan untuk memakai angka itu.
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="done-merchant">Nama toko</Label>
              <Input
                id="done-merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                maxLength={80}
                autoComplete="off"
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="done-date">Tanggal</Label>
              <Input
                id="done-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="done-source">Sumber dana</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="done-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Saldo Utama</SelectItem>
                {pockets.map((pocket) => (
                  <SelectItem key={pocket.id} value={pocket.id}>
                    {pocket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] font-semibold text-ink-3">
              Tersedia <strong className="text-ink-2">{formatRupiah(available)}</strong>
            </p>
          </div>

          <section className="space-y-2.5 rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-sm font-black text-ink-1">Barang tambahan</h3>
              <button
                type="button"
                onClick={() => setExtras((current) => [...current, newExtra()])}
                className="tap-target flex items-center gap-1 rounded-xl px-2 text-xs font-black text-primary"
              >
                <Plus className="h-4 w-4" aria-hidden /> Tambah
              </button>
            </div>

            {extras.length === 0 ? (
              <p className="text-[11px] font-semibold text-ink-3">
                Barang yang dibeli di luar rencana bisa dicatat di sini.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {extras.map((row, index) => (
                  <li key={row.key} className="rounded-xl bg-card p-2.5">
                    <div className="flex gap-2">
                      <Input
                        value={row.name}
                        onChange={(e) => patchExtra(row.key, { name: e.target.value })}
                        maxLength={80}
                        placeholder="Nama barang"
                        aria-label={`Nama barang tambahan ${index + 1}`}
                        disabled={isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setExtras((current) => current.filter((r) => r.key !== row.key))}
                        aria-label={`Hapus barang tambahan ${index + 1}`}
                        className="tap-target grid shrink-0 place-items-center rounded-xl text-destructive active:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <QtyInput
                        value={row.qty}
                        onValueChange={(qty) => patchExtra(row.key, { qty })}
                        disabled={isPending}
                        label={`Jumlah barang tambahan ${index + 1}`}
                      />
                      <CurrencyInput
                        value={row.price}
                        onValueChange={(price) => patchExtra(row.key, { price })}
                        aria-label={`Harga barang tambahan ${index + 1}`}
                        disabled={isPending}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="done-note">Catatan (opsional)</Label>
            <Textarea
              id="done-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={isPending}
              className="min-h-[60px] rounded-xl border-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Bukti struk (opsional)</Label>
            <ReceiptUploader value={receipt} onChange={setReceipt} disabled={isPending} />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <Panel className="bg-rose-hero p-4 text-white">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Total transaksi</p>
            <p className="tabular font-mono text-2xl font-black">{formatRupiah(total)}</p>
          </Panel>

          <GameButton type="submit" variant="primary" block disabled={isPending || total <= 0}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memproses…
              </>
            ) : (
              "Simpan Transaksi Belanja"
            )}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
