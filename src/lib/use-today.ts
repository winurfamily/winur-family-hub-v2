"use client";

import { useEffect, useState } from "react";
import { todayISODate } from "@/lib/format";

/**
 * Tanggal hari ini ("YYYY-MM-DD", waktu Indonesia) yang ikut berganti sendiri.
 *
 * Nilai awalnya sama di server dan di browser — `todayISODate()` selalu
 * membaca zona Asia/Jakarta — jadi hidrasi tidak pernah bentrok. Setelah itu
 * nilainya disegarkan ketika aplikasi kembali dibuka (visibilitychange/focus),
 * supaya form yang ditinggalkan semalaman tidak menawarkan tanggal kemarin.
 */
export function useTodayJakarta(): string {
  const [today, setToday] = useState(todayISODate);

  useEffect(() => {
    const sync = () => setToday(todayISODate());
    sync();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return today;
}
