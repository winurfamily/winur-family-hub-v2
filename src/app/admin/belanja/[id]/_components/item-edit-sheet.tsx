"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ItemFieldsRow, UnitDatalist, parseQty } from "@/components/finance/item-fields";
import { updatePlanItem, type PlanItemView } from "@/app/actions/rencana";
import { MAX_ITEM_NAME_LENGTH, formatQtyValue } from "@/lib/shopping-item";
import { formatRupiah } from "@/lib/format";

/**
 * Ubah satu barang rencana: nama, jumlah, satuan, dan estimasi harga.
 *
 * Memakai susunan kolom yang sama dengan pratinjau Tempel Daftar dan barang
 * tambahan, sehingga bentuk isian barang hanya perlu dipelajari sekali.
 */
export function ItemEditSheet({ item, trigger }: { item: PlanItemView; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(() => formatQtyValue(item.qty));
  const [unit, setUnit] = useState(item.unit ?? "");
  const [price, setPrice] = useState(item.estimatedPrice);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item.name);
    setQty(formatQtyValue(item.qty));
    setUnit(item.unit ?? "");
    setPrice(item.estimatedPrice);
    setError(null);
  }, [open, item]);

  const subtotal = Math.round(parseQty(qty) * price);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    if (!name.trim()) return setError("Nama barang wajib diisi.");
    setError(null);

    startTransition(async () => {
      const result = await updatePlanItem(item.id, {
        name: name.trim(),
        qty: parseQty(qty),
        unit,
        estimatedPrice: price,
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
        description="Nama, jumlah, satuan, dan perkiraan harga satuannya."
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

          <p className="flex items-baseline justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
            <span className="font-bold text-ink-3">Perkiraan subtotal</span>
            <span className="tabular font-black text-ink-1">{formatRupiah(subtotal)}</span>
          </p>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <GameButton type="submit" variant="primary" block disabled={isPending}>
            {isPending ? "Menyimpan…" : "Simpan Barang"}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
