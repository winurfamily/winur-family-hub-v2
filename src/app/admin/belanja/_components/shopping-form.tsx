"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ItemFieldsRow,
  UnitDatalist,
  parseQty,
  type ItemDraft,
} from "@/components/finance/item-fields";
import { ReceiptUploader, type AttachedReceipt } from "./receipt-uploader";
import { createShoppingTransaction, type ShoppingItemInput } from "@/app/actions/belanja";
import { searchProducts, type PocketSummary, type ProductSuggestion } from "@/app/actions/keuangan";
import { EXPENSE_CATEGORY_LABELS, type ShoppingTransactionSource } from "@/lib/supabase/types";
import { formatRupiah } from "@/lib/format";
import { MAX_ITEM_NAME_LENGTH, formatQtyValue } from "@/lib/shopping-item";
import { useTodayJakarta } from "@/lib/use-today";

function newItem(partial?: Partial<ShoppingItemInput>): ItemDraft {
  return {
    key: crypto.randomUUID(),
    name: partial?.name ?? "",
    qty: formatQtyValue(partial?.qty ?? 1),
    unit: partial?.unit ?? "",
    price: partial?.price ?? 0,
  };
}

export interface ShoppingFormDefaults {
  merchant?: string;
  date?: string;
  items?: ShoppingItemInput[];
}

/**
 * Form satu transaksi belanja: header (toko, tanggal, sumber dana, catatan,
 * struk) + daftar barang. Dipakai oleh Belanja Manual maupun layar review
 * hasil Scan AI, supaya keduanya punya validasi & perilaku simpan yang
 * persis sama.
 *
 * Kategori TIDAK bisa dipilih: semua yang lahir dari menu Belanja selalu
 * masuk sebagai Pengeluaran kategori "Belanja" di laporan Keuangan. Itu yang
 * membuat laporan Keuangan konsisten tanpa perlu pintasan Belanja kedua.
 */
