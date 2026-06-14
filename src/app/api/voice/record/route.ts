import { NextResponse, type NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getCurrentSession } from "@/app/actions/auth";
import type { VoiceCharacter, VoiceLine } from "@/lib/audio/types";

export const dynamic = "force-dynamic";

const CHARACTERS: VoiceCharacter[] = ["daffa", "dio"];
const LINES: VoiceLine[] = ["halo", "aku", "belajar", "bermain", "istirahat", "keren"];

/**
 * Dev-only: timpa public/sounds/voice/<karakter>/<line>.mp3 dengan rekaman
 * baru (MP3, sudah di-encode di browser). Selalu menulis ke path tetap yang
 * sama — tidak pernah membuat file baru, jadi hanya 1 file aktif per baris.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available_in_production" }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const character = form?.get("character");
  const line = form?.get("line");
  const file = form?.get("file");

  if (
    typeof character !== "string" ||
    typeof line !== "string" ||
    !(file instanceof Blob) ||
    !CHARACTERS.includes(character as VoiceCharacter) ||
    !LINES.includes(line as VoiceLine)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const dest = path.join(process.cwd(), "public", "sounds", "voice", character, `${line}.mp3`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  return NextResponse.json({ success: true });
}
