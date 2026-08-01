"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Undo2, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/finance/currency-input";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ItemFieldsRow, UnitDatalist, parseQty } from "@/components/finance/item-fields";
import { updatePlanItem, type PlanItemView } from "@/app/actions/rencana";
import { MAX_ITEM_NAME_LENGTH, formatQtyValue } from "@/lib/shopping-item";
import { formatRupiah } from "@/lib/format";
import { toWholeRupiah } from "@/lib/shopping-receipt";

/**
 * Ubah satu barang rencana: nama, jumlah, satuan, perkiraan harga, dan harga
 * aktual — plus dua aksi yang dulu tinggal di laci baris checklist ("tidak
 * jadi dibeli" dan "hapus").
 *
 * Semua perubahan bersifat DRAFT sampai tombol Simpan ditekan: state lokal
 * tidak pernah menyentuh server sebelum itu, dan menutup panel membuang
 * seluruh ketikan. Membuka panel selalu memuat ulang nilai dari barangnya,
 * sehingga tidak ada sisa ketikan dari barang yang dibuka sebelumnya.
 *
 * Perbedaan perkiraan vs aktual disengaja terlihat berdampingan: perkiraan
 * dipakai saat menyusun rencana, harga aktual adalah angka dari kasir yang
 * ikut dihitung saat menyelesaikan belanja.
 */
export function ItemEditSheet({
  item,
  trigger,
  onCancelItem,
  onDeleteItem,
}: {
  item: PlanItemView;
  trigger: React.ReactNode;
  /** Tandai "tidak jadi dibeli" / kembalikan. */
  onCancelItem?: () => void;
  onDeleteItem?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(() => formatQtyValue(item.qty));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [price, setPrice] = useState(item.estimatedPrice);
  const [actualPrice, setActualPrice] = useState<number>(item.actualPrice ?? 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item.name);
    setQty(formatQtyValue(item.qty));
    setUnit(item.unit ?? "");
    setPrice(item.estimatedPrice);
    setActualPrice(item.actualPrice ?? 0);
    setError(null);
  }, [open, item]);

  const cancelled = item.status === "cancelled";
  const parsedQty = parseQty(qty);
  const effectivePrice = actualPrice > 0 ? actualPrice : price;
  const subtotal = Math.round(parsedQty * effectivePrice);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Anti kirim ganda: selama transisi berjalan, submit kedua diabaikan dan
    // tombolnya sendiri sudah dinonaktifkan.
    if (isPending) return;

    const cleanName = name.trim();
    if (!cleanName) return setError("Nama barang wajib diisi.");
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return setError("Jumlah harus lebih dari 0.");
    }
    if (toWholeRupiah(price) !== Math.max(0, Math.round(price))) {
      return setError("Perkiraan harga tidak valid.");
    }
    if (actualPrice < 0) return setError("Harga aktual tidak boleh negatif.");
    setError(null);

    startTransition(async () => {
      const result = await updatePlanItem(item.id, {
        name: cleanName,
        qty: parsedQty,
        unit,
        estimatedPrice: price,
        // 0 berarti "belum diisi" dan dikembalikan menjadi null oleh server,
        // bukan disimpan sebagai barang seharga Rp0.
        actualPrice: actualPrice > 0 ? actualPrice : null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan barang.");
        setError(result.error ?? null);
        return;
      }

      toast.success("Barang diperbarui.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>
      <ResponsiveSheetContent
        title="Ubah Barang"
        description="Perubahan baru berlaku setelah ditekan Simpan."
      >
        <UnitDatalist />
        <form onSubmit={submit} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${item.id}`}>Nama barang</Label>
            <Input
              id={`edit-name-${item.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_ITEM_NAME_LENGTH}
              autoComplete="off"
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <ItemFieldsRow
            index={0}
            disabled={isPending}
            priceLabel="Perkiraan harga"
            draft={{ key: item.id, name, qty, unit, price }}
            onPatch={(patch) => {
              if (patch.qty !== undefined) setQty(patch.qty);
              if (patch.unit !== undefined) setUnit(patch.unit);
              if (patch.price !== undefined) setPrice(patch.price);
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor={`edit-actual-${item.id}`}>Harga aktual (dari kasir)</Label>
            <CurrencyInput
              id={`edit-actual-${item.id}`}
              value={actualPrice}
              onValueChange={setActualPrice}
              disabled={isPending}
              aria-label="Harga aktual satuan"
            />
            <p className="text-[11px] font-semibold text-ink-3">
              Kosongkan bila belum tahu. Angka inilah yang dipakai saat menyelesaikan belanja.
            </p>
          </div>

          <p className="flex items-baseline justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
            <span className="font-bold text-ink-3">
              Subtotal {actualPrice > 0 ? "aktual" : "perkiraan"}
            </span>
            <span className="tabular font-black text-ink-1">{formatRupiah(subtotal)}</span>
          </p>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <GameButton type="submit" variant="primary" block disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
                </>
              ) : (
                "Simpan"
              )}
            </GameButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="tap-target shrink-0 rounded-xl border-2 border-border bg-card px-4 text-[13px] font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-40"
            >
              Batal
            </button>
          </div>

          {(onCancelItem || onDeleteItem) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {onCancelItem && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onCancelItem();
                    setOpen(false);
                  }}
                  className="tap-target flex items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-xs font-black text-ink-2 transition-transform duration-150 active:scale-95 disabled:opacity-40"
                >
                  {cancelled ? (
                    <>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> Kembalikan
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" aria-hidden /> Tidak jadi dibeli
                    </>
                  )}
                </button>
              )}
              {onDeleteItem && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onDeleteItem();
                    setOpen(false);
                  }}
                  aria-label={`Hapus ${item.name} dari daftar`}
                  className="tap-target ml-auto grid place-items-center rounded-xl px-3 text-destructive transition-transform duration-150 active:scale-90 active:bg-destructive/10 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
