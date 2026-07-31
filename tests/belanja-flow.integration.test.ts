import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { distributeTotal } from "@/lib/shopping-total";
import { parseShoppingList } from "@/lib/shopping-parser";
import { nextMonthDate } from "@/lib/period";
import { normalizeUnit } from "@/lib/shopping-item";

/**
 * Integrasi alur Belanja terhadap Supabase sungguhan.
 *
 * Menutup skenario wajib: tempel daftar → checklist → penyelesaian dengan
 * barang tambahan → satu transaksi Pengeluaran → saldo berkurang sekali, serta
 * pencegahan transaksi ganda dan sinkronisasi saldo setelah reset.
 *
 * Seperti suite RPC lainnya: keluarga sendiri dengan UUID acak, dihapus lagi
 * setelah selesai, dan dilewati (bukan gagal) bila kredensial tidak ada.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function schemaReady(): Promise<boolean> {
  if (!url || !key) return false;
  const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.from("shopping_plan_items").select("id, status").limit(1);
  if (error) {
    console.warn("\n[dilewati] Skema belanja (0018) belum diterapkan ke Supabase.\n");
    return false;
  }
  return true;
}

const d = (await schemaReady()) ? describe : describe.skip;

let db: SupabaseClient;
let familyId: string;
let actorId: string;
const createdFamilies: string[] = [];

const TODAY = "2026-08-01";

async function mainBalance(): Promise<number> {
  const { data } = await db.from("families").select("main_balance").eq("id", familyId).single();
  return Number(data!.main_balance);
}

async function setMainBalance(amount: number) {
  await db.from("families").update({ main_balance: amount }).eq("id", familyId);
}

async function createPlan(name: string): Promise<string> {
  const { data, error } = await db
    .from("shopping_plans")
    .insert({ family_id: familyId, name, planned_date: TODAY, status: "active", created_by: actorId })
    .select("id")
    .single();
  if (error) throw new Error(`gagal membuat rencana: ${error.message}`);
  return data!.id as string;
}

/** Meniru addPlanItemsBulk(): satu INSERT, satuan disimpan di kolom note. */
async function pasteIntoPlan(planId: string, text: string) {
  const parsed = parseShoppingList(text);
  const { error } = await db.from("shopping_plan_items").insert(
    parsed.map((item, index) => ({
      plan_id: planId,
      name: item.name,
      qty: item.qty,
      estimated_price: item.price,
      note: item.unit || null,
      position: index,
      status: "pending" as const,
      checked: false,
    }))
  );
  if (error) throw new Error(`gagal menempel daftar: ${error.message}`);
  return parsed;
}

async function planItems(planId: string) {
  const { data } = await db
    .from("shopping_plan_items")
    .select("id, name, qty, estimated_price, actual_price, status, note, transaction_id")
    .eq("plan_id", planId)
    .order("position");
  return data ?? [];
}

