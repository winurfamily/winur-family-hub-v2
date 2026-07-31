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
  FORBIDDEN,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { syncChildSaldoFromPocket } from "@/lib/server/child-savings";
import { INCOME_CATEGORIES, type IncomeCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Bentuk data
// ---------------------------------------------------------------------------

export interface IncomeItem {
  id: string;
  source: string;
  amount: number;
  date: string;
  category: IncomeCategory;
  note: string | null;
  /** NULL = Saldo Utama. */
  pocketId: string | null;
  pocketName: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type IncomeSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export interface IncomeListFilter {
  search?: string;
  /** "YYYY-MM" */
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  pocketId?: string;
  createdBy?: string;
  sort?: IncomeSort;
  page?: number;
  pageSize?: number;
}

export interface IncomeListResult {
  items: IncomeItem[];
  total: number;
  page: number;
  pageSize: number;
  sumAmount: number;
}

function normalizeCategory(value: unknown): IncomeCategory {
  return INCOME_CATEGORIES.includes(value as IncomeCategory) ? (value as IncomeCategory) : "lainnya";
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------

export async function getIncomeList(filter: IncomeListFilter = {}): Promise<IncomeListResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20));

  const session = await requireFinanceSession();
  if (!session) return { items: [], total: 0, page, pageSize, sumAmount: 0 };

  const supabase = createAdminClient();

  let query = supabase
    .from("income")
    .select("id, source, amount, date, category, note, pocket_id, created_by, created_at, updated_at", {
      count: "exact",
    })
    .eq("family_id", session.familyId);

  if (filter.search?.trim()) {
    const term = filter.search.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`source.ilike.%${term}%,note.ilike.%${term}%`);
  }
  if (filter.month) {
    const [y, m] = filter.month.split("-").map(Number);
    if (y && m) {
      const last = new Date(y, m, 0).getDate();
      query = query.gte("date", `${filter.month}-01`).lte("date", `${filter.month}-${String(last).padStart(2, "0")}`);
    }
  }
  if (filter.dateFrom) query = query.gte("date", filter.dateFrom);
  if (filter.dateTo) query = query.lte("date", filter.dateTo);
  if (filter.category && filter.category !== "all") query = query.eq("category", filter.category);
  if (filter.pocketId === "main") query = query.is("pocket_id", null);
  else if (isUuid(filter.pocketId)) query = query.eq("pocket_id", filter.pocketId);
  if (isUuid(filter.createdBy)) query = query.eq("created_by", filter.createdBy);

  switch (filter.sort ?? "newest") {
    case "oldest":
      query = query.order("date", { ascending: true }).order("created_at", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    default:
      query = query.order("date", { ascending: false }).order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, count } = await query.range(from, from + pageSize - 1);

  const rows = data ?? [];
  const pocketIds = Array.from(new Set(rows.map((r) => r.pocket_id).filter(isUuid)));
  const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(isUuid)));

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
    items: rows.map((r) => ({
      id: r.id,
      source: r.source,
      amount: Number(r.amount),
      date: r.date,
      category: normalizeCategory(r.category),
      note: r.note,
      pocketId: r.pocket_id,
      pocketName: r.pocket_id ? pocketNames.get(r.pocket_id) ?? "Pocket" : "Saldo Utama",
      createdByName: r.created_by ? profileNames.get(r.created_by) ?? "—" : "—",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total: count ?? 0,
    page,
    pageSize,
    // Jumlah pada halaman yang sedang tampil.
    sumAmount: rows.reduce((acc, r) => acc + Number(r.amount), 0),
  };
}

export async function getIncomeDetail(id: string): Promise<IncomeItem | null> {
  if (!isUuid(id)) return null;

  const session = await requireFinanceSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("income")
    .select("id, source, amount, date, category, note, pocket_id, created_by, created_at, updated_at")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!data) return null;

  const [pocketRes, profileRes] = await Promise.all([
    data.pocket_id
      ? supabase.from("pockets").select("name").eq("id", data.pocket_id).maybeSingle()
      : Promise.resolve({ data: null }),
    data.created_by
      ? supabase.from("profiles").select("name").eq("id", data.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: data.id,
    source: data.source,
    amount: Number(data.amount),
    date: data.date,
    category: normalizeCategory(data.category),
    note: data.note,
    pocketId: data.pocket_id,
    pocketName: data.pocket_id ? pocketRes.data?.name ?? "Pocket" : "Saldo Utama",
    createdByName: profileRes.data?.name ?? "—",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** Ringkas untuk card "Pendapatan Terbaru" di dashboard. */
export async function getIncomeHistory(limit = 5): Promise<IncomeItem[]> {
  const result = await getIncomeList({ pageSize: Math.min(50, Math.max(1, limit)) });
  return result.items;
}

// ---------------------------------------------------------------------------
// Tulis
// ---------------------------------------------------------------------------

export interface IncomeMutationInput {
  source: string;
  amount: number;
  date: string;
  /** "main" atau UUID pocket. */
  target: string;
  category: string;
  note?: string;
  clientToken?: string;
}

function validate(input: IncomeMutationInput): { error?: string; amount: number; pocketId: string | null } {
  const amount = toRupiah(input.amount);
  const source = input.source?.trim() ?? "";

  if (!source) return { error: "Sumber pendapatan wajib diisi.", amount: 0, pocketId: null };
  if (source.length > 60) return { error: "Sumber pendapatan maksimal 60 karakter.", amount: 0, pocketId: null };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Nominal harus lebih dari 0.", amount: 0, pocketId: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) {
    return { error: "Tanggal tidak valid.", amount: 0, pocketId: null };
  }

  const pocketId = input.target === "main" ? null : input.target;
  if (pocketId !== null && !isUuid(pocketId)) {
    return { error: "Rekening tujuan tidak valid.", amount: 0, pocketId: null };
  }

  return { amount, pocketId };
}

export async function addIncome(input: IncomeMutationInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const { error: invalid, amount, pocketId } = validate(input);
  if (invalid) return { success: false, error: invalid };

  const supabase = createAdminClient();
  const { data: id, error } = await supabase.rpc("fin_create_income", {
    p_family_id: session.familyId,
    p_source: input.source.trim(),
    p_amount: amount,
    p_date: input.date,
    p_pocket_id: pocketId,
    p_category: normalizeCategory(input.category),
    p_note: input.note?.trim() || null,
    p_created_by: session.profileId,
    p_client_token: safeToken(input.clientToken),
  });

  if (error || !id) return { success: false, error: rpcError(error, "Gagal menyimpan pendapatan.") };

  await logAudit(supabase, session.familyId, session.profileId, "income", id, "create", null, {
    source: input.source.trim(),
    amount,
    date: input.date,
    pocket_id: pocketId,
  });

  await syncPocketMirror(supabase, session.familyId, pocketId, amount);
  revalidateKeuangan();
  return { success: true, data: { id } };
}

export async function updateIncome(
  id: string,
  input: IncomeMutationInput
): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Pendapatan tidak ditemukan." };

  const { error: invalid, amount, pocketId } = validate(input);
  if (invalid) return { success: false, error: invalid };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("income")
    .select("source, amount, date, pocket_id, category, note")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!before) return { success: false, error: "Pendapatan tidak ditemukan." };

  const { error } = await supabase.rpc("fin_update_income", {
    p_income_id: id,
    p_family_id: session.familyId,
    p_source: input.source.trim(),
    p_amount: amount,
    p_date: input.date,
    p_pocket_id: pocketId,
    p_category: normalizeCategory(input.category),
    p_note: input.note?.trim() || null,
    p_updated_by: session.profileId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal memperbarui pendapatan.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "income",
    id,
    "update",
    { ...before, amount: Number(before.amount) },
    { source: input.source.trim(), amount, date: input.date, pocket_id: pocketId }
  );

  // Cerminkan selisih ke celengan anak bila akun terkait adalah pocket tabungan.
  const oldPocket = before.pocket_id;
  const oldAmount = Number(before.amount);
  if (oldPocket !== pocketId) {
    await syncPocketMirror(supabase, session.familyId, oldPocket, -oldAmount);
    await syncPocketMirror(supabase, session.familyId, pocketId, amount);
  } else {
    await syncPocketMirror(supabase, session.familyId, pocketId, amount - oldAmount);
  }

  revalidateKeuangan();
  return { success: true };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Pendapatan tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("income")
    .select("source, amount, date, pocket_id, category, note")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!before) return { success: false, error: "Pendapatan tidak ditemukan." };

  const { error } = await supabase.rpc("fin_delete_income", {
    p_income_id: id,
    p_family_id: session.familyId,
  });

  if (error) return { success: false, error: rpcError(error, "Gagal menghapus pendapatan.") };

  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "income",
    id,
    "delete",
    { ...before, amount: Number(before.amount) },
    null
  );

  await syncPocketMirror(supabase, session.familyId, before.pocket_id, -Number(before.amount));
  revalidateKeuangan();
  return { success: true };
}

