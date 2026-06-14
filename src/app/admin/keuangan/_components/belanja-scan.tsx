"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Trash2, Plus } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  scanReceipt,
  addShoppingTransaction,
  addShoppingTransactionsBatch,
  type PocketSummary,
  type ScannedItem,
  type ScanReceiptResult,
} from "@/app/actions/keuangan";
import { formatRupiah, todayISODate } from "@/lib/format";
import { MAIN_POCKET_VALUE } from "@/lib/validation/keuangan";

type ScanMode = "quick" | "full";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BelanjaScan({ pockets }: { pockets: PocketSummary[] }) {
  const [mode, setMode] = useState<ScanMode>("quick");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<ScanReceiptResult | null>(null);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [quickTotal, setQuickTotal] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [pocketId, setPocketId] = useState(MAIN_POCKET_VALUE);
  const [isScanning, startScan] = useTransition();
  const [isSaving, startSave] = useTransition();

  const reset = () => {
    setPreview(null);
    setImageBase64(null);
    setResult(null);
    setItems([]);
    setQuickTotal(0);
    setStoreName("");
  };

  const handleFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setImageBase64(dataUrl);
    setPreview(dataUrl);
    setResult(null);
    setItems([]);
  };

  const handleScan = () => {
    if (!imageBase64) return;
    startScan(async () => {
      const res = await scanReceipt(imageBase64, mode);
      if (!res.success) {
        toast.error(res.error ?? "Gagal membaca struk.");
        return;
      }
      setResult(res);
      setStoreName(res.storeName ?? "Belanja");
      if (res.date) setDate(res.date);
      if (mode === "quick") setQuickTotal(res.total ?? 0);
      if (mode === "full") setItems(res.items ?? []);
    });
  };

  const updateItem = (index: number, patch: Partial<ScannedItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { name: "", qty: 1, price: 0 }]);
  };

  const fullTotal = items.reduce((acc, item) => acc + Number(item.qty || 0) * Number(item.price || 0), 0);

  const handleSave = () => {
    const finalPocketId = pocketId === MAIN_POCKET_VALUE ? null : pocketId;

    startSave(async () => {
      const res =
        mode === "quick"
          ? await addShoppingTransaction({
              name: storeName.trim() || "Belanja",
              qty: 1,
              price: quickTotal,
              date,
              pocketId: finalPocketId,
              source: "scan",
            })
          : await addShoppingTransactionsBatch({ pocketId: finalPocketId, date, source: "scan", items });

      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan belanja.");
        return;
      }

      toast.success("Belanja dari scan berhasil disimpan.");
      reset();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
        <h2 className="font-heading font-extrabold text-ink-1 flex items-center gap-2">
          <Camera className="w-5 h-5 text-accent" /> Scan Struk (AI)
        </h2>

        <div className="flex gap-2">
          <GameButton
            type="button"
            variant={mode === "quick" ? "primary" : "outline"}
            size="sm"
            playSound={false}
            onClick={() => {
              setMode("quick");
              setResult(null);
            }}
          >
            Quick Scan
          </GameButton>
          <GameButton
            type="button"
            variant={mode === "full" ? "primary" : "outline"}
            size="sm"
            playSound={false}
            onClick={() => {
              setMode("full");
              setResult(null);
            }}
          >
            Full Scan
          </GameButton>
        </div>
        <p className="text-xs text-ink-2">
          {mode === "quick"
            ? "Quick scan membaca total belanja dari struk (1 baris transaksi)."
            : "Full scan membaca daftar item & harga satuan dari struk."}
        </p>

        <Input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview struk" className="rounded-xl border-2 border-border max-h-64 object-contain mx-auto" />
        )}

        {preview && !result && (
          <GameButton type="button" variant="accent" block onClick={handleScan} disabled={isScanning}>
            {isScanning ? "Membaca struk..." : "Baca Struk dengan AI"}
          </GameButton>
        )}
      </div>

      {result && (
        <div className="rounded-2xl border-2 border-border bg-card shadow-card p-4 space-y-3">
          <h3 className="font-heading font-extrabold text-ink-1">Hasil Scan</h3>

          <div className="space-y-1">
            <Label>Nama Toko</Label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </div>

          {mode === "quick" ? (
            <div className="space-y-1">
              <Label>Total Belanja (Rp)</Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={quickTotal}
                onChange={(e) => setQuickTotal(Number(e.target.value) || 0)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Item Belanja</Label>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_56px_88px_32px] gap-2 items-center">
                  <Input
                    value={item.name}
                    placeholder="Nama item"
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: Number(e.target.value) || 1 })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    value={item.price}
                    onChange={(e) => updateItem(index, { price: Number(e.target.value) || 0 })}
                  />
                  <button type="button" onClick={() => removeItem(index)} aria-label="Hapus item">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
              <GameButton type="button" variant="outline" size="sm" block onClick={addItemRow}>
                <Plus className="w-4 h-4" /> Tambah Item
              </GameButton>
              <p className="text-sm text-ink-2 text-right">
                Total: <span className="font-heading font-extrabold text-ink-1">{formatRupiah(fullTotal)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sumber Dana</Label>
              <Select value={pocketId} onValueChange={setPocketId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN_POCKET_VALUE}>Saldo Utama</SelectItem>
                  {pockets.map((pocket) => (
                    <SelectItem key={pocket.id} value={pocket.id}>
                      {pocket.name} ({formatRupiah(pocket.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <GameButton type="button" variant="secondary" block onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Belanja"}
          </GameButton>
        </div>
      )}
    </div>
  );
}
