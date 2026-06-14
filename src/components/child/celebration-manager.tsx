"use client";

import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GameButton } from "@/components/ui/game-button";
import { soundManager } from "@/lib/sound/sound-manager";
import { markNotificationsRead } from "@/app/actions/notifications";
import type { NotificationItem } from "@/app/actions/notifications";
import type { SoundKey } from "@/lib/sound/sounds";
import { cn } from "@/lib/utils";

interface CelebrationMeta {
  emoji: string;
  sound: SoundKey;
  confettiBig: boolean;
  particles?: "coins" | "sparkles";
  rainbow?: boolean;
  buttonLabel: string;
}

const CELEBRATION_META: Record<string, CelebrationMeta> = {
  task_approved: { emoji: "✅", sound: "approved", confettiBig: false, particles: "coins", buttonLabel: "Asyik!" },
  tugas_approved: { emoji: "📘", sound: "approved", confettiBig: false, particles: "coins", buttonLabel: "Asyik!" },
  level_up: { emoji: "⭐", sound: "level_up", confettiBig: true, buttonLabel: "Keren!" },
  unlock_avatar: { emoji: "🎭", sound: "unlock", confettiBig: true, particles: "sparkles", buttonLabel: "Lihat Koleksi" },
  unlock_pet: { emoji: "🐾", sound: "unlock", confettiBig: true, particles: "sparkles", buttonLabel: "Lihat Koleksi" },
  investment_done: { emoji: "🎁", sound: "invest_done", confettiBig: true, buttonLabel: "Mantap!" },
  withdrawal_approved: { emoji: "💰", sound: "claim", confettiBig: false, particles: "coins", buttonLabel: "Terima Kasih!" },
  point_request_approved: { emoji: "🎁", sound: "claim", confettiBig: true, buttonLabel: "Horeee!" },
  streak_complete: { emoji: "🔥", sound: "streak", confettiBig: true, rainbow: true, buttonLabel: "Semangat!" },
};

const CONFETTI_COLORS = ["#FFD93D", "#FF6B35", "#4CAF50", "#7C3AED", "#4ECDC4"];

function fireConfetti(big: boolean) {
  confetti({
    particleCount: big ? 100 : 50,
    spread: big ? 90 : 60,
    startVelocity: big ? 45 : 30,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS,
    zIndex: 200,
  });
  if (big) {
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 100,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: CONFETTI_COLORS,
        zIndex: 200,
      });
    }, 250);
  }
}

/** Koin berjatuhan dari atas layar (Sprint 6 — coin particle saat task approved). */
function CoinParticles() {
  const coins = useMemo(
    () =>
      Array.from({ length: 10 }, () => ({
        left: Math.round(Math.random() * 90) + 5,
        delay: Math.round(Math.random() * 500) / 1000,
        duration: 1 + Math.round(Math.random() * 600) / 1000,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {coins.map((c, i) => (
        <span
          key={i}
          className="absolute -top-10 text-2xl animate-coin-fall"
          style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

/** Bintang/sparkle berkelip (Sprint 6 — modal sparkle saat unlock avatar/pet). */
function SparkleField() {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 8 }, () => ({
        top: Math.round(Math.random() * 70) + 5,
        left: Math.round(Math.random() * 80) + 5,
        delay: Math.round(Math.random() * 800) / 1000,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-sparkle"
          style={{ top: `${s.top}%`, left: `${s.left}%`, animationDelay: `${s.delay}s` }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

interface CelebrationManagerProps {
  childId: string;
  notifications: NotificationItem[];
}

/** Modal perayaan berantai untuk notifikasi penting (level up, unlock, klaim, dll). */
export function CelebrationManager({ childId, notifications }: CelebrationManagerProps) {
  const [queue, setQueue] = useState(() => notifications.filter((n) => CELEBRATION_META[n.type]));
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const meta = CELEBRATION_META[current.type];
    soundManager.play(meta.sound);
    fireConfetti(meta.confettiBig);
  }, [current]);

  if (!current) return null;
  const meta = CELEBRATION_META[current.type];

  const handleClose = () => {
    void markNotificationsRead(childId, [current.id]);
    setQueue((q) => q.slice(1));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      {meta.particles === "coins" && <CoinParticles />}
      {meta.particles === "sparkles" && <SparkleField />}
      <DialogContent className="glass-strong max-w-xs rounded-3xl border-0 text-center shadow-card-deep">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="animate-celebrate-pop text-6xl">{meta.emoji}</span>
          <h2 className={cn("font-heading text-lg font-extrabold", meta.rainbow ? "animate-rainbow-text" : "text-ink-1")}>
            {current.title}
          </h2>
          {current.message && <p className="text-sm font-bold text-ink-2">{current.message}</p>}
          <GameButton variant="primary" className="mt-2" onClick={handleClose} playSound={false}>
            {meta.buttonLabel}
          </GameButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
