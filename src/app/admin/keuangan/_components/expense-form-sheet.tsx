"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { CategoryPicker } from "@/components/finance/category-picker";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { createShoppingTransaction } from "@/app/actions/belanja";
import type { PocketSummary } from "@/app/actions/keuangan";
import { MANUAL_EXPENSE_VISUALS } from "@/lib/finance-categories";
import { formatRupiah, todayISODate } from "@/lib/format";

/**
 * Catat satu pengeluaran umum (listrik, bensin, sekolah, ...).
 *
 * Urutan isian mengikuti cara orang benar-benar mencatat: nominal dulu (paling
 * penting, langsung fokus & papan angka terbuka), lalu kategori sebagai grid
 * ikon satu ketukan, baru keterangan dan sisanya.
 *
 * Disimpan lewat RPC yang sama dengan belanja sehingga pemotongan saldo tetap
 * atomik, tapi tanpa rincian barang: satu baris bernama sama dengan
 * keterangannya. Kategori "Belanja" sengaja tidak tersedia di sini — hanya
 * menu Belanja yang boleh melahirkannya.
 */
export function ExpenseFormSheet({
  trigger,
  pockets,
  saldoUtama,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  pockets: PocketSummary[];
  saldoUtama: number;
  /** Boleh dikendalikan dari luar (mis. dari bilah aksi utama). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISODate());
  const [category, setCategory] = useState<string>("tagihan");
  const [source, setSource] = useState("main");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAmount(0);
    setDate(todayISODate());
    setCategory("tagihan");
    setSource("main");
    setNote("");
    setError(null);
    tokenRef.current = null;
  }, [open]);

  const available = source === "main" ? saldoUtama : pockets.find((p) => p.id === source)?.balance ?? 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    if (!title.trim()) return setError("Keterangan pengeluaran wajib diisi.");
    if (amount <= 0) return setError("Nominal harus lebih dari 0.");
    if (amount > available) {
      return setError(`Saldo tidak cukup. Tersedia ${formatRupiah(available)}.`);
    }
    setError(null);

    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const result = await createShoppingTransaction({
        merchant: title.trim(),
        date,
        source,
        category,
        note: note.trim() || undefined,
        items: [{ name: title.trim(), qty: 1, price: amount }],
        origin: "manual",
        clientToken: tokenRef.current!,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan pengeluaran.");
        setError(result.error ?? null);
        return;
      }

      toast.success("Pengeluaran tercatat.");
      tokenRef.current = null;
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      {trigger && <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>}
      <ResponsiveSheetContent
        title="Catat Pengeluaran"
        description="Untuk pengeluaran di luar belanja: tagihan, transportasi, sekolah, dan lainnya."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Nominal</Label>
            <CurrencyInput
              id="expense-amount"
              size="hero"
              value={amount}
              onValueChange={setAmount}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <CategoryPicker
              label="Kategori pengeluaran"
              categories={MANUAL_EXPENSE_VISUALS}
              value={category}
              onChange={setCategory}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-title">Keterangan</Label>
            <Input
              id="expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              autoComplete="off"
              placeholder="Contoh: Token listrik"
              disabled={isPending}
              required
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Tanggal</Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-source">Sumber dana</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="expense-source">
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
            </div>
          </div>

          <p className="text-[11px] font-semibold text-ink-3">
            Tersedia <strong className="text-ink-2">{formatRupiah(available)}</strong>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="expense-note">Catatan (opsional)</Label>
            <Textarea
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={isPending}
              className="min-h-[60px] rounded-xl border-2"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <GameButton type="submit" variant="primary" block disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
              </>
            ) : (
              "Simpan Pengeluaran"
            )}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
