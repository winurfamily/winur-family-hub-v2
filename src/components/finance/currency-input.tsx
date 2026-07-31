"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

/**
 * Input nominal Rupiah.
 *
 * Menampilkan angka bertitik ("1.500.000") sambil menyimpan nilai numerik
 * murni ke state induk. `inputMode="numeric"` memunculkan papan angka di HP
 * (J/F2.3) — `type="number"` sengaja dihindari karena spinner-nya kecil,
 * mudah tergeser, dan format ribuan tidak bisa ditampilkan.
 */
export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
    value: number;
    onValueChange: (value: number) => void;
  }
>(({ className, value, onValueChange, disabled, ...props }, ref) => {
  const [text, setText] = React.useState(() => (value ? formatNumber(value) : ""));

  // Sinkronkan bila nilai diubah dari luar (mis. reset form / autofill harga).
  React.useEffect(() => {
    const current = Number(text.replace(/\D/g, "")) || 0;
    if (current !== value) setText(value ? formatNumber(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 15);
    const numeric = digits ? Number(digits) : 0;
    setText(digits ? formatNumber(numeric) : "");
    onValueChange(numeric);
  };

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-ink-3"
      >
        Rp
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        disabled={disabled}
        placeholder="0"
        className={cn(
          "tabular flex h-11 w-full rounded-xl border-2 border-input bg-card py-2 pl-10 pr-3.5 text-base font-bold text-ink-1 shadow-sm transition-colors placeholder:font-normal placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
});
CurrencyInput.displayName = "CurrencyInput";

/** Input kuantitas dengan tombol −/+ berukuran layak sentuh. */
export function QtyInput({
  value,
  onValueChange,
  disabled,
  min = 1,
  className,
  label = "Kuantitas",
}: {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  className?: string;
  label?: string;
}) {
  const step = (delta: number) => onValueChange(Math.max(min, Number((value + delta).toFixed(2))));

  return (
    <div className={cn("flex items-stretch gap-1.5", className)}>
      <button
        type="button"
        aria-label={`Kurangi ${label.toLowerCase()}`}
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
        className="tap-target flex shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-lg font-black text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number(e.target.value.replace(/[^\d.]/g, ""));
          onValueChange(Number.isFinite(parsed) && parsed > 0 ? parsed : min);
        }}
        className="tabular h-11 w-full min-w-0 rounded-xl border-2 border-input bg-card px-2 text-center text-base font-bold text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <button
        type="button"
        aria-label={`Tambah ${label.toLowerCase()}`}
        disabled={disabled}
        onClick={() => step(1)}
        className="tap-target flex shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-lg font-black text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
