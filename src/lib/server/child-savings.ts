import "server-only";
import type { AdminClient } from "./admin-helpers";

function savingsPocketName(childName: string) {
  return `Tabungan ${childName}`;
}

/** Sinkronkan perubahan saldo celengan anak ke pocket "Tabungan {Nama}" miliknya. */
export async function syncSavingsPocket(supabase: AdminClient, familyId: string, childName: string, delta: number) {
  if (!delta) return;

  const name = savingsPocketName(childName);
  const { data: pocket } = await supabase
    .from("pockets")
    .select("id, balance")
    .eq("family_id", familyId)
    .ilike("name", name)
    .maybeSingle();

  if (pocket) {
    const newBalance = Math.max(0, Number(pocket.balance) + delta);
    await supabase.from("pockets").update({ balance: newBalance }).eq("id", pocket.id);
  } else if (delta > 0) {
    await supabase.from("pockets").insert({ family_id: familyId, name, type: "custom", balance: delta });
  }
}

/** Jika pocket bernama "Tabungan {Nama Anak}" berubah, sinkronkan ke saldo celengan anak. */
export async function syncChildSaldoFromPocket(supabase: AdminClient, familyId: string, pocketName: string, delta: number) {
  if (!delta) return;

  const match = pocketName.match(/^Tabungan (.+)$/i);
  if (!match) return;

  const { data: child } = await supabase
    .from("profiles")
    .select("id, saldo")
    .eq("family_id", familyId)
    .eq("role", "child")
    .ilike("name", match[1])
    .maybeSingle();

  if (!child) return;

  const newSaldo = Math.max(0, Number(child.saldo) + delta);
  await supabase.from("profiles").update({ saldo: newSaldo }).eq("id", child.id);
}