/** Sinkronkan pocket "Tabungan {Nama}" ke celengan anak setelah saldo berubah. */
async function syncPocketMirror(
  supabase: ReturnType<typeof createAdminClient>,
  familyId: string,
  pocketId: string | null,
  delta: number
) {
  if (!pocketId || !delta) return;
  const { data: pocket } = await supabase.from("pockets").select("name").eq("id", pocketId).maybeSingle();
  if (pocket) await syncChildSaldoFromPocket(supabase, familyId, pocket.name, delta);
}

// ---------------------------------------------------------------------------
// Opsi filter
// ---------------------------------------------------------------------------

export interface IncomeFilterOptions {
  pockets: { id: string; name: string }[];
  creators: { id: string; name: string }[];
}

export async function getIncomeFilterOptions(): Promise<IncomeFilterOptions> {
  const session = await requireFinanceSession();
  if (!session) return { pockets: [], creators: [] };

  const supabase = createAdminClient();
  const [pocketsRes, adminsRes] = await Promise.all([
    supabase.from("pockets").select("id, name").eq("family_id", session.familyId).order("created_at"),
    supabase.from("profiles").select("id, name").eq("family_id", session.familyId).eq("role", "admin").order("name"),
  ]);

  return {
    pockets: pocketsRes.data ?? [],
    creators: adminsRes.data ?? [],
  };
}
