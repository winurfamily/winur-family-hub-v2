"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { selectAvatar, selectPet } from "@/app/actions/child-avatar";
import { EmptyState } from "@/components/child/layout/empty-state";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";

interface CollectionItem {
  id: string;
  name: string;
  imageUrl: string;
  unlockLevel: number;
  unlocked: boolean;
  active: boolean;
}

interface CollectionGridProps {
  childId: string;
  type: "avatar" | "pet";
  items: CollectionItem[];
}

/** Grid koleksi avatar/pet: pilih item yang sudah unlocked, locked tampil grayscale + gembok. */
export function CollectionGrid({ childId, type, items }: CollectionGridProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelect = (item: CollectionItem) => {
    if (!item.unlocked || item.active || isPending) return;
    startTransition(async () => {
      const action = type === "avatar" ? selectAvatar : selectPet;
      const result = await action(childId, item.id);
      if (result.success) {
        soundManager.play("unlock");
        toast.success(`${item.name} dipilih!`);
      } else {
        toast.error(result.error ?? "Gagal memilih.");
      }
    });
  };

  if (items.length === 0) {
    return <EmptyState icon="🎭" title="Belum ada koleksi." />;
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={!item.unlocked || isPending}
          onClick={() => handleSelect(item)}
          className={cn(
            "glass-panel relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-transform sm:rounded-3xl sm:p-3",
            item.active ? "border-accent shadow-[0_0_20px_rgba(124,58,237,0.4)]" : "border-transparent shadow-card",
            item.unlocked ? "hover:-translate-y-0.5 active:scale-95" : "opacity-60 grayscale"
          )}
        >
          {item.active && (
            <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs text-white shadow-card">
              ✓
            </span>
          )}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="h-full w-full rounded-xl object-cover" />
            {!item.unlocked && (
              <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-2xl">🔒</span>
            )}
          </div>
          <p className="line-clamp-1 text-center text-[11px] font-bold text-ink-1 sm:text-xs">{item.name}</p>
          <span
            className={cn(
              "rounded-lg px-1.5 py-0.5 text-[10px] font-extrabold",
              item.active ? "bg-secondary/20 text-secondary" : item.unlocked ? "bg-white/10 text-ink-2" : "bg-white/10 text-ink-3"
            )}
          >
            {item.active ? "✅ Dipakai" : item.unlocked ? `Lv.${item.unlockLevel}` : `🔒 Lv.${item.unlockLevel}`}
          </span>
        </button>
      ))}
    </div>
  );
}
