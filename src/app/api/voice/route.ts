import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

const VOICE_IDS: Record<string, string | undefined> = {
  daffa: process.env.DAFFA_VOICE_ID,
  dio: process.env.DIO_VOICE_ID,
};

const MAX_TEXT_LENGTH = 300;

/** Proxy ElevenLabs TTS — opsional, dipakai voice.ts sebagai prioritas pertama. */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const character = typeof body?.character === "string" ? body.character : "";
  if (!text) return NextResponse.json({ error: "Invalid text" }, { status: 400 });

  const voiceId = VOICE_IDS[character];
  if (!voiceId) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, MAX_TEXT_LENGTH),
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "elevenlabs_failed" }, { status: 502 });
  }

  return new NextResponse(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
