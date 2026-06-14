"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getChildCollections, selectAvatar, selectPet, type ChildCollections } from "@/app/actions/child-avatar";
import { soundManager } from "@/lib/sound/sound-manager";
import { costumeKeyFrom, type CostumeKey } from "../character-svg";
import { SheetHeader, SheetLoading } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
  onSelectCostume: (key: CostumeKey) => void;
  onSay?: (text: string) => void;
}

/** Kelompokkan kostum berdasarkan nama pemiliknya (Daffa / Dafa vs Dio). */
function avatarOwner(name: string): "daffa" | "dio" | "lain" {
  const n = name.trim().toLowerCase();
  if (n.startsWith("dio")) return "dio";
  if (n.startsWith("daf")) return "daffa";
  return "lain";
}

function CollectionCard({
  name,
  imageUrl,
  unlocked,
  active,
  unlockLevel,
  fallback,
  disabled,
  onClick,
}: {
  name: string;
  imageUrl: string | null;
  unlocked: boolean;
  active: boolean;
  unlockLevel: number;
  fallback: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative rounded-[18px] border-[3px] p-2 text-center transition-transform active:scale-95 ${
        active ? "border-[#4A8C3F] bg-[#EAF7E8]" : "border-[#E3E8F0] bg-[#F7F9FC]"
      } ${unlocked ? "" : "opacity-55 grayscale"}`}
    >
      {!unlocked && <span className="absolute right-2 top-1.5 text-[14px]">🔒</span>}
      <div className="mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] bg-white">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">{fallback}</span>
        )}
      </div>
      <div className="mt-1.5 truncate text-[12px] font-black text-[#3D5A80]">{name}</div>
      <div className="text-[10px] font-bold text-[#9AA0AE]">{unlocked ? "✓" : `Lv.${unlockLevel}`}</div>
    </button>
  );
}

export function KostumSheet({ childId, onClose, onChanged, onSelectCostume, onSay }: Props) {
  const [data, setData] = useState<ChildCollections | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => void getChildCollections(childId).then(setData);
  useEffect(load, [childId]);

  const pickAvatar = (id: string, unlocked: boolean, costume: string | null, name: string) => {
    if (!unlocked) {
      soundManager.play("tap");
      toast.error("Naik level dulu untuk membuka kostum ini!");
      return;
    }
    onSelectCostume(costumeKeyFrom(costume, name));
    toast.success("Keren! 🔥");
    onSay?.("Keren!");
    startTransition(async () => {
      const res = await selectAvatar(childId, id);
      if (res.success) {
        soundManager.play("unlock");
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal memilih kostum.");
      }
    });
  };

  const pickPet = (id: string, unlocked: boolean) => {
    if (!unlocked) {
      soundManager.play("tap");
      toast.error("Pet ini masih terkunci!");
      return;
    }
    startTransition(async () => {
      const res = await selectPet(childId, id);
      if (res.success) {
        soundManager.play("unlock");
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal memilih pet.");
      }
    });
  };

  const unlockedCount = data?.avatars.filter((a) => a.unlocked).length ?? 0;
  const groups = data
    ? (
        [
          { key: "daffa", label: "🧒 Kostum Daffa", items: data.avatars.filter((a) => avatarOwner(a.name) === "daffa") },
          { key: "dio", label: "👦 Kostum Dio", items: data.avatars.filter((a) => avatarOwner(a.name) === "dio") },
          { key: "lain", label: "✨ Kostum Lainnya", items: data.avatars.filter((a) => avatarOwner(a.name) === "lain") },
        ] as const
      ).filter((g) => g.items.length > 0)
    : [];

  return (
    <div>
      <SheetHeader
        title={`👕 Koleksi Kostum${data ? ` · ${unlockedCount}/${data.avatars.length}` : ""}`}
        onClose={onClose}
      />
      {!data ? (
        <SheetLoading />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-[12px] font-extrabold tracking-wide text-[#7C8597]">{g.label}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {g.items.map((a) => (
                  <CollectionCard
                    key={a.id}
                    name={a.name}
                    imageUrl={a.imageUrl}
                    unlocked={a.unlocked}
                    active={a.active}
                    unlockLevel={a.unlockLevel}
                    fallback="🧒"
                    disabled={isPending}
                    onClick={() => pickAvatar(a.id, a.unlocked, a.costume, a.name)}
                  />
                ))}
              </div>
            </div>
          ))}

          {data.pets.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-extrabold tracking-wide text-[#7C8597]">🐾 Pet</p>
              <div className="grid grid-cols-3 gap-2.5">
                {data.pets.map((p) => (
                  <CollectionCard
                    key={p.id}
                    name={p.name}
                    imageUrl={p.imageUrl}
                    unlocked={p.unlocked}
                    active={p.active}
                    unlockLevel={p.unlockLevel}
                    fallback="🐕"
                    disabled={isPending}
                    onClick={() => pickPet(p.id, p.unlocked)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
