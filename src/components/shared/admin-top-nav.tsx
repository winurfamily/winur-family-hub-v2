"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";
import { NAV_ICONS, type BottomNavItem } from "./bottom-nav";

interface AdminTopNavProps {
  items: readonly BottomNavItem[];
}

/** Nav horizontal untuk admin di layar desktop — BottomNav disembunyikan via lg:hidden. */
export function AdminTopNav({ items }: AdminTopNavProps) {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center gap-2 px-4 py-3 max-w-2xl mx-auto border-b-2 border-border bg-card">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = NAV_ICONS[item.icon];

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => soundManager.play("tap")}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-4 py-2 font-heading text-sm font-extrabold border-2 transition-all",
              isActive ? "bg-accent text-white border-accent shadow-card" : "text-ink-2 border-border bg-card"
            )}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
