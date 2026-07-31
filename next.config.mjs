import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Prefetch-caching navigasi SENGAJA dimatikan. Kedua opsi ini menyimpan
  // halaman (beserta payload RSC-nya) ke Cache Storage begitu tautannya
  // terlihat/di-hover, lalu menyajikannya kembali pada kunjungan berikutnya.
  // Untuk aplikasi keuangan efeknya berbahaya: angka saldo yang sudah berubah
  // di server masih bisa tampil dari cache perangkat setelah refresh, sehingga
  // nominal lama seolah "hidup lagi" walau datanya sudah tidak ada.
  // Aset statis (ikon, font, gambar) tetap di-cache seperti biasa.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
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
