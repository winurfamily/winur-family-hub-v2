"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { uploadReceipt, deleteReceipt } from "@/app/actions/receipts";
import { compressImage, formatBytes, ACCEPTED_MIME } from "@/lib/image-compress";

export interface AttachedReceipt {
  id: string;
  previewUrl: string;
  bytes: number;
}

/**
 * Unggah bukti struk (opsional).
 *
 * Alurnya: pilih/potret → kompres di browser → unggah → dapat id.
 * Struk diunggah LEBIH DULU dan baru ditautkan saat transaksi tersimpan,
 * sehingga transaksi tidak pernah tersimpan setengah jadi karena unggahan
 * gagal (F3.9). Berkas yang terlanjur terunggah lalu dibatalkan menjadi
 * "file lepas" yang bisa dibersihkan dari halaman Penggunaan Storage.
 */
export function ReceiptUploader({
  value,
  onChange,
  disabled,
}: {
  value: AttachedReceipt | null;
  onChange: (receipt: AttachedReceipt | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<"compress" | "upload" | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      setBusy("compress");
      const compressed = await compressImage(file);

      setBusy("upload");
      const result = await uploadReceipt({
        dataUrl: compressed.dataUrl,
        width: compressed.width,
        height: compressed.height,
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Gagal mengunggah struk.");
        return;
      }

      // Buang struk lama supaya tidak menumpuk saat pengguna mengganti gambar.
      if (value) void deleteReceipt(value.id);

      onChange({
        id: result.data.id,
        previewUrl: compressed.dataUrl,
        bytes: result.data.fileSize,
      });
      toast.success(`Struk terunggah (${formatBytes(result.data.fileSize)}).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses gambar.");
    } finally {
      setBusy(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    const removed = value;
    onChange(null);
    const result = await deleteReceipt(removed.id);
    if (!result.success) toast.error(result.error ?? "Gagal menghapus struk.");
  };

  const isBusy = busy !== null || disabled;

  return (
    <div className="space-y-2">
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        capture="environment"
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt="Pratinjau bukti struk"
            className="max-h-64 w-full object-contain"
          />
          <div className="flex items-center justify-between gap-2 border-t-2 border-border bg-card px-3 py-2">
            <span className="text-[11px] font-bold text-ink-3">{formatBytes(value.bytes)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => galleryRef.current?.click()}
                className="tap-target flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-ink-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Ganti
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleRemove()}
                className="tap-target flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 text-xs font-extrabold text-destructive disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
              </button>
            </div>
          </div>
        </div>
      ) : busy ? (
        <div className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-surface-2 text-ink-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          <span className="text-xs font-bold">
            {busy === "compress" ? "Mengompres gambar…" : "Mengunggah struk…"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-surface-2 text-ink-2 transition-colors active:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera className="h-5 w-5" aria-hidden />
            <span className="text-xs font-extrabold">Ambil Foto</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => galleryRef.current?.click()}
            className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-surface-2 text-ink-2 transition-colors active:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            <span className="text-xs font-extrabold">Dari Galeri</span>
          </button>
        </div>
      )}

      <p className="text-[11px] font-semibold text-ink-3">
        Opsional · JPG, PNG, atau WEBP · maksimal 10 MB. Gambar otomatis dikompres sebelum diunggah.
      </p>
    </div>
  );
}
