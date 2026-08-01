"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { Panel } from "@/components/finance/ui";
import { ItemLine } from "@/components/finance/item-line";
import { ItemFieldsRow, UnitDatalist, parseQty, type ItemDraft } from "@/components/finance/item-fields";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ReceiptUploader, type AttachedReceipt } from "../../_components/receipt-uploader";
import { completeShoppingPlan, type PlanItemView, type PlanView } from "@/app/actions/rencana";
import type { FinanceSummary } from "@/app/actions/keuangan";
import { formatRupiah } from "@/lib/format";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/shopping-item";
import { computeReceiptTotals } from "@/lib/shopping-receipt";
import { useTodayJakarta } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const newExtra = (): ItemDraft => ({ key: crypto.randomUUID(), name: "", qty: "1", unit: "", price: 0 });

/** Satu baris ringkasan. Angka negatif ditulis dengan tanda minus sungguhan. */
function SummaryRow({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          "font-semibold text-ink-3",
          strong && "font-black text-ink-1",
          muted && "text-[11.5px]"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular shrink-0 font-bold text-ink-2",
          strong && "font-black text-ink-1",
          muted && "text-[11.5px] font-semibold text-ink-3",
          tone === "danger" && "text-destructive"
        )}
      >
        {value < 0 ? `−${formatRupiah(Math.abs(value))}` : formatRupiah(value)}
      </span>
    </div>
  );
}

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

  const today = useTodayJakarta();

  const [merchant, setMerchant] = useState(plan.name);
  // Belanja dicatat pada hari BELANJANYA, bukan pada tanggal rencana: rencana
  // sering dibuat berhari-hari sebelumnya, dan memakai tanggal itu membuat
  // pengeluaran masuk ke hari yang salah (kadang bulan yang salah).
  const [date, setDate] = useState(today);
  const [dateTouched, setDateTouched] = useState(false);
  const [source, setSource] = useState("main");
  const [note, setNote] = useState("");
  const [totalPaid, setTotalPaid] = useState(0);
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [voucher, setVoucher] = useState(0);
  const [fees, setFees] = useState(0);
  const [extras, setExtras] = useState<ItemDraft[]>([]);
  const [receipt, setReceipt] = useState<AttachedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Pengguna sudah melihat selisihnya dan memilih tetap melanjutkan. */
  const [acceptDifference, setAcceptDifference] = useState(false);

  // Setiap kali panel dibuka, tanggalnya kembali ke hari ini yang sebenarnya
  // — kecuali pengguna memang sudah menggantinya sendiri.
  useEffect(() => {
    if (!open || dateTouched) return;
    setDate(today);
  }, [open, today, dateTouched]);

  // HANYA yang sudah dicentang ikut dihitung — sama persis dengan aturan di
  // server. Barang yang belum dibeli dan yang dibatalkan tidak pernah masuk.
  const bought = items.filter((item) => item.status === "bought");
  const notBought = items.filter((item) => item.status === "pending");

  const totals = useMemo(
    () =>
      computeReceiptTotals({
        items: bought.map((item) => ({
          name: item.name,
          qty: item.qty,
          price: item.actualPrice ?? item.estimatedPrice,
          unit: item.unit ?? undefined,
        })),
        extras: extras
          .filter((row) => row.name.trim().length > 0)
          .map((row) => ({
            name: row.name.trim(),
            qty: parseQty(row.qty),
            price: row.price,
            unit: row.unit,
          })),
        transactionDiscount,
        voucher,
        fees,
        totalPaid,
      }),
    [bought, extras, transactionDiscount, voucher, fees, totalPaid]
  );

  const total = totals.hasPaid ? totals.totalPaid : totals.totalCalculated;
  const available = source === "main" ? saldoUtama : pockets.find((p) => p.id === source)?.balance ?? 0;
  const insufficient = total > available;
  const mismatch = totals.hasPaid && totals.difference !== 0;

  const patchExtra = (key: string, next: Partial<ItemDraft>) =>
    setExtras((current) => current.map((row) => (row.key === key ? { ...row, ...next } : row)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    const cleanExtras = extras
      .map((row) => ({
        name: row.name.trim(),
        qty: parseQty(row.qty),
        unit: row.unit,
        price: row.price,
      }))
      .filter((row) => row.name.length > 0);

    if (!merchant.trim()) return setError("Nama toko wajib diisi.");
    if (bought.length === 0 && cleanExtras.length === 0) {
      return setError("Belum ada barang yang ditandai sudah dibeli. Centang barangnya dulu.");
    }
    if (total <= 0) return setError("Isi total yang dibayar atau harga barangnya.");
    if (insufficient) {
      return setError(`Saldo tidak cukup. Total ${formatRupiah(total)}, tersedia ${formatRupiah(available)}.`);
    }
    // Selisih harus diakui secara sadar. Tanpa centang ini server pun
    // menolaknya — pemeriksaan di sini hanya supaya pesannya muncul lebih
    // cepat, bukan sebagai satu-satunya penjaga.
    if (mismatch && !acceptDifference) {
      return setError(
        `Rincian ${formatRupiah(totals.totalCalculated)} tidak sama dengan pembayaran ${formatRupiah(totals.totalPaid)}. Perbaiki harganya, atau centang persetujuan selisih di bawah.`
      );
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
        transactionDiscount: transactionDiscount || undefined,
        voucher: voucher || undefined,
        fees: fees || undefined,
        totalPaid: totalPaid > 0 ? totalPaid : undefined,
        acceptDifference,
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
        <UnitDatalist />
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
              Hitungan dari rincian {formatRupiah(totals.totalCalculated)}. Kosongkan untuk memakai angka
              itu.
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
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateTouched(true);
                }}
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
                        maxLength={MAX_ITEM_NAME_LENGTH}
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
                    <div className="mt-2">
                      <ItemFieldsRow
                        index={index}
                        draft={row}
                        disabled={isPending}
                        onPatch={(patch) => patchExtra(row.key, patch)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3.5 rounded-2xl bg-surface-2 p-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="done-discount">Diskon transaksi</Label>
              <CurrencyInput
                id="done-discount"
                value={transactionDiscount}
                onValueChange={setTransactionDiscount}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="done-voucher">Voucher</Label>
              <CurrencyInput
                id="done-voucher"
                value={voucher}
                onValueChange={setVoucher}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="done-fees">Biaya tambahan</Label>
              <CurrencyInput id="done-fees" value={fees} onValueChange={setFees} disabled={isPending} />
            </div>
          </section>

          {bought.length > 0 && (
            <section className="space-y-2 rounded-2xl bg-surface-2 p-3">
              <h3 className="font-heading text-sm font-black text-ink-1">
                Barang sudah dibeli ({bought.length})
              </h3>
              <ul className="divide-y divide-border">
                {bought.map((item) => (
                  <li key={item.id} className="py-1.5">
                    <ItemLine
                      name={item.name}
                      qty={item.qty}
                      unit={item.unit}
                      meta={
                        item.actualPrice !== null
                          ? `${formatRupiah(item.actualPrice)}/satuan`
                          : item.estimatedPrice > 0
                            ? `perkiraan ${formatRupiah(item.estimatedPrice)}/satuan`
                            : "harga belum diisi"
                      }
                      trailing={
                        <span className="tabular shrink-0 text-[13px] font-black text-ink-1">
                          {formatRupiah(
                            Math.round(item.qty * (item.actualPrice ?? item.estimatedPrice))
                          )}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notBought.length > 0 && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-3">
              {notBought.length} barang belum dicentang dan TIDAK ikut dihitung:{" "}
              {notBought
                .slice(0, 5)
                .map((i) => i.name)
                .join(", ")}
              {notBought.length > 5 ? `, dan ${notBought.length - 5} lainnya` : ""}.
            </p>
          )}

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

          {/* Ringkasan sebelum konfirmasi: setiap komponen angka ditulis
              terpisah supaya total akhir bisa ditelusuri baris demi baris,
              bukan muncul sebagai satu angka yang harus dipercaya. */}
          <section className="space-y-1 rounded-2xl border-2 border-border bg-card p-3 text-[13px]">
            <SummaryRow label="Total sebelum diskon" value={totals.totalBeforeDiscount} />
            {totals.extrasTotal > 0 && (
              <SummaryRow label="— termasuk barang tambahan" value={totals.extrasTotal} muted />
            )}
            {totals.itemDiscountTotal > 0 && (
              <SummaryRow label="Diskon per barang" value={-totals.itemDiscountTotal} />
            )}
            {totals.transactionDiscount > 0 && (
              <SummaryRow label="Diskon transaksi" value={-totals.transactionDiscount} />
            )}
            {totals.voucher > 0 && <SummaryRow label="Voucher" value={-totals.voucher} />}
            {totals.fees > 0 && <SummaryRow label="Biaya tambahan" value={totals.fees} />}
            <div className="!mt-2 border-t border-border pt-2">
              <SummaryRow label="Total akhir seharusnya" value={totals.totalCalculated} strong />
            </div>
            {totals.hasPaid && <SummaryRow label="Total dibayar" value={totals.totalPaid} />}
            {mismatch && (
              <div className="!mt-2 rounded-xl bg-destructive/10 px-3 py-2">
                <SummaryRow
                  label={totals.difference > 0 ? "Kelebihan bayar" : "Kekurangan bayar"}
                  value={totals.difference}
                  strong
                  tone="danger"
                />
              </div>
            )}
          </section>

          {mismatch && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 p-3">
              <input
                type="checkbox"
                checked={acceptDifference}
                onChange={(e) => setAcceptDifference(e.target.checked)}
                disabled={isPending}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-[12px] font-semibold text-ink-2">
                Saya sudah memeriksa dan tetap ingin menyimpan. Selisih{" "}
                <strong className="text-ink-1">{formatRupiah(Math.abs(totals.difference))}</strong>{" "}
                akan dicatat sebagai baris tersendiri, bukan disembunyikan ke harga barang.
              </span>
            </label>
          )}

          <Panel className="bg-rose-hero p-4 text-white">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Total transaksi</p>
            <p className="tabular font-mono text-2xl font-black">{formatRupiah(total)}</p>
          </Panel>

          <GameButton
            type="submit"
            variant="primary"
            block
            disabled={isPending || total <= 0 || (mismatch && !acceptDifference)}
          >
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
