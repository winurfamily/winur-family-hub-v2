"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2, Scale } from "lucide-react";
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
import { createBalanceAdjustment, getAccountBalance } from "@/app/actions/penyesuaian";
import { formatRupiah } from "@/lib/format";
import { useTodayJakarta } from "@/lib/use-today";
import { cn } from "@/lib/utils";

/**
 * PENYESUAIAN SALDO — mencocokkan saldo aplikasi dengan uang yang sebenarnya.
 *
 * Bentuknya sengaja dua langkah: isi → TINJAU sebelum simpan. Ini satu-satunya
 * layar di aplikasi yang mengubah saldo tanpa ada transaksi nyata di baliknya,
 * jadi angkanya harus terbaca utuh ("Rp 4.000.000 → Rp 3.850.000, selisih
 * −Rp 150.000") sebelum tombol simpan muncul. Menyimpan langsung dari form
 * membuat salah ketik satu nol menjadi koreksi jutaan yang tak disadari.
 *
 * Dua cara mengisi, karena keduanya sama-sama alami tergantung situasi:
 *  - "Saldo sebenarnya" saat baru menghitung uang di dompet;
 *  - "Selisih" saat sudah tahu persis berapa yang kurang/lebih.
 *
 * Alasan WAJIB. Koreksi tanpa alasan hanyalah angka yang berubah sendiri —
 * enam bulan kemudian tidak ada yang bisa menjelaskannya.
 */
