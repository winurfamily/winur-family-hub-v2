"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getChildInvestments, startInvestment, type ChildInvestmentOverview } from "@/app/actions/child-investasi";
import { soundManager } from "@/lib/sound/sound-manager";
import { formatRupiah } from "@/lib/format";
import { SheetHeader, SheetLoading } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function InvestasiSheet({ childId, onClose, onChanged }: Props) {
  const [data, setData] = useState<ChildInvestmentOverview | null>(null);
  const [amount, setAmount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const load = () => void getChildInvestments(childId).then(setData);
  useEffect(load, [childId]);

  const active = data?.investments.find((i) => i.status === "active") ?? null;
  const estimate = data ? Math.round(amount * (1 + data.currentReturnPercent / 100)) : 0;

  const invest = () => {
    if (!data) return;
    startTransition(async () => {
      const res = await startInvestment(childId, amount);
      if (res.success) {
        soundManager.play("invest_done");
        toast.success("Investasi ditanam! 🌱");
        setAmount(0);
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal menanam investasi.");
      }
    });
  };

  return (
    <div>
      <SheetHeader title="🌱 Pot Ajaib — Investasi" onClose={onClose} />
      {!data ? (
        <SheetLoading />
      ) : (
        <div className="space-y-4">
          {/* Progress */}
          <div className="rounded-[20px] bg-[linear-gradient(180deg,#E8F8FF,#F0FFF0)] p-4 text-center">
            {active ? (
              <>
                <div className="my-1 text-5xl">🐷</div>
                <p className="text-[11px] font-extrabold text-[#5A5F6E]">HARI BERJALAN · {active.progressPercent}%</p>
                <div className="mx-auto mt-2 h-3 w-full max-w-[220px] overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[#4CAF50]" style={{ width: `${active.progressPercent}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-bold text-[#9AA0AE]">
                  Modal {formatRupiah(active.amount)} → Panen {formatRupiah(active.estimatedReturn)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-[#9AA0AE]">Lihat celengan di kamar membesar sesuai progress! 🏠</p>
              </>
            ) : (
              <>
                <div className="my-1 text-5xl">🐷</div>
                <p className="text-[12px] font-bold text-[#5A5F6E]">Belum ada investasi berjalan. Tanam sekarang!</p>
              </>
            )}
          </div>

          {/* Form */}
          {active ? (
            <p className="rounded-[12px] bg-[#FFF8E1] px-3 py-2 text-center text-[11px] font-bold text-[#8A6D00]">
              🔒 Hanya 1 investasi berjalan. Tunggu sampai panen ya.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-[#9AA0AE]">
                Saldo tersedia: <b className="text-[#388E3C]">{formatRupiah(data.saldo)}</b>
              </p>
              <input
                inputMode="numeric"
                value={amount ? formatRupiah(amount) : ""}
                placeholder="Rp 0"
                onChange={(e) => setAmount(Math.min(Number(e.target.value.replace(/[^0-9]/g, "")), data.saldo))}
                className="w-full rounded-[14px] border-[2.5px] border-[#DDE3EC] px-4 py-3 font-mono text-lg font-bold text-[#1C1E26] outline-none focus:border-[#4CAF50]"
              />
              <div className="flex flex-wrap gap-2">
                {data.quickAmounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmount(Math.min(n, data.saldo))}
                    className="rounded-[9px] bg-[#E8F5E9] px-3 py-1.5 text-[11px] font-black text-[#388E3C]"
                  >
                    +{formatRupiah(n)}
                  </button>
                ))}
              </div>
              <div className="rounded-[13px] bg-[#E8F5E9] px-4 py-2.5">
                <small className="text-[10px] font-bold text-[#388E3C]">
                  ESTIMASI PANEN ({data.durationDays} HARI · +{data.currentReturnPercent}%)
                </small>
                <div className="font-heading text-lg font-black text-[#388E3C]">{formatRupiah(estimate)}</div>
              </div>
              <p className="text-[10px] font-bold text-[#9AA0AE]">🔒 Tidak bisa dibatalkan setelah ditanam</p>
              <button
                type="button"
                disabled={isPending || amount <= 0}
                onClick={invest}
                className="w-full rounded-[13px] bg-[#4CAF50] py-3 font-black text-white shadow-[0_3px_0_#388E3C] active:translate-y-0.5 disabled:opacity-50"
              >
                {isPending ? "Menanam…" : "🌱 Tanam Sekarang"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
