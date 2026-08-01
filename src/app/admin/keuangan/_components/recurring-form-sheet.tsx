"use client";

import { useEffect, useState, useTransition } from "react";
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
import { createRecurring, updateRecurring, type RecurringView } from "@/app/actions/rutin";
import { INCOME_VISUAL_LIST, MANUAL_EXPENSE_VISUALS } from "@/lib/finance-categories";
import { formatDate } from "@/lib/format";
import {
  FREQUENCY_HINTS,
  FREQUENCY_LABELS,
  RECURRING_FREQUENCIES,
  nextRecurringDate,
  type RecurringFrequency,
} from "@/lib/recurring";
import { useTodayJakarta } from "@/lib/use-today";
import type { RecurringKind } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Form jadwal rutin.
 *
 * Yang membedakannya dari form pencatatan biasa: tanggal jatuh tempo
 * BERIKUTNYA selalu dipratinjau saat frekuensi atau tanggal mulai diubah.
 * Tanpa itu, "bulanan mulai 31 Januari" adalah tebakan — pengguna tidak tahu
 * apakah Februari akan jatuh pada tanggal 28 atau dilewati. Pratinjaunya
 * memakai `nextRecurringDate` yang sengaja dibuat identik dengan fungsi SQL
 * yang benar-benar membuat tagihannya.
 */
export function RecurringFormSheet({
  pockets,
  schedule,
  trigger,
  onSaved,
}: {
  pockets: { id: string; name: string }[];
  /** Ada = mode ubah. */
  schedule?: RecurringView;
  trigger: React.ReactNode;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const today = useTodayJakarta();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(schedule?.name ?? "");
  const [kind, setKind] = useState<RecurringKind>(schedule?.kind ?? "expense");
  const [amount, setAmount] = useState(schedule?.amount ?? 0);
  const [category, setCategory] = useState(schedule?.categoryKey ?? "tagihan");
  const [account, setAccount] = useState(schedule?.account ?? "main");
  const [frequency, setFrequency] = useState<RecurringFrequency>(schedule?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(schedule?.startDate ?? today);
  const [endDate, setEndDate] = useState(schedule?.endDate ?? "");
  const [note, setNote] = useState(schedule?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(schedule);

  // Jadwal baru dimulai hari ini; jadwal yang sedang diubah mempertahankan
  // tanggal aslinya.
  useEffect(() => {
    if (open && !isEdit) setStartDate((current) => current || today);
  }, [open, isEdit, today]);

  // Kategori mengikuti jenis: daftar pendapatan dan pengeluaran tidak sama,
  // jadi berganti jenis tanpa menyetel ulang akan menyimpan kategori yang
  // tidak ada di daftarnya (dan diam-diam jatuh ke "lainnya" di server).
  const changeKind = (next: RecurringKind) => {
    setKind(next);
    setCategory(next === "income" ? "gaji" : "tagihan");
  };

  const visuals = kind === "income" ? INCOME_VISUAL_LIST : MANUAL_EXPENSE_VISUALS;
  const preview = nextRecurringDate(startDate, frequency);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    if (!name.trim()) return setError("Nama transaksi wajib diisi.");
    if (amount <= 0) return setError("Nominal harus lebih dari 0.");
    if (!startDate) return setError("Tanggal mulai wajib diisi.");
    if (endDate && endDate < startDate) return setError("Tanggal berakhir harus setelah tanggal mulai.");
    setError(null);

    const payload = {
      name: name.trim(),
      kind,
      amount,
      category,
      account,
      frequency,
      startDate,
      endDate: endDate || undefined,
      note: note.trim() || undefined,
    };

    startTransition(async () => {
      const result = schedule
        ? await updateRecurring(schedule.id, payload)
        : await createRecurring(payload);

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan jadwal.");
        setError(result.error ?? null);
        return;
      }

      toast.success(schedule ? "Jadwal diperbarui." : `Jadwal "${payload.name}" dibuat.`);
      setOpen(false);
      if (!schedule) {
        setName("");
        setAmount(0);
        setNote("");
      }
      onSaved?.();
      router.refresh();
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title={schedule ? "Ubah Transaksi Rutin" : "Transaksi Rutin Baru"}
        description="Jadwal hanya membuat pengingat. Saldo baru berubah setelah kamu menekan Konfirmasi saat jatuh tempo."
      >
        <form onSubmit={submit} className="space-y-3.5" noValidate>
          <div
            role="radiogroup"
            aria-label="Jenis transaksi"
            className="flex rounded-full bg-surface-2 p-1"
          >
            {(
              [
                { id: "expense" as const, label: "Pengeluaran" },
                { id: "income" as const, label: "Pendapatan" },
              ]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={kind === option.id}
                disabled={isPending}
                onClick={() => changeKind(option.id)}
                className={cn(
                  "min-h-10 flex-1 rounded-full px-3 text-[13px] font-black transition-colors duration-150",
                  kind === option.id
                    ? option.id === "income"
                      ? "bg-secondary text-white"
                      : "bg-primary text-white"
                    : "text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-amount">Nominal</Label>
            <CurrencyInput
              id="rec-amount"
              size="hero"
              value={amount}
              onValueChange={setAmount}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-name">Nama transaksi</Label>
            <Input
              id="rec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder={kind === "income" ? "Mis. Gaji bulanan" : "Mis. Listrik PLN"}
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <CategoryPicker
              categories={visuals}
              value={category}
              onChange={setCategory}
              disabled={isPending}
              label="Kategori transaksi rutin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rec-account">
              {kind === "income" ? "Masuk ke" : "Diambil dari"}
            </Label>
            <Select value={account} onValueChange={setAccount} disabled={isPending}>
              <SelectTrigger id="rec-account">
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

          <div className="space-y-1.5">
            <Label htmlFor="rec-frequency">Frekuensi</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as RecurringFrequency)}
              disabled={isPending}
            >
              <SelectTrigger id="rec-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRING_FREQUENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FREQUENCY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] font-semibold text-ink-3">{FREQUENCY_HINTS[frequency]}</p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-start">Tanggal mulai</Label>
              <Input
                id="rec-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-end">Berakhir (opsional)</Label>
              <Input
                id="rec-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {startDate && (
            <p className="rounded-xl bg-accent-light px-3 py-2 text-[11.5px] font-bold text-ink-2">
              Jatuh tempo pertama <strong className="text-ink-1">{formatDate(startDate)}</strong>,
              lalu <strong className="text-ink-1">{formatDate(preview)}</strong>.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rec-note">Catatan (opsional)</Label>
            <Textarea
              id="rec-note"
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

          <GameButton type="submit" variant="primary" block disabled={isPending || amount <= 0}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
              </>
            ) : schedule ? (
              "Simpan Perubahan"
            ) : (
              "Buat Jadwal"
            )}
          </GameButton>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
