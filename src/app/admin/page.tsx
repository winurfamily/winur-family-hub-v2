import { Suspense } from "react";
import Link from "next/link";
import { getDashboardData } from "@/app/actions/dashboard";
import { DashboardView, DashboardSkeleton } from "@/components/finance/dashboard-view";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNELS = [
  { href: "/admin/keuangan", name: "Keuangan", sub: "Saldo, pocket, transfer", icon: "💰", color: "#2E7D32", bg: "#E8F5E9" },
  { href: "/admin/keuangan/belanja", name: "Belanja", sub: "Manual, scan & rencana", icon: "🛒", color: "#B45309", bg: "#FFF3E0" },
  { href: "/admin/keuangan/riwayat", name: "Riwayat", sub: "Semua transaksi", icon: "🧾", color: "#1976D2", bg: "#E3F2FD" },
  { href: "/admin/dunia-anak", name: "Dunia Anak", sub: "Task, saldo, avatar", icon: "✨", color: "#7C3AED", bg: "#EDE9FE" },
  { href: "/admin/dunia-anak/point-shop", name: "Point Shop", sub: "Hadiah & persetujuan", icon: "🎁", color: "#0D7C86", bg: "#E0F7FA" },
  { href: "/admin/dunia-anak/settings", name: "Pengaturan", sub: "PIN, profil, reward", icon: "⚙️", color: "#5A5F6E", bg: "#ECEEF2" },
];

export default function AdminHomePage({ searchParams }: { searchParams?: { periode?: string } }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-black text-ink-1">Selamat datang 👋</h1>
        <p className="text-xs font-semibold text-ink-3">{formatDate(new Date())}</p>
      </header>

      {/* Skeleton tampil selama agregasi dashboard berjalan. `key` memaksa
          Suspense berjalan ulang setiap kali periode berganti. */}
      <Suspense key={searchParams?.periode ?? "this_month"} fallback={<DashboardSkeleton />}>
        <DashboardSection periode={searchParams?.periode} />
      </Suspense>

      <nav aria-label="Menu keluarga">
        <p className="mb-2 text-[11px] font-extrabold tracking-[1px] text-ink-3">MENU KELUARGA</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CHANNELS.map((ch) => (
            <Link
              key={ch.href + ch.name}
              href={ch.href}
              style={{ color: ch.color }}
              className="group relative flex min-h-[118px] flex-col justify-between rounded-[20px] border-[2.5px] border-transparent bg-card p-3.5 shadow-card transition-all hover:-translate-y-1 hover:border-[color:currentColor] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 items-center justify-center rounded-[13px] text-xl"
                style={{ background: ch.bg }}
              >
                {ch.icon}
              </span>
              <span>
                <span className="block font-heading text-[13px] font-black text-ink-1">{ch.name}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-ink-3">{ch.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

async function DashboardSection({ periode }: { periode?: string }) {
  const data = await getDashboardData(periode ?? "this_month");

  if (!data) {
    return (
      <p className="rounded-2xl bg-card px-4 py-8 text-center text-sm font-semibold text-ink-2 shadow-card">
        Gagal memuat data keuangan. Coba muat ulang halaman.
      </p>
    );
  }

  return <DashboardView data={data} />;
}
