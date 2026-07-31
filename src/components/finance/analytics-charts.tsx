"use client";

import * as React from "react";
import { Panel, SectionTitle, EmptyState } from "./ui";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Grafik analitik keuangan — SVG murni, tanpa pustaka chart tambahan.
 *
 * Berkas ini di-`dynamic import` dari Keuangan sehingga tidak ikut terunduh
 * saat Ayah/Mamah hanya membuka Ringkasan atau Dompet.
 *
 * Palet kategorikal memakai urutan slot tetap yang sudah divalidasi terhadap
 * kebutaan warna (protan/deutan/tritan) di atas permukaan kartu putih; warna
 * dipilih menurut identitas kategori, bukan peringkatnya, dan tidak pernah
 * diputar ulang. Tiga slot berada di bawah kontras 3:1, jadi setiap irisan
 * WAJIB tetap punya label teks — itulah kenapa daftar peringkat di bawah donat
 * bukan hiasan tapi bagian dari keterbacaannya.
 */
const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

export interface CategorySlice {
  key: string;
  label: string;
  value: number;
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
}

/** Maksimal irisan sebelum sisanya dilipat jadi "Lainnya". */
const MAX_SLICES = 8;

function foldTail(slices: CategorySlice[]): CategorySlice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value).filter((s) => s.value > 0);
  if (sorted.length <= MAX_SLICES) return sorted;

  const head = sorted.slice(0, MAX_SLICES - 1);
  const tail = sorted.slice(MAX_SLICES - 1);
  return [
    ...head,
    { key: "__other", label: "Lainnya", value: tail.reduce((acc, s) => acc + s.value, 0) },
  ];
}

export function CategoryDonut({
  title,
  slices,
  emptyText,
}: {
  title: string;
  slices: CategorySlice[];
  emptyText: string;
}) {
  const data = React.useMemo(() => foldTail(slices), [slices]);
  const total = data.reduce((acc, s) => acc + s.value, 0);
  const [hover, setHover] = React.useState<string | null>(null);

  if (total <= 0) {
    return (
      <Panel className="p-4">
        <SectionTitle title={title} />
        <div className="mt-3">
          <EmptyState title="Belum ada data" text={emptyText} />
        </div>
      </Panel>
    );
  }

  // Geometri donat: keliling dipakai sebagai satuan panjang irisan sehingga
  // celah 2px antar irisan bisa dipotong langsung dari panjangnya.
  const size = 200;
  const stroke = 30;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;

  let offset = 0;
  const arcs = data.map((slice, index) => {
    const length = (slice.value / total) * circumference;
    const arc = {
      ...slice,
      color: SERIES[index % SERIES.length],
      dash: Math.max(1, length - gap),
      offset,
      percent: (slice.value / total) * 100,
    };
    offset += length;
    return arc;
  });

  const active = arcs.find((a) => a.key === hover);

  return (
    <Panel className="p-4">
      <SectionTitle title={title} />

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="h-[180px] w-[180px] -rotate-90 sm:h-[200px] sm:w-[200px]"
            role="img"
            aria-label={`${title}: total ${formatRupiah(total)}`}
          >
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={hover === arc.key ? stroke + 5 : stroke}
                strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                strokeDashoffset={-arc.offset}
                onMouseEnter={() => setHover(arc.key)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-[stroke-width] duration-150"
              />
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="text-[10px] font-black uppercase tracking-wide text-ink-3">
              {active ? active.label : "Total"}
            </span>
            <span className="tabular mt-0.5 text-[15px] font-black text-ink-1">
              {formatRupiah(active ? active.value : total)}
            </span>
            {active && (
              <span className="tabular text-[11px] font-bold text-ink-3">
                {active.percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Daftar peringkat: sekaligus legenda, label langsung, dan tampilan
            tabel — identitas kategori tidak pernah bergantung warna saja. */}
        <ul className="w-full min-w-0 space-y-1.5">
          {arcs.map((arc) => (
            <li key={arc.key}>
              <button
                type="button"
                onMouseEnter={() => setHover(arc.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(arc.key)}
                onBlur={() => setHover(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                  hover === arc.key ? "bg-surface-2" : "hover:bg-surface-2"
                )}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-[4px]"
                  style={{ background: arc.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-1">
                  {arc.label}
                </span>
                <span className="tabular shrink-0 text-[11px] font-bold text-ink-3">
                  {arc.percent.toFixed(0)}%
                </span>
                <span className="tabular shrink-0 text-[13px] font-black text-ink-1">
                  {formatRupiah(arc.value)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/**
 * Tren pendapatan vs pengeluaran per bulan.
 * Satu sumbu nilai untuk kedua seri — tidak pernah dua skala.
 */
export function MonthlyTrend({ points }: { points: MonthPoint[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const hasData = points.some((p) => p.income > 0 || p.expense > 0);

  return (
    <Panel className="p-4">
      <SectionTitle title="Tren 6 Bulan" />

      <div className="mt-2 flex items-center gap-4 text-[11px] font-black">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-secondary" /> Pendapatan
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-primary" /> Pengeluaran
        </span>
      </div>

      {!hasData ? (
        <div className="mt-3">
          <EmptyState title="Belum ada tren" text="Grafik muncul setelah ada transaksi pada bulan-bulan ini." />
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex h-[176px] items-end justify-between gap-2">
            {points.map((point, index) => (
              <div
                key={point.month}
                className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === index && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-1 rounded-xl bg-ink-1 px-2 py-1.5 text-center text-[10px] font-bold text-white shadow-card-deep">
                    <p className="tabular whitespace-nowrap">+{formatRupiah(point.income)}</p>
                    <p className="tabular whitespace-nowrap">−{formatRupiah(point.expense)}</p>
                  </div>
                )}
                {/* Celah 2px antar batang bersebelahan agar tepinya terbaca. */}
                <div className="flex items-end justify-center gap-[2px]">
                  <div
                    className="w-[46%] max-w-[18px] rounded-t-[4px] bg-secondary"
                    style={{ height: `${Math.max(2, (point.income / max) * 140)}px` }}
                  />
                  <div
                    className="w-[46%] max-w-[18px] rounded-t-[4px] bg-primary"
                    style={{ height: `${Math.max(2, (point.expense / max) * 140)}px` }}
                  />
                </div>
                <p className="mt-2 truncate text-center text-[10px] font-bold text-ink-3">
                  {monthLabel(point.month)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function monthLabel(month: string): string {
  const [, m] = month.split("-").map(Number);
  return MONTH_SHORT[(m ?? 1) - 1] ?? month;
}
