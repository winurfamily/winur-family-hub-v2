"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/sound/sound-manager";

const TABS = [
  { href: "/admin/keuangan", label: "Dashboard" },
  { href: "/admin/keuangan/pockets", label: "Pocket" },
  { href: "/admin/keuangan/transfer", label: "Transfer" },
] as const;

export function KeuanganSubnav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto scroll-no-bar pb-1 -mx-4 px-4">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => soundManager.play("tap")}
            className={cn(
              "shrink-0 rounded-2xl px-4 py-2 font-heading text-sm font-extrabold border-2 transition-colors",
              isActive
                ? "bg-primary text-primary-foreground border-primary-dark shadow-btn-primary"
                : "bg-card text-ink-2 border-border"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
