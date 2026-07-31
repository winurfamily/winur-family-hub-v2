"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/finance/currency-input";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { addPlanItemsBulk } from "@/app/actions/rencana";
import { parseShoppingList, type ParsedShoppingItem } from "@/lib/shopping-parser";
import { formatRupiah } from "@/lib/format";

const CONTOH = "Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi, Susu anak 2 kotak";

interface DraftRow extends ParsedShoppingItem {
  key: string;
}

/**
 * Tempel daftar belanja dari teks panjang.
 *
 * Teks dipecah per koma (juga per baris), lalu SELALU melewati layar
 * pratinjau: nama, jumlah, satuan, dan harga bisa diperbaiki sebelum
 * disimpan. Tidak ada yang langsung masuk tanpa dilihat pengguna.
 */
export function PasteListSheet({ planId, trigger }: { planId: string; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(
    () => (rows ?? []).reduce((acc, row) => acc + Math.round(row.qty * row.price), 0),
    [rows]
  );

  const reset = () => {
    setText("");
    setRows(null);
  };

  const handlePreview = () => {
    const parsed = parseShoppingList(text);
    if (parsed.length === 0) {
      toast.error("Tidak ada barang yang bisa dibaca dari teks itu.");
      return;
    }
    setRows(parsed.map((item, index) => ({ ...item, key: `${index}-${item.name}` })));
  };

  const patch = (key: string, next: Partial<DraftRow>) =>
    setRows((current) => current?.map((row) => (row.key === key ? { ...row, ...next } : row)) ?? null);

  const remove = (key: string) =>
    setRows((current) => current?.filter((row) => row.key !== key) ?? null);

  const handleSave = () => {
    if (isPending || !rows?.length) return;

    startTransition(async () => {
      const result = await addPlanItemsBulk(
        planId,
        rows.map((row) => ({
          name: row.name,
          qty: row.qty,
          estimatedPrice: row.price,
          unit: row.unit,
        }))
      );

      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }

      toast.success(`${result.data?.added ?? rows.length} barang masuk ke checklist.`);
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <ResponsiveSheetTrigger asChild>
        {trigger ?? (
          <GameButton type="button" variant="outline" size="sm" className="gap-1.5">
            <ClipboardPaste className="h-4 w-4" aria-hidden /> Tempel Daftar
          </GameButton>
        )}
      </ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title="Tempel Daftar Belanja"
        description="Pisahkan tiap barang dengan koma. Semuanya bisa diperbaiki sebelum disimpan."
      >
        {rows === null ? (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="paste-text">Daftar belanja</Label>
              <Textarea
                id="paste-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                autoFocus
                placeholder={CONTOH}
                className="min-h-[140px] rounded-xl border-2"
              />
            </div>

            <button
              type="button"
              onClick={() => setText(CONTOH)}
              className="w-full rounded-xl bg-surface-2 px-3 py-2.5 text-left text-[11px] font-semibold text-ink-3 transition-colors active:bg-primary-light"
            >
              Contoh: <span className="text-ink-2">{CONTOH}</span>
            </button>

            <GameButton type="button" variant="primary" block disabled={!text.trim()} onClick={handlePreview}>
              Lihat Pratinjau
            </GameButton>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-ink-1">{rows.length} barang terbaca</p>
              <button
                type="button"
                onClick={() => setRows(null)}
                className="text-xs font-black text-primary underline-offset-2 hover:underline"
              >
                Ubah teks
              </button>
            </div>

            <ul className="space-y-2.5">
              {rows.map((row, index) => (
                <li key={row.key} className="rounded-2xl border-2 border-border bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
                      Barang {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(row.key)}
                      aria-label={`Hapus ${row.name}`}
                      className="tap-target flex items-center justify-center rounded-xl text-destructive transition-colors active:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <Input
                    value={row.name}
                    onChange={(e) => patch(row.key, { name: e.target.value })}
                    maxLength={80}
                    aria-label={`Nama barang ${index + 1}`}
                  />

                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Jumlah</Label>
                      <Input
                        inputMode="decimal"
                        value={String(row.qty)}
                        onChange={(e) => {
                          const parsed = Number(e.target.value.replace(/[^\d.]/g, ""));
                          patch(row.key, { qty: Number.isFinite(parsed) && parsed > 0 ? parsed : 1 });
                        }}
                        className="tabular text-center"
                        aria-label={`Jumlah barang ${index + 1}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Satuan</Label>
                      <Input
                        value={row.unit}
                        onChange={(e) => patch(row.key, { unit: e.target.value.slice(0, 20) })}
                        placeholder="kg"
                        aria-label={`Satuan barang ${index + 1}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Harga</Label>
                      <CurrencyInput
                        value={row.price}
                        onValueChange={(price) => patch(row.key, { price })}
                        aria-label={`Harga barang ${index + 1}`}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="safe-bottom sticky bottom-0 -mx-5 space-y-2 border-t-2 border-border bg-card/95 px-5 pb-1 pt-3 backdrop-blur">
              <p className="flex items-baseline justify-between text-sm">
                <span className="font-extrabold text-ink-2">Perkiraan total</span>
                <span className="tabular font-black text-ink-1">{formatRupiah(total)}</span>
              </p>
              <GameButton
                type="button"
                variant="primary"
                block
                disabled={isPending || rows.length === 0}
                onClick={handleSave}
              >
                {isPending ? "Menyimpan…" : `Tambahkan ${rows.length} Barang`}
              </GameButton>
            </div>
          </div>
        )}
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
