/** Sisi terpanjang maksimum setelah kompresi (F3.5). */
export const MAX_DIMENSION = 1600;

/** Target ukuran ideal hasil kompresi. */
export const TARGET_BYTES = 500 * 1024;

/** Batas ukuran berkas asli yang boleh dipilih pengguna. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export interface CompressedImage {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  mimeType: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca."));
    };
    img.src = url;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, mime: string, quality: number): string {
  return canvas.toDataURL(mime, quality);
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  // Setiap 4 karakter base64 = 3 byte, dikurangi padding "=".
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Kompres foto struk di browser sebelum diunggah.
 *
 * Strategi: perkecil dulu sisi terpanjang ke 1600px, lalu turunkan kualitas
 * bertahap sampai mendekati 500 KB. Kualitas berhenti di 0,55 — di bawah itu
 * angka pada struk mulai pecah dan tidak terbaca lagi, dan tujuan berkas ini
 * adalah bukti yang bisa dibaca, bukan berkas sekecil mungkin.
 *
 * WEBP dipakai bila browser mendukungnya (lebih kecil pada kualitas setara);
 * jika tidak, otomatis jatuh ke JPEG.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error("Format harus JPG, PNG, atau WEBP.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Ukuran gambar melebihi 10 MB.");
  }

  const img = await loadImage(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung kompresi gambar.");

  // Latar putih supaya PNG transparan tidak jadi hitam saat dikonversi ke JPEG.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const webpSupported = canvas.toDataURL("image/webp", 0.8).startsWith("data:image/webp");
  const mimeType = webpSupported ? "image/webp" : "image/jpeg";

  let quality = 0.82;
  let dataUrl = canvasToDataUrl(canvas, mimeType, quality);
  let bytes = dataUrlBytes(dataUrl);

  while (bytes > TARGET_BYTES && quality > 0.55) {
    quality = Number((quality - 0.09).toFixed(2));
    dataUrl = canvasToDataUrl(canvas, mimeType, quality);
    bytes = dataUrlBytes(dataUrl);
  }

  return { dataUrl, bytes, width, height, mimeType };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
