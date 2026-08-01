"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/server/admin-helpers";
import {
  requireFinanceSession,
  revalidateKeuangan,
  rpcError,
  toRupiah,
  isUuid,
  isMissingSchema,
  FORBIDDEN,
  NEEDS_0025,
  type AdminClient,
  type ActionResult,
} from "@/lib/server/finance-helpers";
import { syncChildSaldoFromPocket } from "@/lib/server/child-savings";
import { generateRecurringOccurrences } from "@/lib/server/recurring-server";
import { todayISODate } from "@/lib/format";
import { isIsoDate, isRecurringFrequency, shiftDate, RECURRING_LEAD_DAYS, type RecurringFrequency } from "@/lib/recurring";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  EXPENSE_CATEGORY_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
  type ExpenseCategory,
  type IncomeCategory,
  type RecurringKind,
  type RecurringOccurrenceStatus,
} from "@/lib/supabase/types";

/**
 * TRANSAKSI RUTIN — gaji, cicilan, listrik, internet, sekolah, langganan.
 *
 * Keputusan rancangan yang paling menentukan: jadwal TIDAK PERNAH langsung
 * membuat transaksi. Yang lahir otomatis hanyalah "tagihan menunggu"
 * (recurring_occurrences) yang harus dikonfirmasi manusia. Memotong saldo
 * sendiri terdengar praktis sampai satu jadwal salah nominal berjalan enam
 * bulan tanpa ada yang sadar — dan saldo aplikasi tidak lagi bisa dipercaya.
 *
 * Tiga lapis penjaga transaksi ganda:
 *  1. unique (recurring_id, due_date) di database — generator boleh jalan
 *     berkali-kali (cron, buka halaman, dua tab) tanpa menghasilkan duplikat;
 *  2. client_token RPC = id occurrence — konfirmasi yang terkirim dua kali
 *     mengembalikan transaksi yang sama, bukan membuat yang kedua;
 *  3. status occurrence diperiksa sebelum membuat transaksi.
 */

const MAX_NAME_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;

/** Kategori pengeluaran yang boleh dipakai jadwal rutin. */
const RECURRING_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter(
  // "belanja" lahir HANYA dari menu Belanja (checklist), dan alias lama
  // disembunyikan supaya tidak tampil ganda di pemilih kategori.
  (key) => key !== "belanja" && !(key in EXPENSE_CATEGORY_ALIASES)
) as readonly ExpenseCategory[];

export interface RecurringView {
  id: string;
  name: string;
  kind: RecurringKind;
  amount: number;
  categoryKey: string;
  categoryLabel: string;
  account: string;
  accountName: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextDate: string;
  endDate: string | null;
  note: string | null;
  isActive: boolean;
}

export interface OccurrenceView {
  id: string;
  recurringId: string;
  name: string;
  kind: RecurringKind;
  amount: number;
  categoryKey: string;
  categoryLabel: string;
  accountName: string;
  dueDate: string;
  status: RecurringOccurrenceStatus;
}

export interface RecurringOverview {
  /** false = migration 0025 belum dijalankan; panel menampilkan instruksi. */
  ready: boolean;
  today: string;
  schedules: RecurringView[];
  /** Jatuh tempo yang menunggu konfirmasi, terdekat lebih dulu. */
  upcoming: OccurrenceView[];
  /** Total nominal pengeluaran rutin yang menunggu — dipakai peringatan dana. */
  upcomingExpenseTotal: number;
}

function categoryLabelOf(kind: RecurringKind, key: string): string {
  if (kind === "income") {
    return INCOME_CATEGORY_LABELS[key as IncomeCategory] ?? "Lainnya";
  }
  const resolved = EXPENSE_CATEGORY_ALIASES[key as ExpenseCategory] ?? (key as ExpenseCategory);
  return EXPENSE_CATEGORY_LABELS[resolved] ?? "Lainnya";
}

function normalizeCategory(kind: RecurringKind, value: unknown): string {
  if (kind === "income") {
    return INCOME_CATEGORIES.includes(value as IncomeCategory) ? (value as IncomeCategory) : "lainnya";
  }
  const raw = value as ExpenseCategory;
  const resolved = EXPENSE_CATEGORY_ALIASES[raw] ?? raw;
  return RECURRING_EXPENSE_CATEGORIES.includes(resolved) ? resolved : "lainnya";
}

