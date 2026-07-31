import type { ProfileRole } from "@/lib/supabase/types";

/**
 * Verifikasi token sesi memakai Web Crypto, agar bisa dijalankan di Edge
 * runtime (middleware). `src/lib/session.ts` memakai modul `crypto` Node dan
 * hanya tersedia di Server Component / Server Action.
 *
 * Skema tanda tangan harus identik dengan session.ts: HMAC-SHA256 atas
 * payload base64url, hasilnya hex.
 */
export interface EdgeSessionPayload {
  profileId: string;
  familyId: string;
  role: ProfileRole;
}

let cachedKey: CryptoKey | null = null;

async function getKey(secret: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return cachedKey;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Perbandingan waktu-tetap agar tanda tangan tidak bisa ditebak per karakter. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export async function verifySessionTokenEdge(
  token: string | undefined
): Promise<EdgeSessionPayload | null> {
  if (!token) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  try {
    const expected = toHex(await crypto.subtle.sign("HMAC", await getKey(secret), new TextEncoder().encode(data)));
    if (!timingSafeEqual(signature, expected)) return null;

    const payload = JSON.parse(base64UrlDecode(data)) as EdgeSessionPayload;
    if (!payload?.profileId || !payload?.familyId) return null;
    if (payload.role !== "admin" && payload.role !== "child") return null;

    return payload;
  } catch {
    return null;
  }
}