export function ShoppingForm({
  pockets,
  saldoUtama,
  defaults,
  origin = "manual",
  initialReceipt = null,
  submitLabel = "Simpan Belanja",
}: {
  pockets: PocketSummary[];
  saldoUtama: number;
  defaults?: ShoppingFormDefaults;
  origin?: ShoppingTransactionSource;
  initialReceipt?: AttachedReceipt | null;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  const today = useTodayJakarta();

  const [merchant, setMerchant] = useState(defaults?.merchant ?? "");
  const [date, setDate] = useState(defaults?.date ?? today);
  const [dateTouched, setDateTouched] = useState(Boolean(defaults?.date));
  const [sourceValue, setSourceValue] = useState("main");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<AttachedReceipt | null>(initialReceipt);
  const [items, setItems] = useState<ItemDraft[]>(
    defaults?.items?.length ? defaults.items.map((i) => newItem(i)) : [newItem()]
  );
  const [error, setError] = useState<string | null>(null);

  // Tab Manual tidak pernah ditutup-buka seperti panel, jadi tanggalnya
  // disegarkan sendiri saat aplikasi kembali dibuka — kecuali sudah diganti.
  useEffect(() => {
    if (dateTouched) return;
    setDate(today);
  }, [today, dateTouched]);

  const total = items.reduce((acc, i) => acc + Math.round(parseQty(i.qty) * i.price), 0);
  const available = sourceValue === "main" ? saldoUtama : pockets.find((p) => p.id === sourceValue)?.balance ?? 0;
  const insufficient = total > available;

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const removeItem = (key: string) =>
    setItems((current) => (current.length === 1 ? [newItem()] : current.filter((i) => i.key !== key)));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return; // cegah tersimpan dua kali saat tombol ditekan berulang

    const cleaned = items
      .map((i) => ({ name: i.name.trim(), qty: parseQty(i.qty), unit: i.unit, price: i.price }))
      .filter((i) => i.name.length > 0);

    if (!merchant.trim()) return setError("Nama toko wajib diisi.");
    if (cleaned.length === 0) return setError("Tambahkan minimal satu barang.");
    if (cleaned.some((i) => i.qty <= 0)) return setError("Kuantitas setiap barang harus lebih dari 0.");
    if (insufficient) {
      return setError(
        `Saldo tidak cukup. Total ${formatRupiah(total)}, tersedia ${formatRupiah(available)}.`
      );
    }
    setError(null);

    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const result = await createShoppingTransaction({
        merchant: merchant.trim(),
        date,
        source: sourceValue,
        category: "belanja",
        note: note.trim() || undefined,
        items: cleaned,
        receiptIds: receipt ? [receipt.id] : undefined,
        origin,
        clientToken: tokenRef.current!,
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Gagal menyimpan transaksi.");
        setError(result.error ?? null);
        return;
      }

      toast.success("Belanja tersimpan.");
      tokenRef.current = null;
      // Arahkan ke halaman detail agar pengguna melihat hasil simpanannya (F2.10).
      router.push(`/admin/keuangan/transaksi/${result.data.id}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <UnitDatalist />
      <section className="space-y-3.5 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <ShoppingCart className="h-4 w-4 text-primary" aria-hidden /> Detail Transaksi
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="shop-merchant">Nama toko / merchant</Label>
          <Input
            id="shop-merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder="Contoh: Indomaret Cibinong"
            disabled={isPending}
            required
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shop-date">Tanggal transaksi</Label>
            <Input
              id="shop-date"
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
          <div className="space-y-1.5">
            <Label>Kategori pengeluaran</Label>
            <p className="flex h-11 items-center gap-2 rounded-xl border-2 border-input bg-surface-2 px-3.5 text-sm font-bold text-ink-2">
              <ShoppingCart className="h-4 w-4 text-primary" aria-hidden />
              {EXPENSE_CATEGORY_LABELS.belanja}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shop-source">Sumber dana</Label>
          <Select value={sourceValue} onValueChange={setSourceValue}>
            <SelectTrigger id="shop-source">
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

        <div className="space-y-1.5">
          <Label htmlFor="shop-note">Catatan (opsional)</Label>
          <Textarea
            id="shop-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            disabled={isPending}
            className="min-h-[64px] rounded-xl border-2"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Bukti struk</Label>
          <ReceiptUploader value={receipt} onChange={setReceipt} disabled={isPending} />
        </div>
      </section>

      <section className="space-y-3 rounded-[20px] bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-black text-ink-1">Barang</h2>
          <span className="text-xs font-bold text-ink-3">{items.length} baris</span>
        </div>

        <ul className="space-y-3">
          {items.map((item, index) => (
            <ItemRow
              key={item.key}
              item={item}
              index={index}
              disabled={isPending}
              canRemove={items.length > 1}
              onChange={(patch) => updateItem(item.key, patch)}
              onRemove={() => removeItem(item.key)}
            />
          ))}
        </ul>

        <GameButton
          type="button"
          variant="outline"
          block
          disabled={isPending}
          onClick={() => setItems((current) => [...current, newItem()])}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" aria-hidden /> Tambah Barang
        </GameButton>
      </section>

      {/* Ringkasan + tombol simpan menempel di bawah agar mudah dijangkau ibu jari. */}
      <div className="safe-bottom sticky bottom-0 -mx-4 space-y-2.5 border-t-2 border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur-md">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-extrabold text-ink-2">Total</span>
          <span className="tabular font-mono text-xl font-bold text-ink-1">{formatRupiah(total)}</span>
        </div>

        {error && (
          <p role="alert" className="text-sm font-bold text-destructive">
            {error}
          </p>
        )}
        {!error && insufficient && total > 0 && (
          <p role="status" className="text-xs font-bold text-destructive">
            Total melebihi saldo yang tersedia ({formatRupiah(available)}).
          </p>
        )}

        <GameButton type="submit" variant="primary" block disabled={isPending || total <= 0}>
          {isPending ? "Menyimpan…" : submitLabel}
        </GameButton>
      </div>
    </form>
  );
}

/**
 * Satu baris barang.
 *
 * Di HP tersusun vertikal (nama selebar penuh, lalu jumlah · satuan · harga
 * sebaris), bukan diperas ke satu baris seperti sebelumnya — itu yang membuat
 * kolom harga terpotong di layar sempit. Susunan tiga kolomnya sama persis
 * dengan pratinjau Tempel Daftar dan barang tambahan.
 */
function ItemRow({
  item,
  index,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  item: ItemDraft;
  index: number;
  disabled?: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
}) {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!showSuggestions || item.name.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSuggestions(await searchProducts(item.name));
    }, 250);
    return () => clearTimeout(timer);
  }, [item.name, showSuggestions]);

  const subtotal = Math.round(parseQty(item.qty) * item.price);

  return (
    <li className="rounded-2xl border-2 border-border bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-3">
          Barang {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label={`Hapus barang ${index + 1}`}
          className="tap-target flex items-center justify-center rounded-xl text-destructive transition-colors active:bg-destructive/10 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="relative space-y-2.5">
        <div className="space-y-1.5">
          <Label htmlFor={`item-name-${item.key}`} className="text-[11px]">
            Nama barang
          </Label>
          <Input
            id={`item-name-${item.key}`}
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            maxLength={MAX_ITEM_NAME_LENGTH}
            autoComplete="off"
            placeholder="Contoh: Beras Premium"
            disabled={disabled}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border-2 border-border bg-card shadow-card-deep">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange({ name: s.name, price: s.lastPrice || item.price });
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

        <ItemFieldsRow index={index} draft={item} disabled={disabled} onPatch={onChange} />

        <p className="flex items-baseline justify-between border-t border-border pt-2 text-xs">
          <span className="font-bold text-ink-3">Subtotal</span>
          <span className="tabular font-extrabold text-ink-1">{formatRupiah(subtotal)}</span>
        </p>
      </div>
    </li>
  );
}