export async function getRecurringOverview(): Promise<RecurringOverview> {
  const today = todayISODate();
  const empty: RecurringOverview = {
    ready: true,
    today,
    schedules: [],
    upcoming: [],
    upcomingExpenseTotal: 0,
  };

  const session = await requireFinanceSession();
  if (!session) return empty;

  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("recurring_transactions")
    .select(
      "id, name, kind, amount, category, pocket_id, frequency, start_date, next_date, end_date, note, is_active"
    )
    .eq("family_id", session.familyId)
    .order("is_active", { ascending: false })
    .order("next_date", { ascending: true });

  if (isMissingSchema(error)) return { ...empty, ready: false };
  if (error) return empty;

  // Generator dijalankan SETELAH daftar terbaca agar halaman tetap tampil
  // walau pembuatan jatuh tempo gagal; jatuh tempo lalu diambil terpisah.
  await generateRecurringOccurrences(supabase, session.familyId, today);

  const schedules = rows ?? [];
  const pocketIds = Array.from(new Set(schedules.map((r) => r.pocket_id).filter(isUuid)));

  const [pocketsRes, occurrenceRes] = await Promise.all([
    pocketIds.length > 0
      ? supabase.from("pockets").select("id, name").eq("family_id", session.familyId).in("id", pocketIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("recurring_occurrences")
      .select("id, recurring_id, due_date, status, amount")
      .eq("family_id", session.familyId)
      .eq("status", "pending")
      .lte("due_date", shiftDate(today, RECURRING_LEAD_DAYS))
      .order("due_date", { ascending: true })
      .limit(50),
  ]);

  const pocketNames = new Map((pocketsRes.data ?? []).map((p) => [p.id, p.name]));
  const accountNameOf = (pocketId: string | null) =>
    pocketId ? pocketNames.get(pocketId) ?? "Pocket" : "Saldo Utama";

  const views: RecurringView[] = schedules.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    amount: Number(row.amount),
    categoryKey: row.category,
    categoryLabel: categoryLabelOf(row.kind, row.category),
    account: row.pocket_id ?? "main",
    accountName: accountNameOf(row.pocket_id),
    frequency: isRecurringFrequency(row.frequency) ? row.frequency : "monthly",
    startDate: row.start_date,
    nextDate: row.next_date,
    endDate: row.end_date,
    note: row.note,
    isActive: row.is_active,
  }));

  const byId = new Map(views.map((view) => [view.id, view]));

  const upcoming: OccurrenceView[] = (occurrenceRes.data ?? [])
    .map((row) => {
      const schedule = byId.get(row.recurring_id);
      if (!schedule) return null;
      return {
        id: row.id,
        recurringId: row.recurring_id,
        name: schedule.name,
        kind: schedule.kind,
        amount: Number(row.amount),
        categoryKey: schedule.categoryKey,
        categoryLabel: schedule.categoryLabel,
        accountName: schedule.accountName,
        dueDate: row.due_date,
        status: row.status,
      };
    })
    .filter((item): item is OccurrenceView => item !== null);

  return {
    ready: true,
    today,
    schedules: views,
    upcoming,
    upcomingExpenseTotal: upcoming
      .filter((item) => item.kind === "expense")
      .reduce((acc, item) => acc + item.amount, 0),
  };
}

// ---------------------------------------------------------------------------
// Kelola jadwal
// ---------------------------------------------------------------------------

export interface RecurringInput {
  name: string;
  kind: RecurringKind;
  amount: number;
  category: string;
  /** "main" atau UUID pocket. */
  account: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  note?: string;
  isActive?: boolean;
}

interface ValidatedRecurring {
  name: string;
  kind: RecurringKind;
  amount: number;
  category: string;
  pocketId: string | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  note: string | null;
}

