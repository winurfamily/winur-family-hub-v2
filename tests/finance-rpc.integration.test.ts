import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test integrasi RPC keuangan terhadap Supabase sungguhan.
 *
 * Setiap test membuat KELUARGA SENDIRI dengan UUID acak dan menghapusnya
 * kembali setelah selesai, jadi data keluarga asli tidak pernah tersentuh.
 *
 * Dilewati otomatis (bukan gagal) bila kredensial Supabase tidak tersedia,
 * supaya `npm test` tetap bisa dijalankan di mesin tanpa akses database.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Selain kredensial, skema 0017–0019 juga harus sudah diterapkan. Kalau belum,
 * suite ini dilewati dengan pesan yang jelas alih-alih gagal dengan error SQL
 * yang membingungkan.
 */
async function schemaReady(): Promise<boolean> {
  if (!url || !key) return false;
  const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.from("families").select("id, main_balance").limit(1);
  if (error) {
    console.warn(
      "\n[dilewati] Migration 0017–0019 belum diterapkan ke Supabase.\n" +
        "           Jalankan supabase/migrations/APPLY_0017_0019.sql di SQL Editor,\n" +
        "           lalu ulangi `npm test`.\n"
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

async function mainBalance(): Promise<number> {
  const { data } = await db.from("families").select("main_balance").eq("id", familyId).single();
  return Number(data!.main_balance);
}

async function pocketBalance(id: string): Promise<number> {
  const { data } = await db.from("pockets").select("balance").eq("id", id).single();
  return Number(data!.balance);
}

async function createPocket(name: string): Promise<string> {
  const { data, error } = await db
    .from("pockets")
    .insert({ family_id: familyId, name, type: "custom" })
    .select("id")
    .single();
  if (error) throw new Error(`gagal membuat pocket: ${error.message}`);
  return data!.id as string;
}

/** Setel Saldo Utama ke nilai awal test tanpa lewat RPC. */
async function seedMainBalance(amount: number) {
  await db.from("families").update({ main_balance: amount }).eq("id", familyId);
}

d("RPC keuangan (integrasi Supabase)", () => {
  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: family, error } = await db
      .from("families")
      .insert({ name: `__test__${Date.now()}`, setup_complete: false })
      .select("id")
      .single();
    if (error) throw new Error(`gagal membuat family test: ${error.message}`);

    familyId = family!.id;
    createdFamilies.push(familyId);

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .insert({ family_id: familyId, role: "admin", name: "Tester" })
      .select("id")
      .single();
    if (profileError) throw new Error(`gagal membuat profil test: ${profileError.message}`);
    actorId = profile!.id;
  });

  afterAll(async () => {
    // Bersihkan mengikuti urutan foreign key.
    for (const id of createdFamilies) {
      const { data: trx } = await db.from("shopping_transactions").select("id").eq("family_id", id);
      const trxIds = (trx ?? []).map((t) => t.id);
      if (trxIds.length > 0) {
        await db.from("shopping_transaction_items").delete().in("transaction_id", trxIds);
      }
      await db.from("receipt_attachments").delete().eq("family_id", id);
      await db.from("shopping_transactions").delete().eq("family_id", id);

      const { data: plans } = await db.from("shopping_plans").select("id").eq("family_id", id);
      const planIds = (plans ?? []).map((p) => p.id);
      if (planIds.length > 0) await db.from("shopping_plan_items").delete().in("plan_id", planIds);
      await db.from("shopping_plans").delete().eq("family_id", id);

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
  // Skenario wajib dari brief (bagian E3)
  // -------------------------------------------------------------------------
  it("menghapus riwayat transfer TIDAK mengembalikan saldo", async () => {
    await seedMainBalance(3_000_000);
    const belanjaId = await createPocket("Pocket Belanja");

    expect(await mainBalance()).toBe(3_000_000);
    expect(await pocketBalance(belanjaId)).toBe(0);

    // Transfer Rp1.000.000 dari Saldo Utama ke Pocket Belanja.
    const { data: transferId, error: transferError } = await db.rpc("fin_create_transfer", {
      p_family_id: familyId,
      p_from_type: "main",
      p_from_pocket: null,
      p_to_type: "pocket",
      p_to_pocket: belanjaId,
      p_amount: 1_000_000,
      p_note: "Dana belanja bulanan",
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(transferError).toBeNull();

    expect(await mainBalance()).toBe(2_000_000);
    expect(await pocketBalance(belanjaId)).toBe(1_000_000);

    // Hapus riwayat transfer.
    const { error: deleteError } = await db.rpc("fin_delete_transfer", {
      p_transfer_id: transferId as string,
      p_family_id: familyId,
    });
    expect(deleteError).toBeNull();

    // INTI PERBAIKAN: saldo harus tetap sama persis seperti setelah transfer.
    expect(await mainBalance()).toBe(2_000_000);
    expect(await pocketBalance(belanjaId)).toBe(1_000_000);

    // Record tidak boleh muncul lagi di riwayat.
    const { data: remaining } = await db
      .from("pocket_transfers")
      .select("id")
      .eq("id", transferId as string);
    expect(remaining).toEqual([]);
  });

  it("membatalkan transfer memang memindahkan uang kembali (operasi terpisah)", async () => {
    await seedMainBalance(3_000_000);
    const pocketId = await createPocket("Pocket Reverse");

    const { data: transferId } = await db.rpc("fin_create_transfer", {
      p_family_id: familyId,
      p_from_type: "main",
      p_from_pocket: null,
      p_to_type: "pocket",
      p_to_pocket: pocketId,
      p_amount: 500_000,
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(await mainBalance()).toBe(2_500_000);

    const { error } = await db.rpc("fin_reverse_transfer", {
      p_transfer_id: transferId as string,
      p_family_id: familyId,
      p_created_by: actorId,
    });
    expect(error).toBeNull();

    // Uang kembali, dan riwayat aslinya TETAP ada sebagai jejak.
    expect(await mainBalance()).toBe(3_000_000);
    expect(await pocketBalance(pocketId)).toBe(0);

    const { data: rows } = await db
      .from("pocket_transfers")
      .select("id")
      .eq("id", transferId as string);
    expect(rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Saldo & atomicity
  // -------------------------------------------------------------------------
  it("menolak transfer melebihi saldo dan tidak mengubah apa pun", async () => {
    await seedMainBalance(100_000);
    const pocketId = await createPocket("Pocket Kurang");

    const { error } = await db.rpc("fin_create_transfer", {
      p_family_id: familyId,
      p_from_type: "main",
      p_from_pocket: null,
      p_to_type: "pocket",
      p_to_pocket: pocketId,
      p_amount: 500_000,
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/tidak cukup/i);

    // Kegagalan harus utuh: saldo maupun riwayat tidak berubah sedikit pun.
    expect(await mainBalance()).toBe(100_000);
    expect(await pocketBalance(pocketId)).toBe(0);
  });

  it("token idempotency mencegah transfer ganda saat tombol ditekan dua kali", async () => {
    await seedMainBalance(1_000_000);
    const pocketId = await createPocket("Pocket Idempoten");
    const token = crypto.randomUUID();

    const args = {
      p_family_id: familyId,
      p_from_type: "main",
      p_from_pocket: null,
      p_to_type: "pocket",
      p_to_pocket: pocketId,
      p_amount: 250_000,
      p_note: null,
      p_created_by: actorId,
      p_client_token: token,
    };

    const first = await db.rpc("fin_create_transfer", args);
    const second = await db.rpc("fin_create_transfer", args);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    // Permintaan kedua mengembalikan record yang sama, bukan membuat yang baru.
    expect(second.data).toBe(first.data);
    expect(await mainBalance()).toBe(750_000);
    expect(await pocketBalance(pocketId)).toBe(250_000);
  });

  // -------------------------------------------------------------------------
  // Pendapatan
  // -------------------------------------------------------------------------
  it("menambah, mengubah, memindahkan tujuan, lalu menghapus pendapatan menjaga saldo tetap konsisten", async () => {
    await seedMainBalance(0);
    const tabunganId = await createPocket("Tabungan Uji");

    // Tambah: Saldo Utama bertambah.
    const { data: incomeId, error: createError } = await db.rpc("fin_create_income", {
      p_family_id: familyId,
      p_source: "Gaji",
      p_amount: 5_000_000,
      p_date: "2025-07-01",
      p_pocket_id: null,
      p_category: "gaji",
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(createError).toBeNull();
    expect(await mainBalance()).toBe(5_000_000);

    // Ubah nominal: saldo disesuaikan berdasarkan selisih, bukan ditambah ulang.
    await db.rpc("fin_update_income", {
      p_income_id: incomeId as string,
      p_family_id: familyId,
      p_source: "Gaji",
      p_amount: 6_000_000,
      p_date: "2025-07-01",
      p_pocket_id: null,
      p_category: "gaji",
      p_note: null,
      p_updated_by: actorId,
    });
    expect(await mainBalance()).toBe(6_000_000);

    // Pindahkan tujuan ke pocket: akun lama dikurangi penuh, akun baru ditambah penuh.
    await db.rpc("fin_update_income", {
      p_income_id: incomeId as string,
      p_family_id: familyId,
      p_source: "Gaji",
      p_amount: 6_000_000,
      p_date: "2025-07-01",
      p_pocket_id: tabunganId,
      p_category: "gaji",
      p_note: null,
      p_updated_by: actorId,
    });
    expect(await mainBalance()).toBe(0);
    expect(await pocketBalance(tabunganId)).toBe(6_000_000);

    // Hapus: saldo akun tujuan dikurangi.
    await db.rpc("fin_delete_income", { p_income_id: incomeId as string, p_family_id: familyId });
    expect(await pocketBalance(tabunganId)).toBe(0);

    const { data: rows } = await db.from("income").select("id").eq("id", incomeId as string);
    expect(rows).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Belanja
  // -------------------------------------------------------------------------
  it("menyimpan belanja multi-item beserta rinciannya dan memotong saldo satu kali", async () => {
    await seedMainBalance(1_000_000);

    const { data: trxId, error } = await db.rpc("fin_create_shopping", {
      p_family_id: familyId,
      p_merchant: "Toko Uji",
      p_date: "2025-07-10",
      p_pocket_id: null,
      p_category: "makanan",
      p_note: "belanja mingguan",
      p_source: "manual",
      p_plan_id: null,
      p_items: [
        { name: "Beras", qty: 2, price: 70_000 },
        { name: "Minyak", qty: 3, price: 20_000 },
      ],
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).toBeNull();
    // 2×70.000 + 3×20.000 = 200.000
    expect(await mainBalance()).toBe(800_000);

    const { data: items } = await db
      .from("shopping_transaction_items")
      .select("name, qty, price, subtotal")
      .eq("transaction_id", trxId as string)
      .order("position");

    expect(items).toHaveLength(2);
    expect(Number(items![0].subtotal)).toBe(140_000);
    expect(Number(items![1].subtotal)).toBe(60_000);

    // Menghapus belanja MENGEMBALIKAN dana (berbeda dari hapus riwayat transfer).
    await db.rpc("fin_delete_shopping", { p_transaction_id: trxId as string, p_family_id: familyId });
    expect(await mainBalance()).toBe(1_000_000);
  });

  it("menolak belanja melebihi saldo pocket tanpa menyisakan data separuh jadi", async () => {
    await seedMainBalance(0);
    const pocketId = await createPocket("Pocket Tipis");

    const { error } = await db.rpc("fin_create_shopping", {
      p_family_id: familyId,
      p_merchant: "Toko Mahal",
      p_date: "2025-07-11",
      p_pocket_id: pocketId,
      p_category: "lainnya",
      p_note: null,
      p_source: "manual",
      p_plan_id: null,
      p_items: [{ name: "Barang", qty: 1, price: 999_000 }],
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).not.toBeNull();
    expect(await pocketBalance(pocketId)).toBe(0);

    // Header maupun itemnya tidak boleh tertinggal.
    const { data: trx } = await db
      .from("shopping_transactions")
      .select("id")
      .eq("family_id", familyId)
      .eq("merchant", "Toko Mahal");
    expect(trx).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Isolasi antar keluarga
  // -------------------------------------------------------------------------
  it("menolak operasi lintas keluarga", async () => {
    const { data: other } = await db
      .from("families")
      .insert({ name: `__test_other__${Date.now()}`, setup_complete: false })
      .select("id")
      .single();
    createdFamilies.push(other!.id);

    await seedMainBalance(1_000_000);
    const pocketId = await createPocket("Pocket Milik Kita");

    // Keluarga lain mencoba memakai pocket milik keluarga ini.
    const { error } = await db.rpc("fin_create_transfer", {
      p_family_id: other!.id,
      p_from_type: "main",
      p_from_pocket: null,
      p_to_type: "pocket",
      p_to_pocket: pocketId,
      p_amount: 10_000,
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).not.toBeNull();
    expect(await pocketBalance(pocketId)).toBe(0);
  });
});
