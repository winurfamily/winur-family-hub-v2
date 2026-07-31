"use client";

import { Delete } from "lucide-react";
import { soundManager } from "@/lib/sound/sound-manager";

interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function PinPad({ onDigit, onBackspace, disabled }: PinPadProps) {
  const handlePress = (key: string) => {
    if (disabled) return;
    soundManager.play("tap");
    if (key === "back") {
      onBackspace();
    } else if (key !== "") {
      onDigit(key);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2.5">
      {KEYS.map((key, i) => {
        if (key === "") {
          return <div key={`blank-${i}`} />;
        }
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => handlePress(key)}
            aria-label={key === "back" ? "Hapus satu digit" : `Angka ${key}`}
            className="flex h-14 w-full items-center justify-center rounded-[16px] border-2 border-border bg-white font-heading text-2xl font-extrabold text-ink-1 shadow-[0_4px_0_var(--border-dark)] transition-all duration-100 active:translate-y-[4px] active:shadow-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {key === "back" ? <Delete className="h-6 w-6" /> : key}
          </button>
        );
      })}
    </div>
  );
}
