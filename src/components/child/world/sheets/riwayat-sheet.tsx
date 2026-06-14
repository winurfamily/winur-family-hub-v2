"use client";

import { useEffect, useState } from "react";
import { getChildRiwayat, type RiwayatItem, type RiwayatFilter } from "@/app/actions/child-riwayat";
import { formatRupiah, formatDate } from "@/lib/format";
import { SheetHeader, SheetLoading, SheetEmpty } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
}

const FILTERS: { key: RiwayatFilter; label: string; icon: string }[] = [
  { key: "semua", label: "Semua", icon: "📖" },
  { key: "tugas", label: "Tugas", icon: "✅" },
  { key: "tarik_dana", label: "Tarik", icon: "💵" },
  { key: "investasi", label: "Investasi", icon: "🌱" },
  { key: "streak", label: "Streak", icon: "🔥" },
  { key: "point_shop", label: "Shop", icon: "🎁" },
];

const CAT_ICON: Record<string, string> = {
  tugas: "✅",
  tarik_dana: "💵",
  investasi: "🌱",
  streak: "🔥",
  point_shop: "🎁",
};

export function RiwayatSheet({ childId, onClose }: Props) {
  const [filter, setFilter] = useState<RiwayatFilter>("semua");
  const [items, setItems] = useState<RiwayatItem[] | null>(null);

  useEffect(() => {
    setItems(null);
    void getChildRiwayat(childId, filter).then(setItems);
  }, [childId, filter]);

  return (
    <div>
      <SheetHeader title="📖 Riwayat" onClose={onClose} />
      <div className="scroll-no-bar mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${
              filter === f.key ? "bg-[#7C3AED] text-white" : "bg-[#F0F1F5] text-[#9AA0AE]"
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      {items === null ? (
        <SheetLoading />
      ) : items.length === 0 ? (
        <SheetEmpty icon="📭" text="Belum ada riwayat untuk filter ini." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl border-2 border-[#EDEFF4] p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F7F8FB] text-base">
                {CAT_ICON[it.category] ?? "•"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-[#1C1E26]">{it.title}</p>
                <p className="text-[10px] font-bold text-[#9AA0AE]">{formatDate(it.date)}</p>
              </div>
              <div className="text-right">
                {it.amountMoney != null && (
                  <p className={`text-[13px] font-black ${it.amountMoney < 0 ? "text-[#E8561F]" : "text-[#388E3C]"}`}>
                    {it.amountMoney < 0 ? "" : "+"}
                    {formatRupiah(it.amountMoney)}
                  </p>
                )}
                {it.amountPoint != null && <p className="text-[11px] font-black text-[#7C3AED]">⭐{it.amountPoint}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
