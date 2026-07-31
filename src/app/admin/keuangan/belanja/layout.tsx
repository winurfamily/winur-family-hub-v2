"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SegmentedNav } from "@/components/finance/segmented-nav";

const TABS = [
  { href: "/admin/keuangan/belanja", label: "Manual" },
  { href: "/admin/keuangan/belanja/scan", label: "Scan AI" },
  { href: "/admin/keuangan/belanja/rencana", label: "Rencana", matchPrefix: true },
  { href: "/admin/keuangan/belanja/riwayat", label: "Riwayat" },
];

const TAB_PATHS = TABS.map((t) => t.href);

export default function BelanjaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Halaman detail transaksi (/belanja/<uuid>) punya navigasinya sendiri —
  // tab tidak ditampilkan agar tidak ada dua level navigasi bertumpuk.
  const isDetail =
    pathname.startsWith("/admin/keuangan/belanja/") &&
    !TAB_PATHS.includes(pathname) &&
    !pathname.startsWith("/admin/keuangan/belanja/rencana");

  if (isDetail) return <>{children}</>;

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/admin/keuangan"
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Keuangan
        </Link>
        <h1 className="font-heading text-2xl font-black text-ink-1">🛒 Belanja</h1>
        <p className="text-sm font-semibold text-ink-2">Catat belanja, scan struk, dan susun rencana.</p>
      </header>

      <SegmentedNav items={TABS} sticky />

      {children}
    </div>
  );
}
