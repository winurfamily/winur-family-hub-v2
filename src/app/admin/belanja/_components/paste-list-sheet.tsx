"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { ItemFieldsRow, UnitDatalist, parseQty } from "@/components/finance/item-fields";
import { addPlanItemsBulk } from "@/app/actions/rencana";
import { parseShoppingList } from "@/lib/shopping-parser";
import { formatRupiah } from "@/lib/format";
import { MAX_ITEM_NAME_LENGTH, formatQtyValue, itemKey } from "@/lib/shopping-item";
import { cn } from "@/lib/utils";

const CONTOH_RAPI = "Beras ; 5 ; kg\nMinyak Goreng ; 2 ; liter\nTelur ; 1 ; kg";
const CONTOH_BEBAS = "Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi";

interface DraftRow {
  key: string;
  name: string;
  qty: string;
  unit: string;
  price: number;
  /** Sudah ada di daftar rencana — dilewati kecuali pengguna memilih ikut. */
  duplicate: boolean;
  skipped: boolean;
}

/**
 * Tempel daftar belanja dari teks panjang.
 *
 * Teks dipecah per baris atau per koma dan mengerti dua gaya penulisan
 * sekaligus: `Nama ; jumlah ; satuan` dan gaya bebas `Beras 5 kg`.
 * Hasilnya SELALU melewati layar pratinjau — nama, jumlah, satuan, dan harga
 * bisa diperbaiki sebelum disimpan; tidak ada yang langsung masuk.
 *
 * Barang yang namanya sudah ada di checklist ditandai dan otomatis dilewati,
 * supaya menempel daftar yang sama dua kali tidak menggandakan isinya.
 */