function validate(input: RecurringInput): { value?: ValidatedRecurring; error?: string } {
  const name = input.name?.trim();
  if (!name) return { error: "Nama transaksi wajib diisi." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Nama maksimal ${MAX_NAME_LENGTH} karakter.` };
  }

  const kind: RecurringKind = input.kind === "income" ? "income" : "expense";

  const amount = toRupiah(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Nominal harus lebih dari 0." };

  if (!isRecurringFrequency(input.frequency)) return { error: "Pilih frekuensi jadwal." };
  if (!isIsoDate(input.startDate)) return { error: "Tanggal mulai tidak valid." };

  const endDate = input.endDate?.trim() ? input.endDate.trim() : null;
  if (endDate !== null && !isIsoDate(endDate)) return { error: "Tanggal berakhir tidak valid." };
  if (endDate !== null && endDate < input.startDate) {
    return { error: "Tanggal berakhir harus setelah tanggal mulai." };
  }

  const pocketId = input.account === "main" ? null : input.account;
  if (pocketId !== null && !isUuid(pocketId)) return { error: "Pilih sumber atau tujuan saldo." };

  const note = input.note?.trim() ? input.note.trim().slice(0, MAX_NOTE_LENGTH) : null;

  return {
    value: {
      name,
      kind,
      amount,
      category: normalizeCategory(kind, input.category),
      pocketId,
      frequency: input.frequency,
      startDate: input.startDate,
      endDate,
      note,
    },
  };
}

async function assertPocket(
  supabase: AdminClient,
  familyId: string,
  pocketId: string | null
): Promise<boolean> {
  if (!pocketId) return true;
  const { data } = await supabase
    .from("pockets")
    .select("id")
    .eq("id", pocketId)
    .eq("family_id", familyId)
    .maybeSingle();
  return Boolean(data);
}

export async function createRecurring(input: RecurringInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };

  const { value, error: invalid } = validate(input);
  if (!value) return { success: false, error: invalid };

  const supabase = createAdminClient();
  if (!(await assertPocket(supabase, session.familyId, value.pocketId))) {
    return { success: false, error: "Pocket tidak ditemukan." };
  }

  const { data, error } = await supabase
    .from("recurring_transactions")
    .insert({
      family_id: session.familyId,
      name: value.name,
      kind: value.kind,
      amount: value.amount,
      category: value.category,
      pocket_id: value.pocketId,
      frequency: value.frequency,
      start_date: value.startDate,
      // Jadwal baru mulai menagih dari tanggal mulainya sendiri; jatuh tempo
      // yang sudah lewat tetap dibuat agar tagihan lama tidak hilang diam-diam.
      next_date: value.startDate,
      end_date: value.endDate,
      note: value.note,
      is_active: input.isActive !== false,
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (isMissingSchema(error)) return { success: false, error: NEEDS_0025 };
  if (error || !data) return { success: false, error: "Gagal menyimpan transaksi rutin." };

  await generateRecurringOccurrences(supabase, session.familyId);
  await logAudit(supabase, session.familyId, session.profileId, "recurring", data.id, "create", null, {
    name: value.name,
    kind: value.kind,
    amount: value.amount,
    frequency: value.frequency,
  });

  revalidateKeuangan();
  return { success: true, data: { id: data.id } };
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Jadwal tidak ditemukan." };

  const { value, error: invalid } = validate(input);
  if (!value) return { success: false, error: invalid };

  const supabase = createAdminClient();
  const { data: before, error: readError } = await supabase
    .from("recurring_transactions")
    .select("id, name, amount, next_date, start_date, frequency")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!before) return { success: false, error: "Jadwal tidak ditemukan." };
  if (!(await assertPocket(supabase, session.familyId, value.pocketId))) {
    return { success: false, error: "Pocket tidak ditemukan." };
  }

  // Mengubah tanggal mulai atau frekuensi berarti seluruh ritmenya berubah,
  // jadi titik hitung berikutnya dimulai ulang dari tanggal mulai yang baru.
  // Jatuh tempo yang SUDAH dibuat tidak diusik — unique(recurring_id,
  // due_date) tetap mencegah tanggal yang sama lahir dua kali.
  const rhythmChanged =
    before.start_date !== value.startDate || before.frequency !== value.frequency;

  const { error } = await supabase
    .from("recurring_transactions")
    .update({
      name: value.name,
      kind: value.kind,
      amount: value.amount,
      category: value.category,
      pocket_id: value.pocketId,
      frequency: value.frequency,
      start_date: value.startDate,
      ...(rhythmChanged ? { next_date: value.startDate } : {}),
      end_date: value.endDate,
      note: value.note,
      ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal memperbarui transaksi rutin." };

  await generateRecurringOccurrences(supabase, session.familyId);
  await logAudit(
    supabase,
    session.familyId,
    session.profileId,
    "recurring",
    id,
    "update",
    { name: before.name, amount: Number(before.amount) },
    { name: value.name, amount: value.amount }
  );

  revalidateKeuangan();
  return { success: true };
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Jadwal tidak ditemukan." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("recurring_transactions")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (isMissingSchema(error)) return { success: false, error: NEEDS_0025 };
  if (error) return { success: false, error: "Gagal mengubah status jadwal." };

  // Menonaktifkan jadwal juga membatalkan tagihan yang masih menunggu —
  // membiarkannya berarti tagihan "hantu" tetap bisa dikonfirmasi setelah
  // jadwalnya dimatikan.
  if (!active) {
    await supabase
      .from("recurring_occurrences")
      .update({ status: "skipped", resolved_at: new Date().toISOString() })
      .eq("family_id", session.familyId)
      .eq("recurring_id", id)
      .eq("status", "pending");
  } else {
    await generateRecurringOccurrences(supabase, session.familyId);
  }

  await logAudit(supabase, session.familyId, session.profileId, "recurring", id, active ? "activate" : "deactivate", null, null);
  revalidateKeuangan();
  return { success: true };
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(id)) return { success: false, error: "Jadwal tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: before, error: readError } = await supabase
    .from("recurring_transactions")
    .select("name, kind, amount")
    .eq("id", id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!before) return { success: false, error: "Jadwal tidak ditemukan." };

  // Occurrences ikut terhapus lewat ON DELETE CASCADE. Transaksi yang sudah
  // terlanjur dikonfirmasi TIDAK ikut — uangnya memang sudah berpindah.
  const { error } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal menghapus jadwal." };

  await logAudit(supabase, session.familyId, session.profileId, "recurring", id, "delete", {
    name: before.name,
    amount: Number(before.amount),
  }, null);

  revalidateKeuangan();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Tindakan atas satu jatuh tempo
// ---------------------------------------------------------------------------

/**
 * Konfirmasi satu tagihan → transaksi sungguhan di Keuangan.
 *
 * `client_token` sengaja diisi dengan ID occurrence itu sendiri. Karena kedua
 * RPC keuangan sudah idempotent terhadap token, konfirmasi yang terkirim dua
 * kali (klik ganda, jaringan putus lalu diulang, dua tab) mengembalikan
 * transaksi yang SAMA — bukan memotong saldo dua kali. Tokennya deterministik,
 * jadi penjaga itu bekerja bahkan lintas perangkat.
 */
export async function confirmRecurringOccurrence(
  occurrenceId: string,
  overrideAmount?: number
): Promise<ActionResult<{ transactionId: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(occurrenceId)) return { success: false, error: "Tagihan tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: occurrence, error: readError } = await supabase
    .from("recurring_occurrences")
    .select("id, recurring_id, due_date, status, amount, income_id, transaction_id")
    .eq("id", occurrenceId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!occurrence) return { success: false, error: "Tagihan tidak ditemukan." };

  if (occurrence.status === "confirmed") {
    const existing = occurrence.income_id ?? occurrence.transaction_id;
    return existing
      ? { success: true, data: { transactionId: existing } }
      : { success: false, error: "Tagihan ini sudah dikonfirmasi." };
  }
  if (occurrence.status === "skipped") {
    return { success: false, error: "Tagihan ini sudah dilewati." };
  }

  const { data: schedule } = await supabase
    .from("recurring_transactions")
    .select("id, name, kind, amount, category, pocket_id, note")
    .eq("id", occurrence.recurring_id)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (!schedule) return { success: false, error: "Jadwal tidak ditemukan." };

  const amount =
    overrideAmount !== undefined && Number.isFinite(toRupiah(overrideAmount)) && toRupiah(overrideAmount) > 0
      ? toRupiah(overrideAmount)
      : Number(occurrence.amount);

  if (amount <= 0) return { success: false, error: "Nominal harus lebih dari 0." };

  const note = [schedule.note, `Transaksi rutin · jatuh tempo ${occurrence.due_date}`]
    .filter(Boolean)
    .join(" · ")
    .slice(0, MAX_NOTE_LENGTH);

  if (schedule.kind === "income") {
    const { data: incomeId, error } = await supabase.rpc("fin_create_income", {
      p_family_id: session.familyId,
      p_source: schedule.name,
      p_amount: amount,
      p_date: occurrence.due_date,
      p_pocket_id: schedule.pocket_id,
      p_category: schedule.category,
      p_note: note,
      p_created_by: session.profileId,
      p_client_token: occurrence.id,
    });

    if (error || !incomeId) {
      return { success: false, error: rpcError(error, "Gagal mencatat pendapatan rutin.") };
    }

    await supabase
      .from("recurring_occurrences")
      .update({
        status: "confirmed",
        amount,
        income_id: incomeId,
        resolved_at: new Date().toISOString(),
        resolved_by: session.profileId,
      })
      .eq("id", occurrence.id)
      .eq("family_id", session.familyId);

    await syncPocket(supabase, session.familyId, schedule.pocket_id, amount);
    await logAudit(supabase, session.familyId, session.profileId, "recurring_occurrence", occurrence.id, "confirm", null, {
      kind: "income",
      amount,
      income_id: incomeId,
    });

    revalidateKeuangan();
    return { success: true, data: { transactionId: incomeId } };
  }

  const { data: transactionId, error } = await supabase.rpc("fin_create_shopping", {
    p_family_id: session.familyId,
    p_merchant: schedule.name,
    p_date: occurrence.due_date,
    p_pocket_id: schedule.pocket_id,
    p_category: schedule.category,
    p_note: note,
    p_source: "manual",
    p_plan_id: null,
    p_items: [{ name: schedule.name, qty: 1, price: amount }],
    p_created_by: session.profileId,
    p_client_token: occurrence.id,
  });

  if (error || !transactionId) {
    return { success: false, error: rpcError(error, "Gagal mencatat pengeluaran rutin.") };
  }

  await supabase
    .from("recurring_occurrences")
    .update({
      status: "confirmed",
      amount,
      transaction_id: transactionId,
      resolved_at: new Date().toISOString(),
      resolved_by: session.profileId,
    })
    .eq("id", occurrence.id)
    .eq("family_id", session.familyId);

  await syncPocket(supabase, session.familyId, schedule.pocket_id, -amount);
  await logAudit(supabase, session.familyId, session.profileId, "recurring_occurrence", occurrence.id, "confirm", null, {
    kind: "expense",
    amount,
    transaction_id: transactionId,
  });

  revalidateKeuangan();
  return { success: true, data: { transactionId } };
}

/** Pocket "Tabungan {Nama}" adalah cermin celengan anak. */
async function syncPocket(
  supabase: AdminClient,
  familyId: string,
  pocketId: string | null,
  delta: number
) {
  if (!pocketId || !delta) return;
  const { data: pocket } = await supabase.from("pockets").select("name").eq("id", pocketId).maybeSingle();
  if (pocket) await syncChildSaldoFromPocket(supabase, familyId, pocket.name, delta);
}

/** Lewati satu jatuh tempo. Jadwalnya tetap berjalan untuk periode berikutnya. */
export async function skipRecurringOccurrence(occurrenceId: string): Promise<ActionResult> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(occurrenceId)) return { success: false, error: "Tagihan tidak ditemukan." };

  const supabase = createAdminClient();
  const { data: occurrence, error: readError } = await supabase
    .from("recurring_occurrences")
    .select("id, status")
    .eq("id", occurrenceId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!occurrence) return { success: false, error: "Tagihan tidak ditemukan." };
  if (occurrence.status === "confirmed") {
    return { success: false, error: "Tagihan ini sudah menjadi transaksi dan tidak bisa dilewati." };
  }

  const { error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      resolved_at: new Date().toISOString(),
      resolved_by: session.profileId,
    })
    .eq("id", occurrenceId)
    .eq("family_id", session.familyId);

  if (error) return { success: false, error: "Gagal melewati tagihan." };

  revalidateKeuangan();
  return { success: true };
}

/**
 * Tunda satu tagihan beberapa hari.
 *
 * Tanggal jatuh tempo digeser, bukan dibuatkan baris baru, sehingga jumlah
 * tagihan tidak bertambah. Bila tanggal tujuan sudah dipakai oleh jatuh tempo
 * lain dari jadwal yang sama, database menolaknya (unique constraint) dan
 * pesannya dijelaskan apa adanya — itu justru penjaga duplikat yang bekerja.
 */
export async function snoozeRecurringOccurrence(
  occurrenceId: string,
  days = 3
): Promise<ActionResult<{ dueDate: string }>> {
  const session = await requireFinanceSession();
  if (!session) return { success: false, error: FORBIDDEN };
  if (!isUuid(occurrenceId)) return { success: false, error: "Tagihan tidak ditemukan." };

  const shift = Math.min(30, Math.max(1, Math.round(Number(days) || 0)));

  const supabase = createAdminClient();
  const { data: occurrence, error: readError } = await supabase
    .from("recurring_occurrences")
    .select("id, due_date, status")
    .eq("id", occurrenceId)
    .eq("family_id", session.familyId)
    .maybeSingle();

  if (isMissingSchema(readError)) return { success: false, error: NEEDS_0025 };
  if (!occurrence) return { success: false, error: "Tagihan tidak ditemukan." };
  if (occurrence.status !== "pending") {
    return { success: false, error: "Hanya tagihan yang belum diproses bisa ditunda." };
  }

  const dueDate = shiftDate(occurrence.due_date, shift);
  const { error } = await supabase
    .from("recurring_occurrences")
    .update({ due_date: dueDate })
    .eq("id", occurrenceId)
    .eq("family_id", session.familyId);

  if (error?.code === "23505") {
    return { success: false, error: "Sudah ada tagihan jadwal ini pada tanggal tersebut." };
  }
  if (error) return { success: false, error: "Gagal menunda tagihan." };

  revalidateKeuangan();
  return { success: true, data: { dueDate } };
}
