import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
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
