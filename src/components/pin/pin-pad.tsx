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
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mx-auto">
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
            className="w-full bg-white border-2 border-border rounded-[14px] py-3.5 font-heading font-extrabold text-xl text-ink-1 shadow-[0_4px_0_var(--border-dark)] transition-all duration-100 active:translate-y-[4px] active:shadow-none disabled:opacity-50 min-h-12 flex items-center justify-center"
          >
            {key === "back" ? <Delete className="w-5 h-5" /> : key}
          </button>
        );
      })}
    </div>
  );
}
