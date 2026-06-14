"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireChild } from "@/lib/server/child-helpers";
import type { SaldoTransactionType } from "@/lib/supabase/types";

export type RiwayatCategory = "tugas" | "tarik_dana" | "investasi" | "streak" | "point_shop";
export type RiwayatFilter = "semua" | RiwayatCategory;

export interface RiwayatItem {
  id: string;
  category: RiwayatCategory;
  title: string;
  note: string | null;
  amountMoney: number | null;
  amountPoint: number | null;
  date: string;
}

const TX_TITLES: Record<SaldoTransactionType, string> = {
  task_claim: "Reward Tugas",
  streak_bonus: "Bonus Streak",
  withdrawal: "Tarik Dana",
  investment_in: "Mulai Investasi",
  investment_return: "Investasi Selesai",
};

const TX_CATEGORY: Record<SaldoTransactionType, RiwayatCategory> = {
  task_claim: "tugas",
  streak_bonus: "streak",
  withdrawal: "tarik_dana",
  investment_in: "investasi",
  investment_return: "investasi",
};

const TX_FILTER_TYPES: Record<Exclude<RiwayatFilter, "semua" | "point_shop">, SaldoTransactionType[]> = {
  tugas: ["task_claim"],
  tarik_dana: ["withdrawal"],
  investasi: ["investment_in", "investment_return"],
  streak: ["streak_bonus"],
};

/** Riwayat aktivitas keuangan/point anak, digabung dari saldo_transactions + point_requests. */
export async function getChildRiwayat(childId: string, filter: RiwayatFilter = "semua"): Promise<RiwayatItem[]> {
  const session = await requireChild(childId);
  if (!session) return [];

  const supabase = createAdminClient();
  const items: RiwayatItem[] = [];

  if (filter !== "point_shop") {
    let query = supabase
      .from("saldo_transactions")
      .select("id, type, amount, note, created_at")
      .eq("profile_id", childId);

    if (filter !== "semua") {
      query = query.in("type", TX_FILTER_TYPES[filter]);
    }

    const { data } = await query.order("created_at", { ascending: false }).limit(100);

    (data ?? []).forEach((t) => {
      items.push({
        id: t.id,
        category: TX_CATEGORY[t.type],
        title: TX_TITLES[t.type],
        note: t.note,
        amountMoney: Number(t.amount),
        amountPoint: null,
        date: t.created_at,
      });
    });
  }

  if (filter === "semua" || filter === "point_shop") {
    const { data: requests } = await supabase
      .from("point_requests")
      .select("id, point_cost, status, requested_at, reviewed_at, reward_id")
      .eq("profile_id", childId)
      .eq("status", "approved")
      .order("requested_at", { ascending: false })
      .limit(50);

    if (requests && requests.length > 0) {
      const rewardIds = Array.from(new Set(requests.map((r) => r.reward_id)));
      const { data: rewards } = await supabase.from("point_rewards").select("id, name").in("id", rewardIds);
      const nameMap = new Map((rewards ?? []).map((r) => [r.id, r.name]));

      requests.forEach((r) => {
        items.push({
          id: r.id,
          category: "point_shop",
          title: `Tukar: ${nameMap.get(r.reward_id) ?? "Hadiah"}`,
          note: null,
          amountMoney: null,
          amountPoint: -r.point_cost,
          date: r.reviewed_at ?? r.requested_at,
        });
      });
    }
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}
