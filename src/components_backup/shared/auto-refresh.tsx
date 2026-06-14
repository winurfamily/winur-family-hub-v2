"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** Interval polling dalam milidetik (default 30 detik). */
  intervalMs?: number;
}

/**
 * Polling-based refresh untuk halaman anak (pengganti Supabase Realtime,
 * karena auth custom PIN tidak kompatibel dengan auth.uid() Realtime/RLS).
 * Memanggil router.refresh() berkala saat tab aktif agar saldo/point/xp,
 * status task, dan notifikasi tetap up-to-date setelah admin approve.
 */
export function AutoRefresh({ intervalMs = 30000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
