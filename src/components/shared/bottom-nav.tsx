"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  TrendingUp,
  User,
  Wallet,
  Gift,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";

export const NAV_ICONS: Record<string, LucideIcon> = {
  Home,
  TrendingUp,
  User,
  Wallet,
  Gift,
  BookOpen,
  Sparkles,
};

export interface BottomNavItem {
  key: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  href: string;
}

interface BottomNavProps {
  items: readonly BottomNavItem[];
  basePath: string;
  hideOnDesktop?: boolean;
}

/** Bottom navigation mengambang. Default disembunyikan di desktop; set hideOnDesktop=false untuk tampil di semua ukuran layar (Dunia Anak). */
export function BottomNav({ items, basePath, hideOnDesktop = true }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-40 px-2 pb-2 safe-bottom", hideOnDesktop && "lg:hidden")}>
      <div className="glass-strong mx-auto flex max-w-2xl items-stretch justify-around rounded-3xl px-1 py-1.5 shadow-card-deep">
        {items.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive = pathname === href;
          const Icon = NAV_ICONS[item.icon];

          return (
            <Link
              key={item.key}
              href={href}
              onClick={() => soundManager.play("tap")}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 min-h-12 font-heading text-[10px] font-bold transition-all",
                isActive ? "bg-accent text-white shadow-card scale-[1.03]" : "text-ink-3"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
