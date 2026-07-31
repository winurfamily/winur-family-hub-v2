import { config } from "dotenv";
import WebSocket from "ws";

// Test integrasi memakai kredensial yang sama dengan aplikasi.
config({ path: ".env.local" });
config({ path: ".env" });

// @supabase/supabase-js membangun klien realtime saat createClient() dipanggil
// dan menuntut WebSocket global. Node 20 belum menyediakannya secara native
// (baru ada sejak Node 22), jadi dipasang manual di sini. Tidak berpengaruh ke
// runtime aplikasi — Vercel sudah menyediakan WebSocket sendiri.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocket;
}
