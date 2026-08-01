"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, RotateCcw, ScanLine } from "lucide-react";
import { GameButton } from "@/components/ui/game-button";
import { ShoppingForm } from "./shopping-form";
import { ReceiptImport } from "./receipt-import";
import type { AttachedReceipt } from "./receipt-uploader";
import { scanReceipt, type ScannedItem } from "@/app/actions/scan";
import { uploadReceipt } from "@/app/actions/receipts";
import { compressImage, formatBytes, ACCEPTED_MIME } from "@/lib/image-compress";
import { todayISODate } from "@/lib/format";
import type { PocketSummary } from "@/app/actions/keuangan";

interface ScanDraft {
  merchant: string;
  date: string;
  items: ScannedItem[];
  receipt: AttachedReceipt | null;
  /** Diisi bila AI gagal membaca, agar pengguna tetap bisa lanjut manual. */
  warning?: string;
}

/**
 * Scan AI → layar review → simpan.
 *
 * Hasil pembacaan AI TIDAK PERNAH langsung disimpan (F5.4/F5.9). Yang
 * dikembalikan model hanya mengisi nilai awal form; transaksi baru tercipta
 * setelah pengguna menekan tombol simpan pada form review. Kalau pembacaan
 * gagal, form tetap dibuka dalam keadaan kosong supaya pengguna bisa
 * meneruskan secara manual tanpa mengulang dari awal.
 */
export function BelanjaScan({ pockets, saldoUtama }: { pockets: PocketSummary[]; saldoUtama: number }) {
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [phase, setPhase] = useState<"idle" | "compress" | "upload" | "reading">("idle");
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle" || isPending;

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    startTransition(async () => {
      let receipt: AttachedReceipt | null = null;

      try {
        setPhase("compress");
        const compressed = await compressImage(file);

        // Struk disimpan lebih dulu supaya tetap tersimpan walau pembacaan AI
        // gagal — foto yang sudah diambil tidak hilang percuma.
        setPhase("upload");
        const uploaded = await uploadReceipt({
          dataUrl: compressed.dataUrl,
          width: compressed.width,
          height: compressed.height,
        });

        if (uploaded.success && uploaded.data) {
          receipt = {
            id: uploaded.data.id,
            previewUrl: compressed.dataUrl,
            bytes: uploaded.data.fileSize,
          };
          toast.success(`Struk tersimpan (${formatBytes(uploaded.data.fileSize)}).`);
        } else {
          toast.error(uploaded.error ?? "Struk gagal diunggah, tetapi scan tetap dilanjutkan.");
        }

        setPhase("reading");
        const result = await scanReceipt(compressed.dataUrl);

        if (!result.success) {
          setDraft({
            merchant: "",
            date: todayISODate(),
            items: [],
            receipt,
            warning: result.error ?? "Struk tidak terbaca. Silakan isi manual di bawah ini.",
          });
          return;
        }

        setDraft({
          merchant: result.storeName ?? "",
          date: result.date ?? todayISODate(),
          items: result.items ?? [],
          receipt,
        });
        toast.success("Struk terbaca. Periksa dan perbaiki bila ada yang salah.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memproses gambar.");
      } finally {
        setPhase("idle");
        if (cameraRef.current) cameraRef.current.value = "";
        if (galleryRef.current) galleryRef.current.value = "";
      }
    });
  };

  if (draft) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 rounded-[18px] bg-card p-4 shadow-card">
          <div className="min-w-0">
            <p className="font-heading text-sm font-black text-ink-1">Periksa hasil pembacaan</p>
            <p className="mt-0.5 text-xs font-semibold text-ink-2">
              {draft.warning ??
                "Semua kolom bisa diperbaiki. Transaksi baru tersimpan setelah kamu menekan tombol simpan."}
            </p>
          </div>
          <GameButton
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => setDraft(null)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Ulangi
          </GameButton>
        </div>

        <ShoppingForm
          key={draft.receipt?.id ?? "scan-draft"}
          pockets={pockets}
          saldoUtama={saldoUtama}
          origin="scan"
          initialReceipt={draft.receipt}
          submitLabel="Simpan Hasil Scan"
          defaults={{
            merchant: draft.merchant,
            date: draft.date,
            items: draft.items.length > 0 ? draft.items : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] bg-card p-5 text-center shadow-card">
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {busy ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-ink-2">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-bold">
            {phase === "compress"
              ? "Mengompres gambar…"
              : phase === "upload"
                ? "Menyimpan struk…"
                : "AI sedang membaca struk…"}
          </p>
        </div>
      ) : (
        <>
          <span
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent"
          >
            <ScanLine className="h-7 w-7" />
          </span>
          <h2 className="mt-3 font-heading text-base font-black text-ink-1">Scan Struk dengan AI</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-ink-3">
            Potret struk belanja, biarkan AI membaca nama toko, tanggal, dan daftar barangnya. Kamu
            tetap bisa memperbaiki semua hasilnya sebelum disimpan.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <GameButton type="button" variant="primary" block onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" aria-hidden /> Ambil Foto
            </GameButton>
            <GameButton type="button" variant="outline" block onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" aria-hidden /> Dari Galeri
            </GameButton>
          </div>
        </>
      )}
      </div>

      {/* Jalur kedua pada pipeline Scan yang SAMA: bukan menuju transaksi
          langsung, melainkan menuju rencana baru yang harus ditinjau dulu.
          Dipakai untuk struk panjang berhalaman banyak. */}
      {!busy && <ReceiptImport />}
    </div>
  );
}
