import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test integrasi migration 0025 terhadap Supabase sungguhan:
 * penyesuaian saldo + generator transaksi rutin.
 *
 * Setiap test membuat KELUARGA SENDIRI bernama `__test__…` dan menghapusnya
 * kembali setelah selesai, jadi data keluarga asli tidak pernah tersentuh —
 * satu proyek Supabase yang sama melayani dev dan produksi.
 *
 * Dilewati otomatis (bukan gagal) bila kredensial tidak tersedia ATAU
 * migration 0025 belum dijalankan, supaya `npm test` tetap hijau di mesin
 * yang belum menerapkannya.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function schemaReady(): Promise<boolean> {
  if (!url || !key) return false;
  const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [adjustments, recurring] = await Promise.all([
    probe.from("balance_adjustments").select("id").limit(1),
    probe.from("recurring_transactions").select("id").limit(1),
  ]);

  if (adjustments.error || recurring.error) {
    console.warn(
      "\n[dilewati] Migration 0025 belum diterapkan ke Supabase.\n" +
        "           Jalankan supabase/migrations/0025_adjustment_recurring_shopping.sql\n" +
        "           di SQL Editor, lalu ulangi `npm test`.\n"
    );
    return false;
  }
  return true;
}

const d = (await schemaReady()) ? describe : describe.skip;

let db: SupabaseClient;
let familyId: string;
let actorId: string;
const createdFamilies: string[] = [];

async function mainBalance(id = familyId): Promise<number> {
  const { data } = await db.from("families").select("main_balance").eq("id", id).single();
  return Number(data!.main_balance);
}

async function pocketBalance(id: string): Promise<number> {
  const { data } = await db.from("pockets").select("balance").eq("id", id).single();
  return Number(data!.balance);
}

async function seedMainBalance(amount: number, id = familyId) {
  await db.from("families").update({ main_balance: amount }).eq("id", id);
}

