import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    // Berkas audio TIDAK ikut di-precache service worker (B.1). Halaman awal
    // tidak memutar musik sama sekali, jadi mengunduhnya di muka hanya
    // membuang kuota — dan menyisakan berkas BGM lama di cache perangkat
    // yang sudah pernah membuka versi sebelumnya.
    exclude: [/\.mp3$/i, /\.ogg$/i, /\.wav$/i, /\.m4a$/i],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Foto struk dari kamera HP bisa >1MB setelah di-encode base64,
      // melebihi limit default Server Actions (1MB).
      bodySizeLimit: "10mb",
    },
  },
};

export default withPWA(nextConfig);
