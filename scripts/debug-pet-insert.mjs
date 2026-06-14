import { readFileSync } from "fs";
import { PostgrestClient } from "@supabase/postgrest-js";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const supabase = new PostgrestClient(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});

const { data: admin, error: adminErr } = await supabase
  .from("profiles")
  .select("id, family_id, role")
  .eq("role", "admin")
  .limit(1)
  .maybeSingle();

console.log("admin profile:", admin, adminErr);

if (admin) {
  const { data, error } = await supabase
    .from("pets")
    .insert({
      family_id: admin.family_id,
      name: "Debug Kucing",
      style: "kucing oranye",
      image_url: "https://example.com/test.png",
      sound_url: null,
      unlock_level: 1,
      generated_by: admin.id,
    })
    .select("id")
    .single();

  console.log("insert result:", data, error);

  if (data?.id) {
    await supabase.from("pets").delete().eq("id", data.id);
    console.log("cleaned up debug row");
  }
}
