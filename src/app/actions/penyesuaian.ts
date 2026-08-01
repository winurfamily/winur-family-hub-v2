"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  rpcError,
  toRupiah,
  safeToken,
  isUuid,
  isMissingSchema,
  FORBIDDEN,
  NEEDS_0025,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { syncChildSaldoFromPocket } from "@/lib/server/child-savings";
import { todayISODate } from "@/lib/format";

/**
 * PENYESUAIAN SALDO — koreksi saldo yang selalu meninggalkan jejak.
 *
 * Saldo aplikasi bisa berbeda dari uang yang benar-benar ada: uang tunai
 * terpakai tanpa dicatat, nominal salah ketik, atau pembulatan kasir. Sebelum
 * fitur ini, satu-satunya cara memperbaikinya adalah mengarang transaksi palsu
 * — yang mencemari analitik dan menghilangkan alasan sebenarnya.
 *
 * Aturan yang tidak boleh dilanggar:
 *  - saldo TIDAK PERNAH berubah diam-diam; setiap koreksi punya barisnya,
 *  - alasan wajib diisi,
 *  - saldo sebelum & sesudah disimpan apa adanya sehingga bisa diaudit,
 *  - record + mutasi saldo terjadi dalam SATU transaksi database (RPC
 *    fin_create_adjustment), jadi mustahil ada catatan tanpa perubahan saldo
 *    atau sebaliknya,
 *  - hanya Ayah/Mamah (requireFinanceSession sudah menuntut role admin).
 */

const MAX_REASON_LENGTH = 200;

export interface AdjustmentView {
  id: string;
  /** "main" atau UUID pocket — bentuk yang sama dengan filter akun lain. */
  account: string;
  accountName: string;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  reason: string;
  date: string;
  createdByName: string;
  createdAt: string;
}

export interface AdjustmentListResult {
  ready: boolean;
  items: AdjustmentView[];
}

export interface CreateAdjustmentInput {
  /** "main" atau UUID pocket. */
  account: string;
  /**
   * Saldo sebenarnya menurut pengguna. Dipakai bila `mode` = "target".
   * Selisih dihitung server terhadap saldo terkini, bukan terhadap angka
   * yang dikirim client — supaya koreksi tetap benar meski layar sudah basi.
   */
  actualBalance?: number;
  /** Selisih langsung (boleh negatif). Dipakai bila `mode` = "delta". */
  delta?: number;
  mode: "target" | "delta";
  reason: string;
  date?: string;
  clientToken?: string;
}

/** Saldo terkini satu akun — dasar layar konfirmasi sebelum menyimpan. */
export async function getAccountBalance(
  account: string
): Promise<{ name: string; balance: number } | null> {
  const session = await requireFinanceSession();
  if (!session) return null;

  const supabase = createAdminClient();

  if (account === "main") {
    const { data } = await supabase
      .from("families")
      .select("main_balance")
      .eq("id", session.familyId)
      .maybeSingle();
    return { name: "Saldo Utama", balance: Number(data?.main_balance ?? 0) };
  }

  if (!isUuid(account)) return null;

  const { data } = await supabase
    .from("pockets")
    .select("name, balance")
    .eq("id", account)
    .eq("family_id", session.familyId)
    .maybeSingle();

  return data ? { name: data.name, balance: Number(data.balance) } : null;
}

