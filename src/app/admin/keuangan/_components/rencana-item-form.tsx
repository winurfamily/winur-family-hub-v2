"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Save, X } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput, QtyInput } from "@/components/finance/currency-input";
import { addPlanItem, updatePlanItem, type PlanItemView } from "@/app/actions/rencana";
import { searchProducts, type ProductSuggestion } from "@/app/actions/keuangan";
import { formatRupiah } from "@/lib/format";

/**
 * Form tambah/ubah barang rencana.
 *
 * Versi lama memampatkan nama, qty, harga, dan tombol tambah ke satu baris
 * grid `1fr 56px 96px 40px` — di HP kolom harga terpotong dan tombolnya
 * hampir mustahil ditekan. Di sini setiap kolom punya barisnya sendiri di
 * mobile (nama selebar penuh, qty & harga sebaris), dan baru dirapatkan
 * menjadi satu baris di layar lebar.
 */
export function RencanaItemForm({
  planId,
  item,
  onDone,
  onCancel,
}: {
  planId: string;
  item?: PlanItemView;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(item);
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [price, setPrice] = useState(item?.estimatedPrice ?? 0);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!showSuggestions || name.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => setSuggestions(await searchProducts(name)), 250);
    return () => clearTimeout(timer);
  }, [name, showSuggestions]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    if (!name.trim()) return setError("Nama barang wajib diisi.");
    if (qty <= 0) return setError("Kuantitas harus lebih dari 0.");
    setError(null);

    startTransition(async () => {
      const payload = { name: name.trim(), qty, estimatedPrice: price };
      const result = isEdit ? await updatePlanItem(item!.id, payload) : await addPlanItem(planId, payload);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan barang.");
        setError(result.error ?? null);
        return;
      }

      toast.success(isEdit ? "Barang diperbarui." : "Barang ditambahkan.");
      if (!isEdit) {
        setName("");
        setQty(1);
        setPrice(0);
      }
      onDone?.();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2.5 rounded-2xl border-2 border-border bg-surface-2 p-3"
      noValidate
    >
      <div className="relative space-y-1.5">
        <Label htmlFor={`plan-item-name-${item?.id ?? planId}`} className="text-[11px]">
          Nama barang
        </Label>
        <Input
          id={`plan-item-name-${item?.id ?? planId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          maxLength={80}
          autoComplete="off"
          placeholder="Cari atau ketik nama barang"
          disabled={isPending}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border-2 border-border bg-card shadow-card-deep">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setName(s.name);
                    if (s.lastPrice > 0) setPrice(s.lastPrice);
                    setShowSuggestions(false);
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  <span className="truncate font-bold text-ink-1">{s.name}</span>
                  <span className="tabular shrink-0 text-xs font-semibold text-ink-3">
                    {formatRupiah(s.lastPrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label className="text-[11px]">Kuantitas</Label>
          <QtyInput value={qty} onValueChange={setQty} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`plan-item-price-${item?.id ?? planId}`} className="text-[11px]">
            Estimasi harga
          </Label>
          <CurrencyInput
            id={`plan-item-price-${item?.id ?? planId}`}
            value={price}
            onValueChange={setPrice}
            disabled={isPending}
          />
        </div>
      </div>

      <p className="flex items-baseline justify-between text-xs">
        <span className="font-bold text-ink-3">Subtotal</span>
        <span className="tabular font-extrabold text-ink-1">{formatRupiah(Math.round(qty * price))}</span>
      </p>

      {error && (
        <p role="alert" className="text-xs font-bold text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <GameButton type="submit" variant="secondary" size="sm" block disabled={isPending} className="gap-1.5">
          {isEdit ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {isPending ? "Menyimpan…" : isEdit ? "Simpan" : "Tambah Barang"}
        </GameButton>
        {onCancel && (
          <GameButton
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onCancel}
            aria-label="Batal"
            className="shrink-0 px-3"
          >
            <X className="h-4 w-4" aria-hidden />
          </GameButton>
        )}
      </div>
    </form>
  );
}
