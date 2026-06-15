"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { PinEntry } from "@/components/pin/pin-entry";
import { soundManager } from "@/lib/sound/sound-manager";
import { audioManager } from "@/lib/audio/audio-manager";
import type { PickerProfile } from "@/app/actions/auth";

interface ProfilePickerProps {
  profiles: PickerProfile[];
  familyId: string;
}

export function ProfilePicker({ profiles, familyId }: ProfilePickerProps) {
  const [selected, setSelected] = useState<PickerProfile | null>(null);

  useEffect(() => {
    audioManager.crossfadeBGM("login");
  }, []);

  const handleSelect = (profile: PickerProfile) => {
    audioManager.unlockAudio();
    soundManager.play("tap");
    setSelected(profile);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 safe-top safe-bottom">
      {/* Sky → grass gradient (rumah keluarga) */}
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,#7BB8E8_0%,#A8D4F0_35%,#C8E8C0_75%,#9BC88F_100%)]" />

      {/* House silhouette + roof */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[200px] w-[480px] max-w-[90vw] -translate-x-1/2 rounded-t-[20px] bg-[linear-gradient(#E8D5B7,#D4BFA0)] opacity-50" />
      <div
        className="pointer-events-none absolute bottom-[185px] left-1/2 -z-10 h-0 w-0 -translate-x-1/2"
        style={{
          borderLeft: "min(270px,45vw) solid transparent",
          borderRight: "min(270px,45vw) solid transparent",
          borderBottom: "90px solid rgba(196,98,86,.5)",
        }}
      />

      {/* Drifting clouds */}
      <Cloud className="top-[10%] h-8 w-24" />
      <Cloud className="top-[22%] h-6 w-16" delay={-18} />
      <Cloud className="top-[16%] h-5 w-14" delay={-30} />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center"
      >
        <h1 className="font-heading text-3xl font-black text-ink-1 drop-shadow-[0_2px_0_rgba(255,255,255,0.4)] sm:text-4xl">
          ⭐ Winur Family Hub
        </h1>
        <p className="mt-1 font-body text-sm font-semibold text-ink-2">
          Siapa yang akan lanjut progres hari ini?
        </p>
      </motion.div>

      {/* Profile cards */}
      <div className="z-10 mt-8 flex flex-wrap items-stretch justify-center gap-4 sm:gap-5">
        {profiles.map((profile, i) => {
          const color = colorForName(profile.name);
          const isChild = profile.role === "child";
          return (
            <motion.button
              key={profile.id}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
              whileHover={{ y: -8, scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleSelect(profile)}
              style={{ boxShadow: "0 10px 30px rgba(28,30,38,.18)" }}
              className="flex w-[150px] flex-col items-center rounded-[22px] border-[3px] border-transparent bg-white p-4 pt-5 text-center transition-colors"
            >
              <AvatarDisplay
                src={profile.photoUrl}
                color={color}
                name={profile.name}
                size={74}
                className="!border-0"
              />
              <span className="mt-2.5 font-heading text-[17px] font-black text-ink-1">
                {profile.name}
              </span>
              <span
                className="mt-1.5 inline-block rounded-full px-3 py-[3px] text-[10px] font-extrabold uppercase tracking-wide text-white"
                style={{ backgroundColor: color }}
              >
                {isChild ? "Anak" : "Admin"}
              </span>
              {isChild && (
                <span className="mt-1.5 text-[11px] font-bold text-ink-2">⭐ Level {profile.level}</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {profiles.length === 0 && (
        <p className="z-10 mt-6 max-w-sm text-center font-semibold text-white">
          Belum ada profil. Silakan selesaikan setup terlebih dahulu.
        </p>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-[24px] border-2 border-border bg-card p-6 shadow-card-deep"
            >
              <PinEntry profile={selected} familyId={familyId} onBack={() => setSelected(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Cloud({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={`pointer-events-none absolute -z-10 animate-float-cloud rounded-full bg-white/80 ${className ?? ""}`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
