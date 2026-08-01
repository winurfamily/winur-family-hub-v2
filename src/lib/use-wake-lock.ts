"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Jaga layar tetap menyala selama checklist belanja dipakai.
 *
 * Layar yang mati setiap 30 detik sambil mendorong troli berarti membuka
 * kunci berkali-kali dengan satu tangan penuh belanjaan. Wake Lock API
 * menyelesaikannya, tetapi TIDAK ADA DI SEMUA BROWSER (Safari iOS baru
 * mendukungnya sejak 16.4, dan konteks non-HTTPS tidak dapat memakainya sama
 * sekali).
 *
 * Karena itu hook ini tidak pernah mengasumsikan keberhasilan:
 *  - `supported` menyatakan apakah API-nya ada, sehingga UI bisa menyembunyikan
 *    tombolnya alih-alih menawarkan sesuatu yang pasti gagal;
 *  - permintaan yang ditolak (baterai lemah, tab tidak aktif) hanya membuat
 *    `active` kembali false — tanpa error yang mengganggu;
 *  - kunci diminta ulang saat tab kembali terlihat, karena browser MELEPASNYA
 *    setiap kali halaman tersembunyi. Tanpa ini, fiturnya mati diam-diam
 *    setelah pengguna sempat membuka aplikasi lain.
 */

/** `WakeLockSentinel` belum ada di lib DOM TypeScript versi proyek ini. */
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function wakeLockApi(): WakeLockLike | null {
  if (typeof navigator === "undefined") return null;
  const api = (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
  return api && typeof api.request === "function" ? api : null;
}

export interface WakeLockState {
  /** Browser menyediakan Wake Lock API. */
  supported: boolean;
  /** Kunci sedang aktif. */
  active: boolean;
  /** Pengguna meminta layar tetap menyala (niat, terlepas dari hasilnya). */
  enabled: boolean;
  toggle: () => void;
}

export function useWakeLock(): WakeLockState {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  // Dicek setelah mount, bukan saat render: server tidak punya `navigator`,
  // dan menebaknya akan membuat markup server berbeda dari hasil hidrasi.
  useEffect(() => {
    setSupported(wakeLockApi() !== null);
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (sentinel && !sentinel.released) {
      await sentinel.release().catch(() => {});
    }
  }, []);

  const acquire = useCallback(async () => {
    const api = wakeLockApi();
    if (!api || sentinelRef.current) return;
    try {
      const sentinel = await api.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => {
        sentinelRef.current = null;
        setActive(false);
      });
    } catch {
      // Ditolak browser (baterai lemah, tab tidak aktif, kebijakan sistem).
      // Bukan keadaan gagal yang perlu diributkan — checklist tetap berfungsi.
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }

    void acquire();

    // Browser melepas kunci setiap tab tersembunyi; minta lagi saat kembali.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && enabled) void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [enabled, acquire, release]);

  return {
    supported,
    active,
    enabled,
    toggle: () => setEnabled((value) => !value),
  };
}
