"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";

interface SoundToggleProps {
  className?: string;
}

export function SoundToggle({ className }: SoundToggleProps) {
  const soundEnabled = useSessionStore((s) => s.soundEnabled);
  const setSoundEnabled = useSessionStore((s) => s.setSoundEnabled);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const toggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
    if (next) soundManager.play("tap");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={soundEnabled ? "Matikan suara" : "Nyalakan suara"}
      className={cn(
        "flex items-center justify-center w-12 h-12 rounded-xl border-2 border-border bg-card shadow-card transition-transform active:scale-95",
        className
      )}
    >
      {mounted && !soundEnabled ? (
        <VolumeX className="w-5 h-5 text-ink-2" />
      ) : (
        <Volume2 className="w-5 h-5 text-ink-2" />
      )}
    </button>
  );
}
