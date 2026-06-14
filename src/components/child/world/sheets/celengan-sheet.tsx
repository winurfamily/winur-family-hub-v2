"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getChildKlaim, requestWithdrawal, type ClaimOverview } from "@/app/actions/child-klaim";
import { soundManager } from "@/lib/sound/sound-manager";
import { formatRupiah, formatDate } from "@/lib/format";
import { SheetHeader, SheetLoading } from "./sheet-ui";

interface Props {
  childId: string;
  onClose: () => void;
  onChanged: () => void;
}

const TX_LABEL: Record<string, string> = {
  task_claim: "Reward Tugas",
  streak_bonus: "Bonus Streak",
  withdrawal: "Tarik Dana",
  investment_in: "Mulai Investasi",
  investment_return: "Investasi Selesai",
};

export function CelenganSheet({ childId, onClose, onChanged }: Props) {
  const [data, setData] = useState<ClaimOverview | null>(null);
  const [tab, setTab] = useState<"tarik" | "riwayat">("tarik");
  const [amount, setAmount] = useState(0);
  const [withBonus, setWithBonus] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = () => void getChildKlaim(childId).then(setData);
  useEffect(load, [childId]);

  const bonusAvailable = useMemo(
    () => !!data && data.isSunday && data.streakComplete && !data.streakBonusClaimed,
    [data]
  );

  const submit = () => {
    if (!data) return;
    startTransition(async () => {
      const res = await requestWithdrawal(childId, amount, withBonus && bonusAvailable);
      if (res.success) {
        soundManager.play("claim");
        toast.success("Permintaan tarik dana dikirim ke Ayah/Mamah!");
        setAmount(0);
        setWithBonus(false);
        load();
        onChanged();
      } else {
        toast.error(res.error ?? "Gagal mengajukan.");
      }
    });
  };

  return (
    <div>
      <SheetHeader title="🐷 Celengan" onClose={onClose} />
      {!data ? (
        <SheetLoading />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2.5">
            <Stat label="TABUNGAN" value={formatRupiah(data.saldo)} color="#388E3C" />
            <Stat label="POINT" value={`⭐ ${data.point}`} color="#7C3AED" />
            <Stat label="MENUNGGU" value={formatRupiah(data.pendingRequest?.amount ?? 0)} color="#E8561F" />
          </div>

          <div className="mb-3 flex gap-1.5">
            <Tab on={tab === "tarik"} onClick={() => setTab("tarik")}>
              Tarik Dana {data.isSunday ? "" : "🔒"}
            </Tab>
            <Tab on={tab === "riwayat"} onClick={() => setTab("riwayat")}>
              Riwayat
            </Tab>
          </div>

          {tab === "tarik" ? (
            !data.isSunday ? (
              <div className="rounded-2xl bg-[#FFF4E5] p-4 text-center text-sm font-bold text-[#B8690A]">
                🔒 Tarik dana hanya bisa hari Minggu. Sabar ya, terus kumpulkan tabungan!
              </div>
            ) : data.pendingRequest ? (
              <div className="rounded-2xl bg-[#FFF4E5] p-4 text-center text-sm font-bold text-[#B8690A]">
                ⏳ Sudah ada permintaan tarik dana menunggu persetujuan: {formatRupiah(data.pendingRequest.amount)}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  inputMode="numeric"
                  value={amount ? formatRupiah(amount) : ""}
                  placeholder="Rp 0"
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, ""));
                    setAmount(Math.min(n, data.saldo));
                  }}
                  className="w-full rounded-[14px] border-[2.5px] border-[#DDE3EC] px-4 py-3 font-mono text-lg font-bold text-[#1C1E26] outline-none focus:border-[#7C3AED]"
                />
                <div className="flex flex-wrap gap-2">
                  {[10000, 25000, 50000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(Math.min(n, data.saldo))}
                      className="rounded-[9px] bg-[#EDE9FE] px-3 py-1.5 text-[11px] font-black text-[#7C3AED]"
                    >
                      +{formatRupiah(n)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(data.saldo)}
                    className="rounded-[9px] bg-[#EDE9FE] px-3 py-1.5 text-[11px] font-black text-[#7C3AED]"
                  >
                    Semua
                  </button>
                </div>
                {bonusAvailable && (
                  <label className="flex items-center gap-2 rounded-[12px] bg-[#FFF8E1] px-3 py-2 text-[12px] font-bold text-[#8A6D00]">
                    <input type="checkbox" checked={withBonus} onChange={(e) => setWithBonus(e.target.checked)} />
                    Sertakan bonus streak (+{formatRupiah(data.streakBonusMoney)} · ⭐{data.streakBonusPoint})
                  </label>
                )}
                <button
                  type="button"
                  disabled={isPending || (amount === 0 && !(withBonus && bonusAvailable))}
                  onClick={submit}
                  className="w-full rounded-[13px] bg-[#4CAF50] py-3 font-black text-white shadow-[0_3px_0_#388E3C] active:translate-y-0.5 disabled:opacity-50"
                >
                  {isPending ? "Mengirim…" : "Ajukan Tarik Dana"}
                </button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {data.recentTransactions.length === 0 ? (
                <p className="py-6 text-center text-sm font-bold text-[#9AA0AE]">Belum ada transaksi.</p>
              ) : (
                data.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-[#EDEFF4] p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-extrabold text-[#1C1E26]">{TX_LABEL[t.type] ?? t.type}</p>
                      <p className="text-[10px] font-bold text-[#9AA0AE]">{formatDate(t.createdAt)}</p>
                    </div>
                    <span className={`font-black ${t.amount < 0 ? "text-[#E8561F]" : "text-[#388E3C]"}`}>
                      {t.amount < 0 ? "" : "+"}
                      {formatRupiah(t.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[14px] bg-[#F7F8FB] p-2.5 text-center">
      <small className="block text-[9px] font-extrabold text-[#9AA0AE]">{label}</small>
      <div className="mt-0.5 text-[14px] font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[12px] font-black ${on ? "bg-[#7C3AED] text-white" : "bg-[#F0F1F5] text-[#9AA0AE]"}`}
    >
      {children}
    </button>
  );
}
