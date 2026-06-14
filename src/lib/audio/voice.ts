"use client";

/**
 * Voice chain: rekaman Howler (sapaan tetap) → ElevenLabs API → SpeechSynthesis
 * id-ID → SpeechSynthesis default.
 * Saat karakter bicara: pause BGM, lalu resume setelah selesai.
 */

import { audioManager } from "./audio-manager";
import type { VoiceCharacter, VoiceLine } from "./types";

export type { VoiceCharacter, VoiceLine };

const VOICE_CONFIG: Record<VoiceCharacter, { pitch: number; rate: number; lang: string }> = {
  daffa: { pitch: 1.8, rate: 0.95, lang: "id-ID" },
  dio: { pitch: 2.2, rate: 0.9, lang: "id-ID" },
};

let idVoice: SpeechSynthesisVoice | null = null;

function loadVoice() {
  if (typeof speechSynthesis === "undefined") return;
  const vs = speechSynthesis.getVoices();
  idVoice = vs.find((v) => /id-ID|Indonesia/i.test(v.lang + v.name)) ?? vs.find((v) => /^id/i.test(v.lang)) ?? null;
}

if (typeof window !== "undefined" && typeof speechSynthesis !== "undefined") {
  loadVoice();
  speechSynthesis.onvoiceschanged = loadVoice;
}

function speakSynthesis(text: string, character: VoiceCharacter, onEnd: () => void) {
  try {
    if (typeof speechSynthesis === "undefined") {
      onEnd();
      return;
    }
    const cfg = VOICE_CONFIG[character];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cfg.lang;
    if (idVoice) u.voice = idVoice;
    u.pitch = cfg.pitch;
    u.rate = cfg.rate;
    u.onend = onEnd;
    u.onerror = onEnd;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    onEnd();
  }
}

/** Coba ElevenLabs. Resolve true jika berhasil dimainkan sampai selesai. */
function speakElevenLabs(text: string, character: VoiceCharacter): Promise<boolean> {
  return fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, character }),
  })
    .then((res) => {
      if (!res.ok) return false;
      return res.blob().then((blob) => {
        const url = URL.createObjectURL(blob);
        return new Promise<boolean>((resolve) => {
          const audio = new Audio(url);
          const cleanup = (ok: boolean) => {
            URL.revokeObjectURL(url);
            resolve(ok);
          };
          audio.onended = () => cleanup(true);
          audio.onerror = () => cleanup(false);
          void audio.play().catch(() => cleanup(false));
        });
      });
    })
    .catch(() => false);
}

/** ElevenLabs (jika dikonfigurasi) → SpeechSynthesis id-ID → SpeechSynthesis default. */
async function speakFallback(text: string, character: VoiceCharacter, finish: () => void) {
  const elevenOk = await speakElevenLabs(text, character);
  if (elevenOk) {
    finish();
    return;
  }
  speakSynthesis(text, character, finish);
}

/**
 * Karakter bicara: pause BGM → ElevenLabs (jika dikonfigurasi) → SpeechSynthesis
 * id-ID → SpeechSynthesis default → resume BGM. `onEnd` dipanggil setelah selesai
 * (untuk stop animasi mulut).
 */
export async function speak(text: string, character: VoiceCharacter, onEnd?: () => void) {
  audioManager.pauseBGM();
  const finish = () => {
    audioManager.resumeBGM();
    onEnd?.();
  };
  await speakFallback(text, character, finish);
}

/**
 * Karakter bicara baris sapaan tetap: pause BGM → rekaman Howler
 * (public/sounds/voice/<karakter>/<line>.mp3) → fallback sama seperti `speak`
 * (ElevenLabs → SpeechSynthesis) memakai `fallbackText` → resume BGM.
 */
export async function speakLine(line: VoiceLine, fallbackText: string, character: VoiceCharacter, onEnd?: () => void) {
  audioManager.pauseBGM();
  const finish = () => {
    audioManager.resumeBGM();
    onEnd?.();
  };

  const playedFile = await audioManager.playVoiceLine(character, line);
  if (playedFile) {
    finish();
    return;
  }
  await speakFallback(fallbackText, character, finish);
}
