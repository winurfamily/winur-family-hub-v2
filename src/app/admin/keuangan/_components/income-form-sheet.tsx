"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { addIncome, updateIncome, type IncomeItem } from "@/app/actions/pendapatan";
import { INCOME_VISUAL_LIST } from "@/lib/finance-categories";
import { todayISODate } from "@/lib/format";

interface IncomeFormSheetProps {
  trigger?: React.ReactNode;
  pockets: { id: string; name: string }[];
  /** Diisi untuk mode edit; kosong berarti tambah baru. */
  income?: IncomeItem;
  onSaved?: () => void;
  /** Boleh dikendalikan dari luar (mis. dari bilah aksi utama / sheet detail). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function IncomeFormSheet({
  trigger,
  pockets,
  income,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: IncomeFormSheetProps) {
  const isEdit = Boolean(income);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  const [source, setSource] = useState(income?.source ?? "");
  const [amount, setAmount] = useState(income?.amount ?? 0);
  const [date, setDate] = useState(income?.date ?? todayISODate());
  const [target, setTarget] = useState(income?.pocketId ?? "main");
  const [category, setCategory] = useState<string>(income?.category ?? "gaji");
  const [note, setNote] = useState(income?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  // Kembalikan form ke nilai awal setiap kali panel dibuka, supaya sisa
  // ketikan dari percobaan sebelumnya tidak terbawa.
  useEffect(() => {
    if (!open) return;
    setSource(income?.source ?? "");
    setAmount(income?.amount ?? 0);
    setDate(income?.date ?? todayISODate());
    setTarget(income?.pocketId ?? "main");
    setCategory(income?.category ?? "gaji");
    setNote(income?.note ?? "");
    setError(null);
    tokenRef.current = null;
  }, [open, income]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return; // cegah double-submit

    if (!source.trim()) return setError("Sumber pendapatan wajib diisi.");
    if (amount <= 0) return setError("Nominal harus lebih dari 0.");
    setError(null);

    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const payload = {
        source: source.trim(),
        amount,
        date,
        target,
        category,
        note: note.trim() || undefined,
        clientToken: tokenRef.current!,
      };

      const result = isEdit ? await updateIncome(income!.id, payload) : await addIncome(payload);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan pendapatan.");
        setError(result.error ?? null);
        return;
      }

      toast.success(isEdit ? "Pendapatan diperbarui." : "Pendapatan dicatat.");
      tokenRef.current = null;
      setOpen(false);
      onSaved?.();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      {trigger && <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>}
      <ResponsiveSheetContent
        title={isEdit ? "Ubah Pendapatan" : "Catat Pendapatan"}
        description={
          isEdit
            ? "Saldo akan disesuaikan otomatis mengikuti perubahan nominal dan tujuan."
            : "Saldo rekening tujuan bertambah setelah disimpan."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="income-amount">Nominal</Label>
            <CurrencyInput
              id="income-amount"
              size="hero"
              value={amount}
              onValueChange={setAmount}
              disabled={isPending}
              autoFocus={!isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <CategoryPicker
              label="Kategori pendapatan"
              categories={INCOME_VISUAL_LIST}
              value={category}
              onChange={setCategory}
              disabled={isPending}
              columns={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="income-source">Sumber pendapatan</Label>
            <Input
              id="income-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Contoh: Gaji bulanan"
              disabled={isPending}
              required
            />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="income-date">Tanggal</Label>
              <Input
                id="income-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-target">Masuk ke</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="income-target">
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

          <div className="space-y-1.5">
            <Label htmlFor="income-note">Catatan (opsional)</Label>
            <Textarea
              id="income-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              disabled={isPending}
              className="min-h-[64px] rounded-xl border-2"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <GameButton type="submit" variant="secondary" block disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
              </>
            ) : isEdit ? (
              "Simpan Perubahan"
            ) : (
              "Simpan Pendapatan"
            )}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