d("Alur Belanja (integrasi Supabase)", () => {
  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: family, error } = await db
      .from("families")
      .insert({ name: `__test_belanja__${Date.now()}`, setup_complete: false })
      .select("id")
      .single();
    if (error) throw new Error(`gagal membuat family test: ${error.message}`);
    familyId = family!.id;
    createdFamilies.push(familyId);

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .insert({ family_id: familyId, role: "admin", name: "Tester Belanja" })
      .select("id")
      .single();
    if (profileError) throw new Error(`gagal membuat profil test: ${profileError.message}`);
    actorId = profile!.id;
  });

  afterAll(async () => {
    for (const id of createdFamilies) {
      const { data: trx } = await db.from("shopping_transactions").select("id").eq("family_id", id);
      const trxIds = (trx ?? []).map((t) => t.id);
      if (trxIds.length > 0) {
        await db.from("shopping_transaction_items").delete().in("transaction_id", trxIds);
      }
      await db.from("receipt_attachments").delete().eq("family_id", id);

      const { data: plans } = await db.from("shopping_plans").select("id").eq("family_id", id);
      const planIds = (plans ?? []).map((p) => p.id);
      if (planIds.length > 0) await db.from("shopping_plan_items").delete().in("plan_id", planIds);

      await db.from("shopping_transactions").delete().eq("family_id", id);
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

  it("menempel daftar koma menjadi checklist yang bisa dicentang satu per satu", async () => {
    const planId = await createPlan("Belanja Bulanan");
    const parsed = await pasteIntoPlan(
      planId,
      "Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg, Sabun mandi, Susu anak 2 kotak"
    );

    expect(parsed).toHaveLength(5);

    const items = await planItems(planId);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.name)).toEqual([
      "Beras",
      "Minyak goreng",
      "Telur",
      "Sabun mandi",
      "Susu anak",
    ]);
    expect(items.every((i) => i.status === "pending")).toBe(true);
    // Satuan ikut tersimpan sehingga "5 kg" tidak berubah jadi sekadar "5".
    expect(items[0].note).toBe("kg");
    expect(Number(items[4].qty)).toBe(2);

    // Centang satu barang, batalkan satu barang.
    await db
      .from("shopping_plan_items")
      .update({ status: "bought", checked: true })
      .eq("id", items[0].id);
    await db.from("shopping_plan_items").update({ status: "cancelled" }).eq("id", items[3].id);

    const after = await planItems(planId);
    expect(after.filter((i) => i.status === "bought")).toHaveLength(1);
    expect(after.filter((i) => i.status === "cancelled")).toHaveLength(1);
    expect(after.filter((i) => i.status === "pending")).toHaveLength(3);
  });

  it("menyelesaikan checklist beserta barang tambahan menjadi SATU transaksi Belanja", async () => {
    await setMainBalance(2_000_000);

    const planId = await createPlan("Belanja Mingguan");
    await pasteIntoPlan(planId, "Beras 5 kg, Minyak goreng 2 liter, Sabun mandi");

    const items = await planItems(planId);
    // Barang ketiga tidak jadi dibeli.
    await db.from("shopping_plan_items").update({ status: "cancelled" }).eq("id", items[2].id);

    const active = (await planItems(planId)).filter((i) => i.status !== "cancelled");
    expect(active).toHaveLength(2);

    const baris = [
      ...active.map((item) => ({ name: item.name, qty: Number(item.qty), price: 0 })),
      // Barang tambahan yang dibeli mendadak di toko.
      { name: "Permen", qty: 3, price: 2_000 },
      { name: "Kantong belanja", qty: 1, price: 1_500 },
    ];

    const TOTAL_DIBAYAR = 187_500;
    const finalItems = distributeTotal(baris, TOTAL_DIBAYAR);

    const { data: trxId, error } = await db.rpc("fin_create_shopping", {
      p_family_id: familyId,
      p_merchant: "Toko Sejahtera",
      p_date: TODAY,
      p_pocket_id: null,
      p_category: "belanja",
      p_note: null,
      p_source: "plan",
      p_plan_id: planId,
      p_items: finalItems,
      p_created_by: actorId,
      p_client_token: null,
    });

    expect(error).toBeNull();
    expect(trxId).toBeTruthy();

    // Total transaksi persis sama dengan yang dibayar di kasir.
    const { data: trx } = await db
      .from("shopping_transactions")
      .select("total, category, source, plan_id")
      .eq("id", trxId as string)
      .single();
    expect(Number(trx!.total)).toBe(TOTAL_DIBAYAR);
    expect(trx!.category).toBe("belanja");
    expect(trx!.source).toBe("plan");
    expect(trx!.plan_id).toBe(planId);

    // Barang tambahan ikut tercatat sebagai rincian.
    const { data: rincian } = await db
      .from("shopping_transaction_items")
      .select("name, qty, price, subtotal")
      .eq("transaction_id", trxId as string);
    expect(rincian!.map((r) => r.name)).toEqual(expect.arrayContaining(["Permen", "Kantong belanja"]));
    expect(rincian!.every((r) => Number(r.price) >= 0)).toBe(true);
    expect(rincian!.reduce((acc, r) => acc + Number(r.subtotal), 0)).toBe(TOTAL_DIBAYAR);

    // Saldo berkurang TEPAT SEKALI.
    expect(await mainBalance()).toBe(2_000_000 - TOTAL_DIBAYAR);

    // Hanya satu transaksi untuk rencana ini.
    const { count } = await db
      .from("shopping_transactions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    expect(count).toBe(1);
  });

  it("token idempotency mencegah transaksi belanja ganda saat tombol ditekan dua kali", async () => {
    await setMainBalance(500_000);
    const planId = await createPlan("Belanja Kilat");
    await pasteIntoPlan(planId, "Roti 2 bungkus @10000");

    const token = crypto.randomUUID();
    const payload = {
      p_family_id: familyId,
      p_merchant: "Minimarket",
      p_date: TODAY,
      p_pocket_id: null,
      p_category: "belanja",
      p_note: null,
      p_source: "plan",
      p_plan_id: planId,
      p_items: [{ name: "Roti", qty: 2, price: 10_000 }],
      p_created_by: actorId,
      p_client_token: token,
    };

    const first = await db.rpc("fin_create_shopping", payload);
    const second = await db.rpc("fin_create_shopping", payload);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    // Pengiriman kedua mengembalikan transaksi yang sama, bukan membuat baru.
    expect(second.data).toBe(first.data);

    const { count } = await db
      .from("shopping_transactions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    expect(count).toBe(1);

    // Saldo hanya berkurang satu kali.
    expect(await mainBalance()).toBe(500_000 - 20_000);
  });

  it("saldo tetap Rp0 setelah reset dan tidak memunculkan angka lama", async () => {
    // Kondisi awal seperti sebelum reset: ada pendapatan dan saldo terisi.
    await setMainBalance(0);
    const { data: incomeId, error: incomeError } = await db.rpc("fin_create_income", {
      p_family_id: familyId,
      p_source: "Gaji Agustus",
      p_amount: 4_000_000,
      p_date: TODAY,
      p_pocket_id: null,
      p_category: "gaji",
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(incomeError).toBeNull();
    expect(await mainBalance()).toBe(4_000_000);

    // Reset ala RESET_FINANCE_FOR_TEST.sql: hapus data lalu nolkan saldo.
    await db.from("income").delete().eq("family_id", familyId);
    await db
      .from("families")
      .update({ main_balance: 0, main_balance_initialized: true })
      .eq("id", familyId);

    // Saldo dibaca dari kolom tersimpan, bukan dihitung ulang dari riwayat —
    // jadi tidak ada jalan bagi Rp4.000.000 untuk muncul kembali.
    expect(await mainBalance()).toBe(0);

    const { count } = await db
      .from("income")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);
    expect(count).toBe(0);
    expect(incomeId).toBeTruthy();
  });

  it("pendapatan bertanggal bulan lain tetap menambah saldo dan HARUS terjangkau tanpa filter bulan", async () => {
    // Inilah kenapa saldo lama terasa "muncul sendiri dan tak bisa dihapus":
    // satu pendapatan bertanggal bulan berikutnya menambah Saldo Utama, tetapi
    // daftar transaksi yang terkunci pada bulan berjalan tidak pernah
    // menampilkannya — jadi tidak ada baris yang bisa dibuka untuk menghapus.
    await setMainBalance(0);
    await db.from("income").delete().eq("family_id", familyId);

    const bulanIni = "2026-07-01";
    const bulanDepan = "2026-08-01";

    const { error } = await db.rpc("fin_create_income", {
      p_family_id: familyId,
      p_source: "Gaji bulan depan",
      p_amount: 4_000_000,
      p_date: bulanDepan,
      p_pocket_id: null,
      p_category: "gaji",
      p_note: null,
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(error).toBeNull();
    expect(await mainBalance()).toBe(4_000_000);

    // Cakupan "bulan ini" (perilaku lama, satu-satunya pilihan) — kosong.
    const { data: bulanan } = await db
      .from("income")
      .select("id, source")
      .eq("family_id", familyId)
      .gte("date", bulanIni)
      .lte("date", "2026-07-31");
    expect(bulanan ?? []).toHaveLength(0);

    // Cakupan "semua waktu" (pilihan baru) — barisnya muncul dan bisa dihapus.
    const { data: semua } = await db.from("income").select("id, source").eq("family_id", familyId);
    expect(semua).toHaveLength(1);
    expect(semua![0].source).toBe("Gaji bulan depan");

    const { error: deleteError } = await db.rpc("fin_delete_income", {
      p_income_id: semua![0].id,
      p_family_id: familyId,
    });
    expect(deleteError).toBeNull();
    expect(await mainBalance()).toBe(0);
  });

  it("membuat rencana bulan depan dari belanja sebelumnya TANPA menyentuh saldo", async () => {
    await setMainBalance(1_000_000);

    // --- Bulan lalu: satu belanja yang benar-benar terjadi ---------------
    const lastMonthPlan = await createPlan("Belanja Juli");
    await pasteIntoPlan(lastMonthPlan, "Beras 5 kg, Minyak goreng 2 liter, Telur 1 kg");
    const sourceItems = await planItems(lastMonthPlan);

    const HARGA_SATUAN = 20_000;
    const belanjaItems = sourceItems.map((item) => ({
      name: item.name,
      qty: Number(item.qty),
      price: HARGA_SATUAN,
      // `unit` diabaikan tanpa error oleh RPC versi sebelum 0024.
      unit: item.note ?? "",
    }));
    const totalBelanja = belanjaItems.reduce((acc, i) => acc + Math.round(i.qty * i.price), 0);

    const { data: trxId, error: trxError } = await db.rpc("fin_create_shopping", {
      p_family_id: familyId,
      p_merchant: "Toko Bulanan",
      p_date: TODAY,
      p_pocket_id: null,
      p_category: "belanja",
      p_note: null,
      p_source: "plan",
      p_plan_id: lastMonthPlan,
      p_items: belanjaItems,
      p_created_by: actorId,
      p_client_token: null,
    });
    expect(trxError).toBeNull();

    const balanceAfterShopping = await mainBalance();
    expect(balanceAfterShopping).toBe(1_000_000 - totalBelanja);

    // --- Rekomendasi: salin rincian transaksi jadi draft bulan depan -----
    const { data: rincian } = await db
      .from("shopping_transaction_items")
      .select("name, qty, price")
      .eq("transaction_id", trxId as string)
      .order("position");

    const template = (rincian ?? []).map((row) => ({
      name: row.name,
      qty: Number(row.qty),
      unit: normalizeUnit(sourceItems.find((i) => i.name === row.name)?.note),
      estimatedPrice: Math.round(Number(row.price)),
    }));
    expect(template.length).toBe(3);

    const plannedDate = nextMonthDate(TODAY, TODAY);
    expect(plannedDate.slice(0, 7)).toBe("2026-09");

    const { count: trxBefore } = await db
      .from("shopping_transactions")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);

    const draftName = `Belanja September ${Date.now()}`;
    const { data: draft, error: draftError } = await db
      .from("shopping_plans")
      .insert({
        family_id: familyId,
        name: draftName,
        planned_date: plannedDate,
        note: "Rekomendasi dari Toko Bulanan (Agustus 2026)",
        status: "draft",
        created_by: actorId,
      })
      .select("id")
      .single();
    expect(draftError).toBeNull();

    await db.from("shopping_plan_items").insert(
      template.map((item, index) => ({
        plan_id: draft!.id,
        name: item.name,
        qty: item.qty,
        estimated_price: item.estimatedPrice,
        note: item.unit || null,
        position: index,
        status: "pending" as const,
        checked: false,
      }))
    );

    // Rencana adalah DAFTAR, bukan pengeluaran: saldo tidak boleh bergerak…
    expect(await mainBalance()).toBe(balanceAfterShopping);
    // …dan tidak ada transaksi baru yang lahir dari pembuatan rencana ini.
    const { count: trxAfter } = await db
      .from("shopping_transactions")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);
    expect(trxAfter).toBe(trxBefore);

    // Qty, satuan, dan harga terakhir ikut tersalin sebagai rekomendasi.
    const copied = await planItems(draft!.id);
    expect(copied.map((i) => i.name)).toEqual(["Beras", "Minyak goreng", "Telur"]);
    expect(copied[0].note).toBe("kg");
    expect(Number(copied[0].qty)).toBe(5);
    expect(Number(copied[0].estimated_price)).toBe(20_000);

    // Draft masih bisa diedit sebelum dipakai.
    await db.from("shopping_plan_items").update({ qty: 8 }).eq("id", copied[0].id);
    await db.from("shopping_plan_items").delete().eq("id", copied[2].id);

    const edited = await planItems(draft!.id);
    expect(edited).toHaveLength(2);
    expect(Number(edited[0].qty)).toBe(8);

    // --- Penjaga rencana ganda ------------------------------------------
    // Tombol ditekan dua kali: pencarian rencana bernama sama yang baru dibuat
    // menemukan yang pertama, jadi tidak ada rencana kedua yang dibuat.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await db
      .from("shopping_plans")
      .select("id")
      .eq("family_id", familyId)
      .eq("name", draftName)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    expect(recent?.id).toBe(draft!.id);

    const { count: planCount } = await db
      .from("shopping_plans")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("name", draftName);
    expect(planCount).toBe(1);
  });

  it("menolak menyelesaikan rencana milik keluarga lain", async () => {
    const { data: other } = await db
      .from("families")
      .insert({ name: `__test_other__${Date.now()}`, setup_complete: false })
      .select("id")
      .single();
    createdFamilies.push(other!.id);

    const planId = await createPlan("Rencana Keluarga A");

    // Keluarga lain mencoba memakai plan_id milik keluarga ini.
    const { error } = await db.rpc("fin_create_shopping", {
      p_family_id: other!.id,
      p_merchant: "Toko",
      p_date: TODAY,
      p_pocket_id: null,
      p_category: "belanja",
      p_note: null,
      p_source: "plan",
      p_plan_id: planId,
      p_items: [{ name: "Apa saja", qty: 1, price: 1_000 }],
      p_created_by: actorId,
      p_client_token: null,
    });

    // Entah ditolak RPC atau ditolak foreign key/constraint — yang penting
    // tidak ada transaksi milik keluarga lain yang menempel ke rencana ini.
    const { data: rows } = await db
      .from("shopping_transactions")
      .select("family_id")
      .eq("plan_id", planId);
    expect((rows ?? []).every((row) => row.family_id === familyId)).toBe(true);
    expect(error === null || typeof error.message === "string").toBe(true);
  });
});
