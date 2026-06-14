"use client";

import { useEffect } from "react";
import { GameButton } from "@/components/ui/game-button";

export default function ChildError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-3">
      <div className="glass-strong flex max-w-xs flex-col items-center gap-3 rounded-3xl p-6 text-center shadow-card-deep sm:p-8">
        <span className="text-5xl">😵</span>
        <h2 className="font-heading text-lg font-extrabold text-ink-1">Ups, ada yang salah!</h2>
        <p className="text-sm font-bold text-ink-2">Halaman ini gagal dimuat. Yuk coba lagi.</p>
        <GameButton variant="primary" onClick={reset} playSound={false}>
          🔄 Coba Lagi
        </GameButton>
      </div>
    </div>
  );
}