export function AdjustBalanceSheet({
  accounts,
  defaultAccount = "main",
  trigger,
}: {
  /** Saldo Utama + seluruh pocket, dalam bentuk yang sama dengan filter akun. */
  accounts: { id: string; name: string; balance: number }[];
  defaultAccount?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const today = useTodayJakarta();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const tokenRef = useRef<string | null>(null);

  const [account, setAccount] = useState(defaultAccount);
  const [mode, setMode] = useState<"target" | "delta">("target");
  const [actualBalance, setActualBalance] = useState(0);
  const [deltaValue, setDeltaValue] = useState(0);
  const [deltaSign, setDeltaSign] = useState<1 | -1>(-1);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Saldo tercatat dibaca ulang dari server saat akun berganti. */
  const [current, setCurrent] = useState<{ name: string; balance: number } | null>(null);
  const [loadingBalance, startLoadingBalance] = useTransition();

  const fallback = accounts.find((a) => a.id === account);

  useEffect(() => {
    if (!open) return;
    startLoadingBalance(async () => {
      setCurrent(await getAccountBalance(account));
    });
  }, [open, account]);

  useEffect(() => {
    if (open) setDate(today);
  }, [open, today]);

  const balance = current?.balance ?? fallback?.balance ?? 0;
  const accountName = current?.name ?? fallback?.name ?? "Akun";

  const delta = mode === "target" ? actualBalance - balance : deltaValue * deltaSign;
  const nextBalance = balance + delta;

  const reset = () => {
    setMode("target");
    setActualBalance(0);
    setDeltaValue(0);
    setDeltaSign(-1);
    setReason("");
    setConfirming(false);
    setError(null);
    tokenRef.current = null;
  };

  const validate = (): string | null => {
    if (!reason.trim()) return "Alasan penyesuaian wajib diisi.";
    if (mode === "target" && actualBalance === balance) {
      return "Saldo aplikasi sudah sama dengan saldo sebenarnya.";
    }
    if (delta === 0) return "Selisih tidak boleh nol.";
    if (nextBalance < 0) return `Saldo ${accountName} tidak boleh minus.`;
    return null;
  };

  const review = () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const save = () => {
    if (isPending) return;
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      setConfirming(false);
      return;
    }

    // Token idempotency dibuat sekali per percobaan simpan; kalau permintaan
    // terkirim dua kali, RPC mengembalikan koreksi yang sama alih-alih
    // menerapkan selisihnya dua kali.
    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const result = await createBalanceAdjustment({
        account,
        mode,
        actualBalance: mode === "target" ? actualBalance : undefined,
        delta: mode === "delta" ? delta : undefined,
        reason: reason.trim(),
        date,
        clientToken: tokenRef.current!,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan penyesuaian.");
        setError(result.error ?? null);
        setConfirming(false);
        tokenRef.current = null;
        return;
      }

      toast.success(
        `Saldo ${accountName} disesuaikan ${result.data!.delta > 0 ? "+" : "−"}${formatRupiah(
          Math.abs(result.data!.delta)
        )}.`
      );
      setOpen(false);
      reset();
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
      <ResponsiveSheetTrigger asChild>{trigger}</ResponsiveSheetTrigger>

      <ResponsiveSheetContent
        title="Penyesuaian Saldo"
        description="Untuk mencocokkan saldo aplikasi dengan uang yang benar-benar ada. Tercatat sebagai penyesuaian, bukan pendapatan atau pengeluaran."
      >
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="adj-account">Akun yang disesuaikan</Label>
            <Select value={account} onValueChange={setAccount} disabled={isPending || confirming}>
              <SelectTrigger id="adj-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Saldo tercatat adalah titik acuan seluruh layar ini, jadi
              ditampilkan besar dan selalu terlihat — bukan sebagai teks
              bantuan kecil di bawah input. */}
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-ink-3">
              Saldo tercatat di aplikasi
            </p>
            <p className="tabular mt-0.5 flex items-center gap-2 font-mono text-2xl font-black text-ink-1">
              {loadingBalance ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              ) : (
                formatRupiah(balance)
              )}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Cara mengisi penyesuaian"
            className="flex rounded-full bg-surface-2 p-1"
          >
            {(
              [
                { id: "target", label: "Saldo sebenarnya" },
                { id: "delta", label: "Nominal selisih" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={mode === option.id}
                disabled={isPending || confirming}
                onClick={() => {
                  setMode(option.id);
                  setError(null);
                }}
                className={cn(
                  "min-h-10 flex-1 rounded-full px-3 text-[12.5px] font-black transition-colors duration-150 disabled:opacity-60",
                  mode === option.id ? "bg-card text-primary shadow-card" : "text-ink-3"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {mode === "target" ? (
            <div className="space-y-1.5">
              <Label htmlFor="adj-actual">Saldo sebenarnya sekarang</Label>
              <CurrencyInput
                id="adj-actual"
                size="hero"
                value={actualBalance}
                onValueChange={(value) => {
                  setActualBalance(value);
                  setConfirming(false);
                }}
                disabled={isPending}
                autoFocus
              />
              <p className="text-[11px] font-semibold text-ink-3">
                Hitung uang yang benar-benar ada, lalu tulis angkanya di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="adj-delta">Nominal selisih</Label>
              <div className="flex gap-2">
                <div
                  role="radiogroup"
                  aria-label="Arah penyesuaian"
                  className="flex shrink-0 rounded-2xl bg-surface-2 p-1"
                >
                  {(
                    [
                      { value: -1 as const, label: "−", hint: "Kurangi saldo" },
                      { value: 1 as const, label: "+", hint: "Tambah saldo" },
                    ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={deltaSign === option.value}
                      aria-label={option.hint}
                      title={option.hint}
                      disabled={isPending}
                      onClick={() => {
                        setDeltaSign(option.value);
                        setConfirming(false);
                      }}
                      className={cn(
                        "grid h-[52px] w-12 place-items-center rounded-xl text-xl font-black transition-colors",
                        deltaSign === option.value
                          ? option.value > 0
                            ? "bg-secondary text-white"
                            : "bg-destructive text-white"
                          : "text-ink-3"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <CurrencyInput
                    id="adj-delta"
                    size="hero"
                    value={deltaValue}
                    onValueChange={(value) => {
                      setDeltaValue(value);
                      setConfirming(false);
                    }}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">
              Alasan penyesuaian <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setConfirming(false);
              }}
              maxLength={200}
              rows={2}
              disabled={isPending}
              placeholder="Mis. Uang tunai terpakai tanpa dicatat"
              className="min-h-[60px] rounded-xl border-2"
              required
            />
            <p className="text-[11px] font-semibold text-ink-3">
              Wajib diisi. Alasan inilah yang membuat koreksi bisa ditelusuri nanti.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-date">Tanggal</Label>
            <Input
              id="adj-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          {/* ------- Layar tinjau: angka utuh sebelum saldo benar-benar berubah ------- */}
          {confirming && delta !== 0 && (
            <div className="rounded-2xl border-2 border-primary bg-primary-light p-3.5">
              <p className="text-[11px] font-black uppercase tracking-wide text-primary">
                Periksa sebelum menyimpan
              </p>
              <div className="tabular mt-2 flex flex-wrap items-center gap-2 font-mono text-[15px] font-black text-ink-1">
                <span>{formatRupiah(balance)}</span>
                <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                <span>{formatRupiah(nextBalance)}</span>
              </div>
              <p
                className={cn(
                  "tabular mt-1 text-[13px] font-black",
                  delta > 0 ? "text-secondary-dark" : "text-destructive"
                )}
              >
                Selisih {delta > 0 ? "+" : "−"}
                {formatRupiah(Math.abs(delta))}
              </p>
              <p className="mt-1.5 break-words text-[12px] font-semibold text-ink-2">
                Alasan: {reason.trim()}
              </p>
            </div>
          )}

          {confirming ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <GameButton
                type="button"
                variant="outline"
                block
                disabled={isPending}
                onClick={() => setConfirming(false)}
              >
                Periksa lagi
              </GameButton>
              <GameButton type="button" variant="primary" block disabled={isPending} onClick={save}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Menyimpan…
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4" aria-hidden /> Simpan Penyesuaian
                  </>
                )}
              </GameButton>
            </div>
          ) : (
            <GameButton
              type="button"
              variant="primary"
              block
              disabled={isPending || loadingBalance || !reason.trim() || delta === 0}
              onClick={review}
            >
              Tinjau Penyesuaian
            </GameButton>
          )}
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