export function PasteListSheet({
  planId,
  existingItems = [],
  trigger,
}: {
  planId: string;
  /** Barang yang sudah ada di rencana — dipakai mendeteksi duplikat. */
  existingItems?: { name: string; unit?: string | null }[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const existingKeys = useMemo(
    () => new Set(existingItems.map((item) => itemKey(item.name, item.unit))),
    [existingItems]
  );

  const included = (rows ?? []).filter((row) => !row.skipped && row.name.trim().length > 0);
  const total = included.reduce((acc, row) => acc + Math.round(parseQty(row.qty) * row.price), 0);
  const skippedCount = (rows ?? []).length - included.length;

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

    setRows(
      parsed.map((item, index) => {
        const duplicate = existingKeys.has(itemKey(item.name, item.unit));
        return {
          key: `${index}-${item.name}`,
          name: item.name,
          qty: formatQtyValue(item.qty),
          unit: item.unit,
          price: item.price,
          duplicate,
          skipped: duplicate,
        };
      })
    );
  };

  const patch = (key: string, next: Partial<DraftRow>) =>
    setRows((current) => current?.map((row) => (row.key === key ? { ...row, ...next } : row)) ?? null);

  const remove = (key: string) =>
    setRows((current) => current?.filter((row) => row.key !== key) ?? null);

  const handleSave = () => {
    if (isPending || included.length === 0) return;

    startTransition(async () => {
      const result = await addPlanItemsBulk(
        planId,
        included.map((row) => ({
          name: row.name.trim(),
          qty: parseQty(row.qty),
          estimatedPrice: row.price,
          unit: row.unit,
        }))
      );

      if (!result.success) {
        toast.error(result.error ?? "Gagal menambah barang.");
        return;
      }

      toast.success(`${result.data?.added ?? included.length} barang masuk ke checklist.`);
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
        description="Pisahkan tiap barang dengan koma atau baris baru. Semuanya bisa diperbaiki sebelum disimpan."
      >
        <UnitDatalist />

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
                placeholder={`${CONTOH_RAPI}\n\natau\n\n${CONTOH_BEBAS}`}
                className="min-h-[140px] rounded-xl border-2"
              />
            </div>

            <section className="space-y-2 rounded-2xl bg-surface-2 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-ink-3">
                Dua cara menulis — pilih yang paling mudah
              </p>

              <FormatExample
                title="Rapi: Nama ; jumlah ; satuan"
                example={CONTOH_RAPI}
                hint="Paling akurat. Kolom keempat boleh diisi harga satuan."
                onUse={() => setText(CONTOH_RAPI)}
              />
              <FormatExample
                title="Bebas: seperti menulis di WhatsApp"
                example={CONTOH_BEBAS}
                hint="Jumlah & satuan dibaca otomatis. Menulis nama saja pun boleh."
                onUse={() => setText(CONTOH_BEBAS)}
              />

              <p className="text-[11px] font-semibold leading-relaxed text-ink-3">
                Pemisah antar barang: baris baru atau koma. Harga boleh ditulis
                <span className="font-black text-ink-2"> @12.000</span> atau
                <span className="font-black text-ink-2"> Rp12.000</span>. Barang kosong diabaikan.
              </p>
            </section>

            <GameButton
              type="button"
              variant="primary"
              block
              disabled={!text.trim()}
              onClick={handlePreview}
            >
              Lihat Pratinjau
            </GameButton>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-ink-1">{included.length} barang akan ditambahkan</p>
                {skippedCount > 0 && (
                  <p className="text-[11px] font-semibold text-ink-3">
                    {skippedCount} dilewati karena sudah ada di daftar
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRows(null)}
                className="tap-target flex shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-black text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Ubah teks
              </button>
            </div>

            <ul className="space-y-2.5">
              {rows.map((row, index) => (
                <li
                  key={row.key}
                  className={cn(
                    "rounded-2xl border-2 border-border bg-surface-2 p-3 transition-opacity",
                    row.skipped && "opacity-60"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
                      {row.duplicate ? (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-primary">
                          Sudah ada di daftar
                        </span>
                      ) : (
                        `Barang ${index + 1}`
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {row.duplicate && (
                        <button
                          type="button"
                          onClick={() => patch(row.key, { skipped: !row.skipped })}
                          className="tap-target flex items-center gap-1 rounded-xl px-2 text-[11px] font-black text-ink-2"
                        >
                          <Undo2 className="h-3.5 w-3.5" aria-hidden />
                          {row.skipped ? "Tambahkan juga" : "Lewati"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(row.key)}
                        aria-label={`Hapus ${row.name}`}
                        className="tap-target flex items-center justify-center rounded-xl text-destructive transition-colors active:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <Input
                    value={row.name}
                    onChange={(e) => patch(row.key, { name: e.target.value })}
                    maxLength={MAX_ITEM_NAME_LENGTH}
                    aria-label={`Nama barang ${index + 1}`}
                  />

                  <div className="mt-2.5">
                    <ItemFieldsRow
                      index={index}
                      draft={row}
                      priceLabel="Perkiraan"
                      onPatch={(next) => patch(row.key, next)}
                    />
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
                disabled={isPending || included.length === 0}
                onClick={handleSave}
              >
                {isPending ? "Menyimpan…" : `Tambahkan ${included.length} Barang`}
              </GameButton>
            </div>
          </div>
        )}
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

function FormatExample({
  title,
  example,
  hint,
  onUse,
}: {
  title: string;
  example: string;
  hint: string;
  onUse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onUse}
      className="block w-full rounded-xl bg-card px-3 py-2.5 text-left transition-colors active:bg-primary-light"
    >
      <p className="text-[11px] font-black text-ink-2">{title}</p>
      {/* whitespace-pre-line: contoh gaya rapi ditulis satu barang per baris,
          persis seperti yang akan ditempel pengguna. */}
      <p className="mt-0.5 whitespace-pre-line break-words font-mono text-[11px] font-semibold leading-snug text-ink-1">
        {example}
      </p>
      <p className="mt-1 text-[10.5px] font-semibold text-ink-3">{hint}</p>
    </button>
  );
}
