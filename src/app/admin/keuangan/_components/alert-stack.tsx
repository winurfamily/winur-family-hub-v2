"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, TriangleAlert, X } from "lucide-react";
import type { FinanceAlert } from "@/lib/budget-alerts";
import { cn } from "@/lib/utils";

/**
 * Peringatan keuangan sebagai TUMPUKAN KARTU, bukan popup.
 *
 * Kenapa bukan popup/toast: anggaran dihitung ulang setiap halaman dimuat,
 * jadi popup akan muncul lagi setiap kali menu Keuangan dibuka — sampai
 * orangnya berhenti membacanya sama sekali. Kartu bisa dibaca sekilas,
 * ditutup, dan tetap ditemukan lagi di tab Anggaran kapan pun dibutuhkan.
 *
 * Yang ditutup pengguna diingat di localStorage per-id. Karena id memuat
 * ambang yang terlampaui (`budget:makanan:2026-08:75`), menutup peringatan 75%
 * TIDAK ikut membungkam peringatan 90% yang muncul kemudian — kenaikan
 * tingkat selalu terlihat lagi.
 *
 * Paling banyak tiga kartu tampil sekaligus; sisanya di balik "lihat lainnya"
 * supaya bilah peringatan tidak pernah mendorong saldo keluar layar.
 */

const STORAGE_KEY = "winur:dismissed-alerts";
const VISIBLE_LIMIT = 3;

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const STYLES = {
  danger: {
    Icon: AlertTriangle,
    wrap: "bg-destructive/10",
    icon: "text-destructive",
    title: "text-destructive",
  },
  warning: {
    Icon: TriangleAlert,
    wrap: "bg-amber-100/80",
    icon: "text-amber-700",
    title: "text-amber-800",
  },
  info: {
    Icon: Info,
    wrap: "bg-accent-light",
    icon: "text-accent",
    title: "text-ink-1",
  },
} as const;

export function AlertStack({
  alerts,
  onNavigate,
}: {
  alerts: FinanceAlert[];
  onNavigate?: (target: NonNullable<FinanceAlert["target"]>) => void;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Dibaca setelah mount: localStorage tidak ada di server, dan membacanya
  // saat render membuat markup server berbeda dari hasil hidrasi.
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = useMemo(
    () => alerts.filter((alert) => !dismissed.includes(alert.id)),
    [alerts, dismissed]
  );

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      // Hanya 50 id terakhir yang disimpan — peringatan bulan lama tidak
      // pernah muncul lagi, jadi menyimpannya selamanya hanya menumpuk sampah.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      // Mode privat / storage penuh: penutupan tetap berlaku untuk sesi ini.
    }
  };

  const shown = expanded ? visible : visible.slice(0, VISIBLE_LIMIT);
  const hidden = visible.length - shown.length;

  return (
    <section aria-label="Peringatan keuangan" className="space-y-2">
      {shown.map((alert) => {
        const style = STYLES[alert.level];
        const Icon = style.Icon;
        const clickable = Boolean(alert.target && onNavigate);

        return (
          <div
            key={alert.id}
            role={clickable ? undefined : "status"}
            className={cn("flex items-start gap-2.5 rounded-[18px] p-3.5", style.wrap)}
          >
            <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", style.icon)} aria-hidden />

            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] font-black leading-snug", style.title)}>{alert.title}</p>
              <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-ink-2">
                {alert.message}
              </p>
              {clickable && (
                <button
                  type="button"
                  onClick={() => onNavigate!(alert.target!)}
                  className="mt-1.5 min-h-8 text-[12px] font-black text-primary underline-offset-2 hover:underline"
                >
                  Buka {TARGET_LABELS[alert.target!]}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              aria-label={`Tutup peringatan: ${alert.title}`}
              className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-9 w-full rounded-[14px] bg-surface-2 text-[12px] font-black text-ink-2 transition-transform duration-150 active:scale-[0.99]"
        >
          Lihat {hidden} peringatan lainnya
        </button>
      )}
    </section>
  );
}

const TARGET_LABELS: Record<NonNullable<FinanceAlert["target"]>, string> = {
  anggaran: "Anggaran",
  transaksi: "Transaksi",
  dompet: "Dompet",
  rutin: "Rutin",
};
