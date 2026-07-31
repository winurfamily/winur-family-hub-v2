"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ShoppingCart, Sparkles, Wallet } from "lucide-react";
import { MAIN_NAV, SETTINGS_HREF, isNavActive, type MainNavItem } from "./nav-items";
import { cn } from "@/lib/utils";

const ICONS = {
  wallet: Wallet,
  cart: ShoppingCart,
  sparkles: Sparkles,
} as const;

/**
 * Cangkang Ayah/Mamah.
 *
 * Satu komponen, dua bentuk — bukan aplikasi mobile yang diperbesar:
 *  - < lg : header ringkas + bottom navigation ala aplikasi native/PWA.
 *  - ≥ lg : sidebar tetap ala SaaS, konten memakai lebar layar.
 *
 * Isi navigasi datang dari MAIN_NAV (tiga tujuan) sehingga tidak mungkin ada
 * menu Belanja ganda. Pengaturan diletakkan terpisah sebagai utilitas.
 */
export function AdminShell({
  profileName,
  headerSlot,
  children,
}: {
  profileName: string;
  /** Lonceng notifikasi + tombol ganti profil (server component). */
  headerSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = MAIN_NAV.find((item) => isNavActive(pathname, item.href));

  return (
    <div className="admin-shell min-h-screen-dvh bg-background text-ink-1">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-card px-4 py-5 lg:flex xl:w-[268px]">
        <Link href="/admin/keuangan" className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/branding/winur-logo-icon.svg" alt="" className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-heading text-[15px] font-black leading-tight">
              Winur Family Hub
            </span>
            <span className="block truncate text-[11px] font-bold text-ink-3">{profileName}</span>
          </span>
        </Link>

        <nav aria-label="Menu utama" className="mt-6 flex-1 space-y-1.5">
          {MAIN_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
          ))}
        </nav>

        <Link
          href={SETTINGS_HREF}
          className={cn(
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors",
            isNavActive(pathname, SETTINGS_HREF)
              ? "bg-primary-light text-primary"
              : "text-ink-3 hover:bg-surface-2 hover:text-ink-2"
          )}
        >
          <Settings className="h-[18px] w-[18px]" aria-hidden />
          Pengaturan
        </Link>
      </aside>

      {/* ---------------- Konten ---------------- */}
      <div className="lg:pl-[248px] xl:pl-[268px]">
        <header className="safe-top sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/branding/winur-logo-icon.svg"
                alt=""
                className="h-9 w-9 shrink-0 lg:hidden"
              />
              <div className="min-w-0">
                <p className="truncate font-heading text-lg font-black leading-tight sm:text-xl">
                  {active?.label ?? "Winur Family Hub"}
                </p>
                <p className="truncate text-[11px] font-bold text-ink-3">
                  {active?.hint ?? profileName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerSlot}
              <Link
                href={SETTINGS_HREF}
                aria-label="Pengaturan"
                className="tap-target flex items-center justify-center rounded-xl border-2 border-border bg-card text-ink-2 shadow-card transition-transform active:scale-95 lg:hidden"
              >
                <Settings className="h-[18px] w-[18px]" aria-hidden />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ---------------- Bottom nav (mobile) ---------------- */}
      <nav
        aria-label="Menu utama"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pt-1.5 shadow-[0_-10px_30px_rgba(120,55,82,0.10)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3">
          {MAIN_NAV.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "tap-target flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-[11px] font-black transition-colors",
                  isActive ? "bg-primary-light text-primary" : "text-ink-3 active:bg-surface-2"
                )}
              >
                <Icon className="h-[22px] w-[22px]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SidebarLink({ item, active }: { item: MainNavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
        active ? "bg-rose-hero text-white shadow-card" : "text-ink-2 hover:bg-surface-2"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-heading text-sm font-black">{item.label}</span>
        <span
          className={cn("block truncate text-[11px] font-semibold", active ? "text-white/75" : "text-ink-3")}
        >
          {item.hint}
        </span>
      </span>
    </Link>
  );
}