export async function createBalanceAdjustment(
  input: CreateAdjustmentInput
): Promise<ActionResult<{ id: string; delta: number; balanceAfter: number }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const reason = input.reason?.trim();
  if (!reason) return { success: false, error: "Alasan penyesuaian wajib diisi." };
  if (reason.length > MAX_REASON_LENGTH) {
    return { success: false, error: `Alasan maksimal ${MAX_REASON_LENGTH} karakter.` };
  }

  const pocketId = input.account === "main" ? null : input.account;
  if (pocketId !== null && !isUuid(pocketId)) {
    return { success: false, error: "Pilih akun yang akan disesuaikan." };
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") ? input.date! : todayISODate();

  // Saldo terkini dibaca ulang di server. Selisih yang dihitung dari angka
  // pada layar bisa keliru bila ada transaksi lain yang masuk sementara panel
  // terbuka; yang dikirim ke RPC selalu selisih terhadap saldo sekarang.
  const current = await getAccountBalance(input.account);
  if (!current) return { success: false, error: "Akun tidak ditemukan." };

  const delta =
    input.mode === "delta"
      ? toRupiah(input.delta ?? 0)
      : toRupiah(input.actualBalance ?? 0) - current.balance;

  if (!Number.isFinite(delta)) return { success: false, error: "Nominal tidak valid." };
  if (delta === 0) {
    return { success: false, error: "Saldo aplikasi sudah sama dengan saldo sebenarnya." };
  }
  if (current.balance + delta < 0) {
    return { success: false, error: `Saldo ${current.name} tidak boleh minus.` };
  }

  const supabase = createAdminClient();
  const { data: id, error } = await supabase.rpc("fin_create_adjustment", {
    p_family_id: session.familyId,
    p_pocket_id: pocketId,
    p_delta: delta,
    p_reason: reason,
    p_date: date,
    p_created_by: session.profileId,
    p_client_token: safeToken(input.clientToken),
  });

  if (isMissingSchema(error)) return { success: false, error: NEEDS_0025 };
  if (error || !id) return { success: false, error: rpcError(error, "Gagal menyimpan penyesuaian.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "balance_adjustment",
    id,
    "create",
    { balance: current.balance },
    { balance: current.balance + delta, delta, reason, pocket_id: pocketId }
  );

  // Pocket "Tabungan {Nama}" adalah cermin celengan anak — koreksi saldo di
  // sana harus ikut mengoreksi saldo yang dilihat anaknya.
  if (pocketId) {
    await syncChildSaldoFromPocket(supabase, session.familyId, current.name, delta);
  }

  revalidateKeuangan();
  return { success: true, data: { id, delta, balanceAfter: current.balance + delta } };
}

/**
 * Batalkan sebuah penyesuaian.
 *
 * Berbeda dari menghapus riwayat transfer (yang sengaja tidak menyentuh saldo,
 * karena uangnya memang sudah berpindah): penyesuaian TIDAK mewakili uang yang
 * berpindah ke mana pun, jadi menghapusnya harus mengembalikan angkanya.
 */
export async function deleteBalanceAdjustment(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Penyesuaian tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: before, error: readError } = await supabase
    .from("balance_adjustments")
    .select("id, pocket_id, delta, reason, balance_before, balance_after")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!before) return { success: false, error: "Penyesuaian tidak ditemukan." };

  const { error } = await supabase.rpc("fin_delete_adjustment", {
    p_adjustment_id: id,
    p_family_id: session.familyId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal menghapus penyesuaian.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "balance_adjustment",
    id,
    "delete",
    {
      delta: Number(before.delta),
      reason: before.reason,
      balance_before: Number(before.balance_before),
      balance_after: Number(before.balance_after),
    },
    null
  );

  if (before.pocket_id) {
    const { data: pocket } = await supabase
      .from("pockets")
      .select("name")
      .eq("id", before.pocket_id)
      .maybeSingle();
    if (pocket) {
      await syncChildSaldoFromPocket(supabase, session.familyId, pocket.name, -Number(before.delta));
    }
  }

  revalidateKeuangan();
  return { success: true };
}

/** Riwayat penyesuaian — jejak audit yang bisa dibaca pengguna, bukan hanya audit_logs. */
export async function getBalanceAdjustments(limit = 20): Promise<AdjustmentListResult> {
  const session = await requireFinanceSession();
  if (!session) return { ready: true, items: [] };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("balance_adjustments")
    .select(
      "id, pocket_id, balance_before, balance_after, delta, reason, date, created_by, created_at"
    )
    .eq("family_id", session.familyId)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (isMissingSchema(error)) return { ready: false, items: [] };
  if (error || !data || data.length === 0) return { ready: true, items: [] };

  const pocketIds = Array.from(new Set(data.map((row) => row.pocket_id).filter(isUuid)));
  const creatorIds = Array.from(new Set(data.map((row) => row.created_by).filter(isUuid)));

  const [pocketsRes, profilesRes] = await Promise.all([
    pocketIds.length > 0
      ? supabase.from("pockets").select("id, name").eq("family_id", session.familyId).in("id", pocketIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    creatorIds.length > 0
      ? supabase.from("profiles").select("id, name").eq("family_id", session.familyId).in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const pocketNames = new Map((pocketsRes.data ?? []).map((p) => [p.id, p.name]));
  const profileNames = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name]));

  return {
    ready: true,
    items: data.map((row) => ({
      id: row.id,
      account: row.pocket_id ?? "main",
      accountName: row.pocket_id ? pocketNames.get(row.pocket_id) ?? "Pocket" : "Saldo Utama",
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      delta: Number(row.delta),
      reason: row.reason,
      date: row.date,
      createdByName: row.created_by ? profileNames.get(row.created_by) ?? "—" : "—",
      createdAt: row.created_at,
    })),
  };
}
