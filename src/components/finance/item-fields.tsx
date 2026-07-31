"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/finance/currency-input";
import { MAX_UNIT_LENGTH, UNIT_SUGGESTIONS } from "@/lib/shopping-item";
import { cn } from "@/lib/utils";

const UNIT_DATALIST_ID = "satuan-belanja";

/**
 * Daftar saran satuan bersama untuk seluruh input barang.
 * Dirender sekali per layar; `<datalist>` yang sama boleh dirujuk banyak input.
 */
export function UnitDatalist() {
  return (
    <datalist id={UNIT_DATALIST_ID}>
      {UNIT_SUGGESTIONS.map((unit) => (
        <option key={unit} value={unit} />
      ))}
    </datalist>
  );
}

/**
 * Kolom kuantitas berbentuk teks bebas.
 *
 * Sengaja bukan `type="number"` dan bukan pengendali yang langsung memaksa
 * angka: pengguna harus bisa mengosongkan kolom untuk mengetik ulang
 * ("1" → "" → "12") tanpa nilainya melompat balik ke 1 di tengah ketikan.
 * Angka baru dibulatkan saat kolom ditinggalkan.
 */
export function QtyTextInput({
  value,
  onValueChange,
  disabled,
  id,
  label = "Jumlah",
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      aria-label={label}
      disabled={disabled}
      placeholder="1"
      onChange={(event) => onValueChange(event.target.value.replace(/[^\d.,]/g, "").slice(0, 8))}
      onBlur={() => onValueChange(String(parseQty(value)))}
      className={cn("tabular text-center", className)}
    />
  );
}

export function UnitInput({
  value,
  onValueChange,
  disabled,
  id,
  label = "Satuan",
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      aria-label={label}
      disabled={disabled}
      list={UNIT_DATALIST_ID}
      autoComplete="off"
      placeholder="pcs"
      maxLength={MAX_UNIT_LENGTH}
      onChange={(event) => onValueChange(event.target.value)}
      className={className}
    />
  );
}

/** "1,5" / "1.5" / "" → angka > 0. Kolom kosong berarti satu barang. */
export function parseQty(raw: string): number {
  const parsed = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Number(parsed.toFixed(2));
}

export interface ItemDraft {
  key: string;
  name: string;
  qty: string;
  unit: string;
  price: number;
}

/**
 * Tiga kolom qty · satuan · harga di bawah kolom nama.
 *
 * Susunannya sama di rencana, barang tambahan, dan review scan, sehingga
 * pengguna hanya perlu belajar satu bentuk isian.
 */
export function ItemFieldsRow({
  draft,
  onPatch,
  disabled,
  priceLabel = "Harga satuan",
  index,
}: {
  draft: ItemDraft;
  onPatch: (patch: Partial<ItemDraft>) => void;
  disabled?: boolean;
  priceLabel?: string;
  index: number;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,3.5rem)_minmax(0,1fr)_minmax(0,1.6fr)] gap-2">
      <div className="space-y-1">
        <Label htmlFor={`qty-${draft.key}`} className="text-[11px]">
          Jumlah
        </Label>
        <QtyTextInput
          id={`qty-${draft.key}`}
          value={draft.qty}
          onValueChange={(qty) => onPatch({ qty })}
          disabled={disabled}
          label={`Jumlah barang ${index + 1}`}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`unit-${draft.key}`} className="text-[11px]">
          Satuan
        </Label>
        <UnitInput
          id={`unit-${draft.key}`}
          value={draft.unit}
          onValueChange={(unit) => onPatch({ unit })}
          disabled={disabled}
          label={`Satuan barang ${index + 1}`}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`price-${draft.key}`} className="text-[11px]">
          {priceLabel}
        </Label>
        <CurrencyInput
          id={`price-${draft.key}`}
          value={draft.price}
          onValueChange={(price) => onPatch({ price })}
          disabled={disabled}
          aria-label={`${priceLabel} barang ${index + 1}`}
        />
      </div>
    </div>
  );
}
