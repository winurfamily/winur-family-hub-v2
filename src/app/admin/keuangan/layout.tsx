"use client";

import { usePathname } from "next/navigation";
import { SegmentedNav } from "@/components/finance/segmented-nav";

/**
 * Hanya tiga tab utama (E1). Pendapatan, Riwayat, dan Storage dijangkau lewat
 * tautan kontekstual supaya tab tidak menyempit dan sulit ditekan di HP.
 */
const TABS = [
  { href: "/admin/keuangan", label: "Dashboard" },
  { href: "/admin/keuangan/pockets", label: "Pocket" },
  { href: "/admin/keuangan/transfer", label: "Transfer" },
];

/** Halaman yang punya navigasi sendiri dan tidak memakai header modul ini. */
const STANDALONE = ["/admin/keuangan/belanja", "/admin/keuangan/storage", "/admin/keuangan/riwayat"];

export default function KeuanganLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = STANDALONE.some((prefix) => pathname.startsWith(prefix));

  if (standalone) return <>{children}</>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-black text-ink-1">💰 Keuangan</h1>
        <p className="text-sm font-semibold text-ink-2">Kelola dompet keluarga, transfer, dan belanja.</p>
      </header>

      <SegmentedNav items={TABS} sticky />

      {children}
    </div>
  );
}
