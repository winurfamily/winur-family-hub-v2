"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/finance/currency-input";
import { transferPocket, type PocketSummary } from "@/app/actions/keuangan";
import { formatRupiah } from "@/lib/format";

const MAIN = "main";

export function TransferForm({
  pockets,
  saldoUtama,
  bare = false,
  onDone,
}: {
  pockets: PocketSummary[];
  saldoUtama: number;
  /** Tanpa kartu & judul — dipakai saat form sudah berada di dalam sheet. */
  bare?: boolean;
  onDone?: () => void;
}) {
  const [fromValue, setFromValue] = useState(MAIN);
  const [toValue, setToValue] = useState<string>(pockets[0]?.id ?? "external");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Token idempotency: dibuat sekali per percobaan kirim, sehingga klik ganda
  // atau pengiriman ulang setelah jaringan putus tidak membuat dua transfer.
  const tokenRef = useRef<string | null>(null);

  const isExternal = toValue === "external";
  const fromPocket = fromValue === MAIN ? null : pockets.find((p) => p.id === fromValue);
  const available = fromPocket ? fromPocket.balance : saldoUtama;

  const validate = (): string | null => {
    if (amount <= 0) return "Nominal harus lebih dari 0.";
    if (amount > available) return `Saldo tidak cukup. Tersedia ${formatRupiah(available)}.`;
    if (fromValue !== MAIN && toValue === fromValue) return "Pocket asal dan tujuan tidak boleh sama.";
    if (isExternal && !note.trim()) return "Isi untuk apa transfer ini.";
    return null;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);

    if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

    startTransition(async () => {
      const result = await transferPocket({
        fromType: fromValue === MAIN ? "main" : "pocket",
        fromPocketId: fromValue === MAIN ? undefined : fromValue,
        toType: isExternal ? "external" : toValue === MAIN ? "main" : "pocket",
        toPocketId: isExternal || toValue === MAIN ? undefined : toValue,
        amount,
        note: note.trim() || undefined,
        clientToken: tokenRef.current!,
      });

      if (!result.success) {
        toast.error(result.error ?? "Gagal melakukan transfer.");
        setError(result.error ?? null);
        return;
      }

      toast.success("Transfer berhasil.");
      tokenRef.current = null;
      setAmount(0);
      setNote("");
      onDone?.();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={bare ? "space-y-3" : "space-y-3 rounded-[20px] bg-card p-4 shadow-card sm:p-5"}
      noValidate
    >
      {!bare && (
        <h2 className="flex items-center gap-2 font-heading text-base font-black text-ink-1">
          <ArrowRightLeft className="h-4 w-4 text-accent" aria-hidden /> Pindahkan Dana
        </h2>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="transfer-from">Dari</Label>
          <Select value={fromValue} onValueChange={setFromValue}>
            <SelectTrigger id="transfer-from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MAIN}>Saldo Utama</SelectItem>
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
          <Label htmlFor="transfer-to">Ke</Label>
          <Select value={toValue} onValueChange={setToValue}>
            <SelectTrigger id="transfer-to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pockets
                .filter((p) => p.id !== fromValue)
                .map((pocket) => (
                  <SelectItem key={pocket.id} value={pocket.id}>
                    {pocket.name}
                  </SelectItem>
                ))}
              {fromValue !== MAIN && <SelectItem value={MAIN}>Saldo Utama</SelectItem>}
              <SelectItem value="external">Luar Pocket (pengeluaran langsung)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transfer-amount">Nominal</Label>
        <CurrencyInput id="transfer-amount" value={amount} onValueChange={setAmount} disabled={isPending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transfer-note">{isExternal ? "Untuk apa" : "Catatan (opsional)"}</Label>
        <Input
          id="transfer-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          disabled={isPending}
          placeholder={isExternal ? "Contoh: bayar listrik" : "Catatan tambahan"}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}

      <GameButton type="submit" variant="secondary" block disabled={isPending}>
        {isPending ? "Memproses…" : "Transfer"}
      </GameButton>
    </form>
  );
}