async function createFamily(): Promise<{ familyId: string; actorId: string }> {
  const { data: family, error } = await db
    .from("families")
    .insert({ name: `__test__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, setup_complete: false })
    .select("id")
    .single();
  if (error) throw new Error(`gagal membuat family test: ${error.message}`);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .insert({ family_id: family!.id, role: "admin", name: "Tester" })
    .select("id")
    .single();
  if (profileError) throw new Error(`gagal membuat profil test: ${profileError.message}`);

  createdFamilies.push(family!.id);
  return { familyId: family!.id, actorId: profile!.id };
}

d("Penyesuaian saldo & transaksi rutin (integrasi Supabase)", () => {
  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const created = await createFamily();
    familyId = created.familyId;
    actorId = created.actorId;
  });

  afterAll(async () => {
    // Bersihkan mengikuti urutan foreign key.
    for (const id of createdFamilies) {
      const { data: trx } = await db.from("shopping_transactions").select("id").eq("family_id", id);
      const trxIds = (trx ?? []).map((t) => t.id);
      if (trxIds.length > 0) {
        await db.from("shopping_transaction_items").delete().in("transaction_id", trxIds);
      }
      await db.from("recurring_occurrences").delete().eq("family_id", id);
      await db.from("recurring_transactions").delete().eq("family_id", id);
      await db.from("balance_adjustments").delete().eq("family_id", id);
      await db.from("shopping_transactions").delete().eq("family_id", id);
      await db.from("pocket_transfers").delete().eq("family_id", id);
      await db.from("income").delete().eq("family_id", id);
      await db.from("audit_logs").delete().eq("family_id", id);
      await db.from("products").delete().eq("family_id", id);
      await db.from("pockets").delete().eq("family_id", id);
      await db.from("profiles").delete().eq("family_id", id);
      await db.from("families").delete().eq("id", id);
    }
  });

  // -------------------------------------------------------------------------
  // Penyesuaian saldo
  // -------------------------------------------------------------------------

  it("penyesuaian POSITIF menambah saldo dan tercatat lengkap", async () => {
    await seedMainBalance(1_000_000);

    const { data: id, error } = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: 250_000,
      p_reason: "Uang tunai ditemukan di laci",
      p_date: "2026-08-01",
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).toBeNull();
    expect(await mainBalance()).toBe(1_250_000);

    const { data: row } = await db
      .from("balance_adjustments")
      .select("balance_before, balance_after, delta, reason, created_by, pocket_id, date")
      .eq("id", id as string)
      .single();

    // Seluruh jejak audit harus ada — inilah yang membedakan penyesuaian dari
    // saldo yang berubah diam-diam.
    expect(Number(row!.balance_before)).toBe(1_000_000);
    expect(Number(row!.balance_after)).toBe(1_250_000);
    expect(Number(row!.delta)).toBe(250_000);
    expect(row!.reason).toBe("Uang tunai ditemukan di laci");
    expect(row!.created_by).toBe(actorId);
    expect(row!.pocket_id).toBeNull();
    expect(row!.date).toBe("2026-08-01");
  });

  it("penyesuaian NEGATIF mengurangi saldo", async () => {
    await seedMainBalance(1_000_000);

    const { error } = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: -150_000,
      p_reason: "Belanja tunai tidak tercatat",
      p_date: "2026-08-02",
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).toBeNull();
    expect(await mainBalance()).toBe(850_000);
  });

  it("menyesuaikan saldo pocket, bukan hanya Saldo Utama", async () => {
    const { data: pocket } = await db
      .from("pockets")
      .insert({ family_id: familyId, name: "Pocket Uji", type: "custom", balance: 500_000 })
      .select("id")
      .single();

    const { error } = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: pocket!.id,
      p_delta: -100_000,
      p_reason: "Selisih hitung dompet",
      p_date: "2026-08-03",
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).toBeNull();
    expect(await pocketBalance(pocket!.id)).toBe(400_000);
  });

  it("menolak selisih nol, alasan kosong, dan saldo minus", async () => {
    await seedMainBalance(100_000);

    const zero = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: 0,
      p_reason: "Tidak ada perubahan",
      p_date: "2026-08-04",
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(zero.error).not.toBeNull();

    const noReason = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: 10_000,
      p_reason: "   ",
      p_date: "2026-08-04",
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(noReason.error).not.toBeNull();

    const negative = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: -500_000,
      p_reason: "Terlalu besar",
      p_date: "2026-08-04",
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(negative.error).not.toBeNull();

    // Semua penolakan terjadi SEBELUM saldo disentuh.
    expect(await mainBalance()).toBe(100_000);
  });

  it("token idempotency mencegah selisih diterapkan dua kali", async () => {
    await seedMainBalance(1_000_000);
    const token = crypto.randomUUID();

    const args = {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: 75_000,
      p_reason: "Koreksi ganda",
      p_date: "2026-08-05",
      p_created_by: actorId,
      p_client_token: token,
    };

    const first = await db.rpc("fin_create_adjustment", args);
    const second = await db.rpc("fin_create_adjustment", args);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).toBe(first.data);
    expect(await mainBalance()).toBe(1_075_000);

    const { count } = await db
      .from("balance_adjustments")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("client_token", token);
    expect(count).toBe(1);
  });

  it("menghapus penyesuaian mengembalikan saldonya", async () => {
    await seedMainBalance(1_000_000);

    const { data: id } = await db.rpc("fin_create_adjustment", {
      p_family_id: familyId,
      p_pocket_id: null,
      p_delta: -200_000,
      p_reason: "Salah ketik nominal",
      p_date: "2026-08-06",
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(await mainBalance()).toBe(800_000);

    const { error } = await db.rpc("fin_delete_adjustment", {
      p_adjustment_id: id as string,
      p_family_id: familyId,
    });

    expect(error).toBeNull();
    expect(await mainBalance()).toBe(1_000_000);

    const { data: gone } = await db
      .from("balance_adjustments")
      .select("id")
      .eq("id", id as string)
      .maybeSingle();
    expect(gone).toBeNull();
  });

  it("tidak bisa menyentuh penyesuaian keluarga lain", async () => {
    const other = await createFamily();
    await seedMainBalance(500_000, other.familyId);

    const { data: id } = await db.rpc("fin_create_adjustment", {
      p_family_id: other.familyId,
      p_pocket_id: null,
      p_delta: 100_000,
      p_reason: "Milik keluarga lain",
      p_date: "2026-08-07",
      p_created_by: other.actorId,
      p_client_token: null,
    });

    // family_id yang keliru harus ditolak, bukan diam-diam berhasil.
    const { error } = await db.rpc("fin_delete_adjustment", {
      p_adjustment_id: id as string,
      p_family_id: familyId,
    });

    expect(error).not.toBeNull();
    expect(await mainBalance(other.familyId)).toBe(600_000);
  });

  // -------------------------------------------------------------------------
  // Transaksi rutin
  // -------------------------------------------------------------------------

  async function createSchedule(overrides: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await db
      .from("recurring_transactions")
      .insert({
        family_id: familyId,
        name: "Listrik PLN",
        kind: "expense",
        amount: 300_000,
        category: "tagihan",
        frequency: "monthly",
        start_date: "2026-06-10",
        next_date: "2026-06-10",
        created_by: actorId,
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw new Error(`gagal membuat jadwal: ${error.message}`);
    return data!.id as string;
  }

  it("membuat satu tagihan per periode sampai horizon", async () => {
    const scheduleId = await createSchedule();

    const { data: created, error } = await db.rpc("fin_generate_recurring_occurrences", {
      p_family_id: familyId,
      p_horizon: "2026-08-15",
    });

    expect(error).toBeNull();
    expect(created).toBe(3); // 10 Juni, 10 Juli, 10 Agustus

    const { data: rows } = await db
      .from("recurring_occurrences")
      .select("due_date, status, amount")
      .eq("recurring_id", scheduleId)
      .order("due_date");

    expect(rows!.map((r) => r.due_date)).toEqual(["2026-06-10", "2026-07-10", "2026-08-10"]);
    expect(rows!.every((r) => r.status === "pending")).toBe(true);
    expect(Number(rows![0].amount)).toBe(300_000);

    // Titik hitung berikutnya sudah maju melewati horizon.
    const { data: schedule } = await db
      .from("recurring_transactions")
      .select("next_date")
      .eq("id", scheduleId)
      .single();
    expect(schedule!.next_date).toBe("2026-09-10");
  });

  /**
   * PENJAGA UTAMA transaksi rutin ganda. Generator berjalan dari cron HARIAN
   * dan dari setiap pemuatan halaman Keuangan — kalau tidak idempotent, satu
   * hari sibuk bisa melahirkan puluhan tagihan untuk tanggal yang sama.
   */
  it("menjalankan generator berulang kali TIDAK membuat tagihan ganda", async () => {
    const scheduleId = await createSchedule({ name: "Internet", start_date: "2026-07-01", next_date: "2026-07-01" });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-15" });
    const { count: after1 } = await db
      .from("recurring_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("recurring_id", scheduleId);

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-15" });
    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-15" });

    const { count: after3 } = await db
      .from("recurring_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("recurring_id", scheduleId);

    expect(after1).toBe(2); // 1 Juli, 1 Agustus
    expect(after3).toBe(after1);
  });

  it("berhenti pada tanggal berakhir dan menonaktifkan jadwalnya", async () => {
    const scheduleId = await createSchedule({
      name: "Cicilan 3x",
      start_date: "2026-06-15",
      next_date: "2026-06-15",
      end_date: "2026-08-01",
    });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-12-31" });

    const { data: rows } = await db
      .from("recurring_occurrences")
      .select("due_date")
      .eq("recurring_id", scheduleId)
      .order("due_date");

    expect(rows!.map((r) => r.due_date)).toEqual(["2026-06-15", "2026-07-15"]);

    const { data: schedule } = await db
      .from("recurring_transactions")
      .select("is_active")
      .eq("id", scheduleId)
      .single();
    expect(schedule!.is_active).toBe(false);
  });

  it("mempertahankan tanggal 31 lintas bulan pendek, sama dengan versi TypeScript", async () => {
    const scheduleId = await createSchedule({
      name: "Cicilan tanggal 31",
      start_date: "2026-01-31",
      next_date: "2026-01-31",
    });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-04-30" });

    const { data: rows } = await db
      .from("recurring_occurrences")
      .select("due_date")
      .eq("recurring_id", scheduleId)
      .order("due_date");

    // Persis hasil `dueDatesUntil("2026-01-31","monthly","2026-04-30")`.
    expect(rows!.map((r) => r.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("melewatkan jadwal yang tidak aktif", async () => {
    const scheduleId = await createSchedule({
      name: "Langganan dijeda",
      start_date: "2026-07-05",
      next_date: "2026-07-05",
      is_active: false,
    });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-15" });

    const { count } = await db
      .from("recurring_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("recurring_id", scheduleId);
    expect(count).toBe(0);
  });

  /**
   * Konfirmasi memakai ID tagihan sebagai `client_token`. Karena tokennya
   * deterministik, konfirmasi kedua — dari klik ganda, jaringan yang diulang,
   * atau tab lain — mengembalikan transaksi yang SAMA alih-alih memotong
   * saldo dua kali.
   */
  it("konfirmasi ganda satu tagihan hanya menghasilkan satu transaksi", async () => {
    await seedMainBalance(5_000_000);
    const scheduleId = await createSchedule({
      name: "Internet Rutin",
      amount: 400_000,
      start_date: "2026-08-01",
      next_date: "2026-08-01",
    });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-05" });

    const { data: occurrence } = await db
      .from("recurring_occurrences")
      .select("id, due_date, amount")
      .eq("recurring_id", scheduleId)
      .order("due_date")
      .limit(1)
      .single();

    const args = {
      p_family_id: familyId,
      p_merchant: "Internet Rutin",
      p_date: occurrence!.due_date,
      p_pocket_id: null,
      p_category: "tagihan",
      p_note: "Transaksi rutin",
      p_source: "manual",
      p_plan_id: null,
      p_items: [{ name: "Internet Rutin", qty: 1, price: 400_000 }],
      p_created_by: actorId,
      p_client_token: occurrence!.id,
    };

    const first = await db.rpc("fin_create_shopping", args);
    const second = await db.rpc("fin_create_shopping", args);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).toBe(first.data);
    expect(await mainBalance()).toBe(4_600_000);

    const { count } = await db
      .from("shopping_transactions")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("client_token", occurrence!.id);
    expect(count).toBe(1);
  });

  it("konfirmasi pendapatan rutin menambah saldo tepat sekali", async () => {
    await seedMainBalance(1_000_000);
    const scheduleId = await createSchedule({
      name: "Gaji Bulanan",
      kind: "income",
      category: "gaji",
      amount: 8_000_000,
      start_date: "2026-08-25",
      next_date: "2026-08-25",
    });

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-31" });

    const { data: occurrence } = await db
      .from("recurring_occurrences")
      .select("id, due_date")
      .eq("recurring_id", scheduleId)
      .single();

    const args = {
      p_family_id: familyId,
      p_source: "Gaji Bulanan",
      p_amount: 8_000_000,
      p_date: occurrence!.due_date,
      p_pocket_id: null,
      p_category: "gaji",
      p_note: "Transaksi rutin",
      p_created_by: actorId,
      p_client_token: occurrence!.id,
    };

    const first = await db.rpc("fin_create_income", args);
    const second = await db.rpc("fin_create_income", args);

    expect(second.data).toBe(first.data);
    expect(await mainBalance()).toBe(9_000_000);
  });

  it("generator satu keluarga tidak menyentuh jadwal keluarga lain", async () => {
    const other = await createFamily();
    const { data: otherSchedule } = await db
      .from("recurring_transactions")
      .insert({
        family_id: other.familyId,
        name: "Jadwal keluarga lain",
        kind: "expense",
        amount: 100_000,
        category: "tagihan",
        frequency: "monthly",
        start_date: "2026-07-01",
        next_date: "2026-07-01",
        created_by: other.actorId,
      })
      .select("id")
      .single();

    await db.rpc("fin_generate_recurring_occurrences", { p_family_id: familyId, p_horizon: "2026-08-15" });

    const { count } = await db
      .from("recurring_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("recurring_id", otherSchedule!.id);
    expect(count).toBe(0);

    const { data: untouched } = await db
      .from("recurring_transactions")
      .select("next_date")
      .eq("id", otherSchedule!.id)
      .single();
    expect(untouched!.next_date).toBe("2026-07-01");
  });
});
