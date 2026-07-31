"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

/** Kartu putih standar. Radius & bayangan mengikuti referensi desain. */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-[22px] bg-card shadow-card", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionTitle({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2 font-heading text-[15px] font-black text-ink-1">
        {icon && <span className="shrink-0 text-primary">{icon}</span>}
        <span className="truncate">{title}</span>
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] bg-surface-2 px-5 py-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/illustrations/empty-state.svg" alt="" className="mx-auto h-24 w-24" />
      <p className="mt-2 font-heading text-[15px] font-black text-ink-1">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-ink-3">{text}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Angka ringkas untuk grid statistik. */
export function StatTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "good" | "bad";
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-surface-2 p-3">
      <p className="truncate text-[10px] font-black uppercase tracking-wide text-ink-3">{label}</p>
      {/* Nominal jutaan harus tetap utuh di kolom sepertiga layar 360px,
          jadi ukurannya mengecil di HP dan kembali normal dari sm ke atas. */}
      <p
        className={cn(
          "tabular mt-1 truncate text-[12px] font-black tracking-tight sm:text-[15px] sm:tracking-normal",
          tone === "good" && "text-secondary-dark",
          tone === "bad" && "text-destructive",
          tone === "neutral" && "text-ink-1"
        )}
      >
        {typeof value === "number" ? formatRupiah(value) : value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[10px] font-semibold text-ink-3">{hint}</p>}
    </div>
  );
}

export function ProgressBar({
  percent,
  className,
  tone = "primary",
}: {
  percent: number;
  className?: string;
  tone?: "primary" | "good" | "bad";
}) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          tone === "primary" && "bg-primary",
          tone === "good" && "bg-secondary",
          tone === "bad" && "bg-destructive"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export interface SegmentTab<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Tab segmented yang bisa digeser di layar sempit dan melebar rata di desktop.
 * Dipakai untuk navigasi INTERNAL sebuah menu — bukan menu utama.
 */
export function SegmentTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: SegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("scroll-no-bar snap-tabs flex gap-1.5 overflow-x-auto pb-1", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "tap-target flex shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-black transition-colors sm:flex-1 sm:justify-center",
              isActive
                ? "bg-primary text-white shadow-card"
                : "bg-surface-2 text-ink-3 hover:text-ink-2 active:bg-primary-light"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
