"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getAvailableThemes, setActiveTheme, type AvailableThemes } from "@/app/actions/room-theme";
import { soundManager } from "@/lib/sound/sound-manager";
import { SheetHeader, SheetLoading } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function TemaSheet({ childId, onClose, onChanged }: Props) {
  const [data, setData] = useState<AvailableThemes | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => void getAvailableThemes(childId).then(setData);
  useEffect(load, [childId]);

  const pick = (key: string) => {
    if (!data || key === data.activeThemeKey) return;
    startTransition(async () => {
      const res = await setActiveTheme(childId, key);
      if (res.success) {
        soundManager.play("unlock");
        toast.success("Tema kamar diganti! 🛏️");
        load();
        onChanged();
        onClose();
      } else {
        toast.error(res.error ?? "Gagal mengganti tema.");
      }
    });
  };

  return (
    <div>
      <SheetHeader title="🛏️ Tema Kamar" onClose={onClose} />
      {!data ? (
        <SheetLoading />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.themes.map((t) => {
            const active = t.key === data.activeThemeKey;
            return (
              <button
                key={t.key}
                type="button"
                disabled={isPending}
                onClick={() => pick(t.key)}
                className={`relative overflow-hidden rounded-[16px] border-[3px] text-left transition-transform active:scale-95 ${
                  active ? "border-[#4A8C3F]" : "border-[#E3E8F0]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.dayImage} alt={t.name} className="aspect-video w-full object-cover" />
                <div className="flex items-center justify-between gap-1 bg-white px-2.5 py-2">
                  <span className="truncate text-[12px] font-black text-[#3D5A80]">{t.name}</span>
                  {active && <span className="text-[10px] font-black text-[#4A8C3F]">✓ Aktif</span>}
                </div>
              </button>
            );
          })}

          <div className="flex aspect-[4/3.4] flex-col items-center justify-center gap-1 rounded-[16px] border-[3px] border-dashed border-[#E3E8F0] bg-[#F7F9FC] text-center opacity-60">
            <span className="text-2xl">➕</span>
            <span className="px-2 text-[11px] font-black text-[#9AA0AE]">Tambah tema (Admin)</span>
            <span className="text-[10px] font-bold text-[#9AA0AE]">Upload di Assets ➜ Kamar</span>
          </div>
        </div>
      )}
    </div>
  );
}
