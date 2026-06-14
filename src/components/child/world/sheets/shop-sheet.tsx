"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getChildShop, requestPointReward, type ChildShopOverview } from "@/app/actions/child-shop";
import { soundManager } from "@/lib/sound/sound-manager";
import { SheetHeader, SheetLoading, SheetEmpty } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function ShopSheet({ childId, onClose, onChanged }: Props) {
  const [data, setData] = useState<ChildShopOverview | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => void getChildShop(childId).then(setData);
  useEffect(load, [childId]);

  const redeem = (id: string) => {
    startTransition(async () => {
      const res = await requestPointReward(childId, id);
      if (res.success) {
        soundManager.play("claim");
        toast.success("Penukaran dikirim ke Ayah/Mamah!");
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal menukar hadiah.");
      }
    });
  };

  return (
    <div>
      <SheetHeader
        title="🏪 Etalase Point Shop"
        onClose={onClose}
        right={data ? <span className="text-[12px] font-black text-[#7C3AED]">⭐ {data.point}</span> : undefined}
      />
      {!data ? (
        <SheetLoading />
      ) : data.rewards.length === 0 ? (
        <SheetEmpty icon="🎁" text="Belum ada hadiah di etalase." />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {data.rewards.map((r) => {
            const canRedeem = r.unlocked && r.affordable && r.requestStatus === "none";
            return (
              <div
                key={r.id}
                className={`flex flex-col rounded-[16px] border-2 border-[#EDEFF4] p-3 ${r.unlocked ? "" : "opacity-60 grayscale"}`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[12px] bg-[#F7F8FB] text-3xl">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.name} className="h-full w-full object-cover" />
                  ) : (
                    "🎁"
                  )}
                </div>
                <p className="mt-1.5 truncate text-center font-heading text-[12px] font-extrabold text-[#1C1E26]">{r.name}</p>
                <p className="text-center text-[12px] font-black text-[#7C3AED]">⭐ {r.pointCost}</p>
                {r.requestStatus === "pending" ? (
                  <span className="mt-1.5 rounded-[10px] bg-[#FFF4E5] py-1.5 text-center text-[11px] font-black text-[#B8690A]">⏳ Menunggu</span>
                ) : r.requestStatus === "approved" ? (
                  <span className="mt-1.5 rounded-[10px] bg-[#E8F5E9] py-1.5 text-center text-[11px] font-black text-[#388E3C]">✓ Ditukar</span>
                ) : !r.unlocked ? (
                  <span className="mt-1.5 rounded-[10px] bg-[#F0F1F5] py-1.5 text-center text-[11px] font-black text-[#9AA0AE]">🔒 ⭐{r.minPointUnlock}</span>
                ) : (
                  <button
                    type="button"
                    disabled={!canRedeem || isPending}
                    onClick={() => redeem(r.id)}
                    className="mt-1.5 rounded-[10px] bg-[#FF6B35] py-1.5 text-[11px] font-black text-white active:translate-y-0.5 disabled:opacity-50"
                  >
                    {r.affordable ? "Tukar" : "Point kurang"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
