/**
 * Decision #3 / #9 (06_DECISION_LOG.md): build APK (Capacitor) hanya mode
 * anak — profile picker, login, dan routing admin disembunyikan total saat
 * NEXT_PUBLIC_MODE=apk. Default (tidak diset / "web") = aplikasi web penuh
 * (admin + anak), dipakai untuk deployment Vercel utama.
 */
export const APP_MODE: "web" | "apk" = process.env.NEXT_PUBLIC_MODE === "apk" ? "apk" : "web";

export const isApkMode = APP_MODE === "apk";
