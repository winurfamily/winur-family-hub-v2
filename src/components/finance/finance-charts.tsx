"use client";

import { useId, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah, formatNumber } from "@/lib/format";
import type { TrendPoint, CategoryBreakdown } from "@/app/actions/dashboard";

/**
 * Warna seri keuangan.
 *
 * Pasangan hijau/oranye ini dipilih setelah divalidasi untuk keterbacaan
 * defisiensi warna: pada #256F2A ↔ #F79009 pemisahan protan ΔE 18,7 dan
 * penglihatan normal ΔE 33,2 — jauh di atas ambang. Kombinasi hijau/merah
 * "alami" (#2E7D32 ↔ #D84315) hanya mencapai ΔE 5,4 pada protan dan praktis
 * menyatu bagi sebagian pembaca, jadi sengaja tidak dipakai.
 *
 * Oranye di bawah rasio kontras 3:1 terhadap kartu putih, sehingga setiap
 * grafik yang memakainya WAJIB menyertakan label nilai atau tampilan tabel —
 * identitas tidak pernah bergantung pada warna saja.
 */
export const SERIES = {
  income: "#256F2A",
  expense: "#F79009",
  transfer: "#6D28D9",
} as const;

/** Ramp sekuensial satu warna untuk peringkat besaran kategori. */
const CATEGORY_RAMP = ["#7A3E00", "#9A5000", "#B86100", "#D17300", "#E88600", "#F79009", "#FBA83D"];

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/** Ringkas ke "1,2jt" / "850rb" untuk sumbu — angka penuh tetap ada di tabel & tooltip. */
function compactRupiah(value: number): string {
  if (value >= 1_000_000_000) return `${formatNumber(Number((value / 1_000_000_000).toFixed(1)))}m`;
  if (value >= 1_000_000) return `${formatNumber(Number((value / 1_000_000).toFixed(1)))}jt`;
  if (value >= 1_000) return `${formatNumber(Math.round(value / 1_000))}rb`;
  return formatNumber(value);
}

// ---------------------------------------------------------------------------
// Tren pendapatan vs pengeluaran
// ---------------------------------------------------------------------------

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();

  const max = niceCeiling(Math.max(1, ...data.flatMap((d) => [d.income, d.expense])));
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  return (
    <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5" aria-labelledby={titleId}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="font-heading text-base font-black text-ink-1">
            Tren 6 Bulan
          </h2>
          <p className="text-[11px] font-semibold text-ink-3">Pendapatan dibanding pengeluaran</p>
        </div>
        <button
          type="button"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
          aria-label={view === "chart" ? "Tampilkan sebagai tabel" : "Tampilkan sebagai grafik"}
          className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-ink-2 transition-colors active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {view === "chart" ? <Table2 className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
        </button>
      </header>

      {/* Legenda selalu ada untuk 2 seri — identitas tidak hanya lewat warna. */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendSwatch color={SERIES.income} label="Pendapatan" />
        <LegendSwatch color={SERIES.expense} label="Pengeluaran" />
      </div>

      {!hasData ? (
        <EmptyChart message="Belum ada catatan pendapatan atau pengeluaran pada rentang ini." />
      ) : view === "table" ? (
        <TrendTable data={data} />
      ) : (
        <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: 168 }}>
          {data.map((point) => (
            <TrendColumn key={point.month} point={point} max={max} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrendColumn({ point, max }: { point: TrendPoint; max: number }) {
  const bar = (value: number, color: string, label: string) => {
    // Tinggi minimum 3px agar nilai kecil-tapi-bukan-nol tetap terlihat.
    const height = value > 0 ? Math.max(3, (value / max) * 130) : 0;
    return (
      <div
        className="group relative flex-1"
        style={{ height: 130, display: "flex", alignItems: "flex-end" }}
      >
        <div
          className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
          style={{ height, backgroundColor: color, minHeight: value > 0 ? 3 : 0 }}
        />
        {/* Tooltip muncul saat hover/fokus; nilai penuh, bukan versi ringkas. */}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-1 px-2 py-1 text-[11px] font-bold text-white shadow-card group-hover:block"
        >
          {label}: {formatRupiah(value)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      {/* Jarak 2px antar batang bersebelahan (gap-0.5) memisahkan isian. */}
      <div className="flex w-full items-end gap-0.5">
        {bar(point.income, SERIES.income, "Pendapatan")}
        {bar(point.expense, SERIES.expense, "Pengeluaran")}
      </div>
      <span className="text-[10px] font-bold text-ink-3">{point.label}</span>
    </div>
  );
}

function TrendTable({ data }: { data: TrendPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-xs">
        <thead>
          <tr className="text-ink-3">
            <th scope="col" className="pb-1.5 font-bold">
              Bulan
            </th>
            <th scope="col" className="pb-1.5 text-right font-bold">
              Pendapatan
            </th>
            <th scope="col" className="pb-1.5 text-right font-bold">
              Pengeluaran
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((point) => (
            <tr key={point.month}>
              <th scope="row" className="py-1.5 font-bold text-ink-2">
                {point.label}
              </th>
              <td className="tabular py-1.5 text-right font-semibold text-ink-1">
                {formatRupiah(point.income)}
              </td>
              <td className="tabular py-1.5 text-right font-semibold text-ink-1">
                {formatRupiah(point.expense)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pengeluaran per kategori
// ---------------------------------------------------------------------------

export function CategoryChart({ data }: { data: CategoryBreakdown[] }) {
  const titleId = useId();
  const top = data.slice(0, 7);

  return (
    <section className="rounded-[20px] bg-card p-4 shadow-card sm:p-5" aria-labelledby={titleId}>
      <h2 id={titleId} className="font-heading text-base font-black text-ink-1">
        Pengeluaran per Kategori
      </h2>
      <p className="mb-3 text-[11px] font-semibold text-ink-3">Diurutkan dari yang terbesar</p>

      {top.length === 0 ? (
        <EmptyChart message="Belum ada pengeluaran tercatat pada rentang ini." />
      ) : (
        /* Batang peringkat besaran: satu warna dengan gradasi terang→gelap,
           bukan warna kategorikal, karena yang dibandingkan adalah nilainya. */
        <ul className="space-y-2.5">
          {top.map((row, index) => (
            <li key={row.category}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-bold text-ink-2">{row.label}</span>
                <span className="tabular shrink-0 font-extrabold text-ink-1">
                  {formatRupiah(row.amount)}
                  <span className="ml-1.5 font-semibold text-ink-3">{Math.round(row.percent)}%</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, row.percent)}%`,
                    backgroundColor: CATEGORY_RAMP[Math.min(index, CATEGORY_RAMP.length - 1)],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bagian bersama
// ---------------------------------------------------------------------------

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-2">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="rounded-2xl bg-surface-2 px-4 py-8 text-center text-xs font-semibold text-ink-3">
      {message}
    </p>
  );
}

/** Meter progres satu pocket. */
export function PocketMeter({
  name,
  balance,
  percent,
  isLow,
}: {
  name: string;
  balance: number;
  percent: number;
  isLow: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-bold text-ink-2">
          {name}
          {isLow && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px text-[9px] font-extrabold uppercase text-destructive">
              Hampir habis
            </span>
          )}
        </span>
        <span className="tabular shrink-0 font-extrabold text-ink-1">{formatRupiah(balance)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", isLow ? "bg-destructive" : "bg-info")}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

export { compactRupiah };
