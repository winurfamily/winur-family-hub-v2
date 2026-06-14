import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Decision #3 (06_DECISION_LOG.md): Capacitor -> APK Android, hanya mode anak.
 *
 * App ini memakai Next.js Server Actions + cookie session (bukan static
 * export), jadi WebView memuat APP_URL langsung (remote URL) alih-alih
 * bundel statis di `webDir`. APP_URL HARUS mengarah ke deployment dengan
 * NEXT_PUBLIC_MODE=apk (lihat Docs/07_APK_BUILD.md) -- gunakan deployment
 * Vercel terpisah dari deployment web admin utama, supaya /admin tetap
 * aktif untuk web sementara APK hanya bisa mengakses /child/*.
 */
const APP_URL = process.env.CAPACITOR_APP_URL ?? "https://winur-family-hub-apk.vercel.app";

const config: CapacitorConfig = {
  appId: "com.winur.familyhub",
  appName: "Winur Family Hub",
  webDir: "www",
  server: {
    url: APP_URL,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#FF6B35",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FF6B35",
      overlaysWebView: false,
    },
  },
};

export default config;
