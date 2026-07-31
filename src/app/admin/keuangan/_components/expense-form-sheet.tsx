"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetTrigger,
} from "@/components/finance/responsive-sheet";
import { createShoppingTransaction } from "@/app/actions/belanja";
import type { PocketSummary } from "@/app/actions/keuangan";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/supabase/types";
import { formatRupiah, todayISODate } from "@/lib/format";

/**
 * Kategori pengeluaran umum — kategori "Belanja" sengaja TIDAK ada di sini.
 *
 * Pengeluaran belanja hanya boleh lahir dari menu Belanja (rencana, manual,
 * atau scan struk) supaya tidak ada dua jalan masuk untuk hal yang sama.
 */
const GENERAL_CATEGORIES: ExpenseCategory[] = [
  "makanan",
  "rumah",
  "transportasi",
  "tagihan",
  "kesehatan",
  "pendidikan",
  "anak",
  "hiburan",
  "sosial",
  "hadiah",
  "lainnya",
];

/**
 * Catat satu pengeluaran umum (listrik, bensin, sekolah, ...).
 *
 * Disimpan lewat RPC yang sama dengan belanja sehingga pemotongan saldo tetap
 * atomik, tapi tanpa rincian barang: satu baris bernama sama dengan
 * keterangannya.
 */
export function ExpenseFormSheet({
  trigger,
  pockets,
  saldoUtama,
}: {
  trigger: React.ReactNode;
  pockets: PocketSummary[];
  saldoUtama: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>
      <ResponsiveSheetContent
        title="Tambah Pengeluaran"
        description="Untuk pengeluaran di luar belanja: tagihan, transportasi, sekolah, dan lainnya."
      >
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
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

          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Nominal</Label>
            <CurrencyInput
              id="expense-amount"
              value={amount}
              onValueChange={setAmount}
              disabled={isPending}
              autoFocus
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
              <Label htmlFor="expense-category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENERAL_CATEGORIES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {EXPENSE_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <p className="text-[11px] font-semibold text-ink-3">
              Tersedia <strong className="text-ink-2">{formatRupiah(available)}</strong>
            </p>
          </div>

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
            {isPending ? "Menyimpan…" : "Simpan Pengeluaran"}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
