"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { GameButton } from "@/components/ui/game-button";
import { cn } from "@/lib/utils";
import { audioManager } from "@/lib/audio/audio-manager";
import { startVoiceRecording, type ActiveRecording } from "@/lib/audio/voice-recorder";
import type { VoiceCharacter, VoiceLine } from "@/lib/audio/types";

const CHARACTERS: { key: VoiceCharacter; name: string }[] = [
  { key: "daffa", name: "Daffa" },
  { key: "dio", name: "Dio" },
];

const LINES: { key: VoiceLine; text: string }[] = [
  { key: "halo", text: "Halo!" },
  { key: "aku", text: "Aku Daffa! / Aku Dio!" },
  { key: "belajar", text: "Ayo belajar!" },
  { key: "bermain", text: "Ayo bermain!" },
  { key: "istirahat", text: "Ayo istirahat!" },
  { key: "keren", text: "Keren!" },
];

const isDev = process.env.NODE_ENV !== "production";

export function VoiceRecorderManager() {
  const [character, setCharacter] = useState<VoiceCharacter>("daffa");

  return (
    <div className="space-y-3">
      {!isDev && (
        <div className="rounded-xl border-2 border-border bg-surface-2 p-3 text-xs font-bold text-ink-2">
          Rekam ulang hanya tersedia saat development (npm run dev). Tombol putar tetap berfungsi untuk cek rekaman yang aktif.
        </div>
      )}

      <div className="flex gap-2">
        {CHARACTERS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCharacter(c.key)}
            className={cn(
              "flex-1 rounded-xl border-2 px-3 py-2 text-sm font-heading font-extrabold transition-colors",
              character === c.key ? "border-secondary bg-secondary/10 text-secondary" : "border-border bg-card text-ink-2"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {LINES.map((line) => (
          <VoiceLineRow key={line.key} character={character} line={line.key} text={line.text} />
        ))}
      </div>
    </div>
  );
}

type RowStatus = "idle" | "recording" | "uploading" | "playing";

function VoiceLineRow({ character, line, text }: { character: VoiceCharacter; line: VoiceLine; text: string }) {
  const [status, setStatus] = useState<RowStatus>("idle");
  const activeRef = useRef<ActiveRecording | null>(null);

  const play = async () => {
    if (status !== "idle") return;
    setStatus("playing");
    audioManager.unlockAudio();
    const ok = await audioManager.playVoiceLine(character, line);
    setStatus("idle");
    if (!ok) toast.error("Belum ada rekaman untuk baris ini.");
  };

  const startRecord = async () => {
    if (status !== "idle") return;
    audioManager.unlockAudio();
    try {
      activeRef.current = await startVoiceRecording();
      setStatus("recording");
    } catch {
      toast.error("Tidak bisa mengakses mikrofon.");
    }
  };

  const stopRecord = async () => {
    const active = activeRef.current;
    activeRef.current = null;
    if (!active) return;
    setStatus("uploading");
    try {
      const { blob } = await active.stop();
      const fd = new FormData();
      fd.set("character", character);
      fd.set("line", line);
      fd.set("file", blob, `${line}.mp3`);
      const res = await fetch("/api/voice/record", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      audioManager.invalidateVoiceLine(character, line);
      toast.success(`Rekaman "${line}" disimpan.`);
    } catch {
      toast.error("Gagal menyimpan rekaman.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-border bg-card p-3">
      <div className="min-w-0">
        <p className="font-heading font-extrabold text-ink-1">{line}</p>
        <p className="truncate text-xs text-ink-3">&ldquo;{text}&rdquo;</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <GameButton type="button" variant="outline" size="icon" onClick={play} disabled={status !== "idle"} playSound={false}>
          {status === "playing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        </GameButton>

        {status === "recording" ? (
          <GameButton type="button" variant="primary" size="icon" onClick={stopRecord} playSound={false}>
            <Square className="h-4 w-4" />
          </GameButton>
        ) : (
          <GameButton
            type="button"
            variant="accent"
            size="icon"
            onClick={startRecord}
            disabled={!isDev || status !== "idle"}
            playSound={false}
          >
            {status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </GameButton>
        )}
      </div>
    </div>
  );
}
