"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { soundManager } from "@/lib/sound/sound-manager";

export function AnakSubnav({ childId }: { childId: string }) {
  const pathname = usePathname();
  const base = `/admin/dunia-anak/${childId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/tugas`, label: "Tugas" },
    { href: `${base}/investasi`, label: "Investasi" },
    { href: `${base}/tarik-dana`, label: "Tarik Dana" },
    { href: `${base}/profil`, label: "Profil" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto scroll-no-bar pb-1 -mx-4 px-4">
      {tabs.map((tab) => {
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
