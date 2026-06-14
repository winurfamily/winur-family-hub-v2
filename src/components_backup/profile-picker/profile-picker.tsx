"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { PinEntry } from "@/components/pin/pin-entry";
import { soundManager } from "@/lib/sound/sound-manager";
import { hexToRgba } from "@/lib/utils";
import type { PickerProfile } from "@/app/actions/auth";

interface ProfilePickerProps {
  profiles: PickerProfile[];
  familyId: string;
}

export function ProfilePicker({ profiles, familyId }: ProfilePickerProps) {
  const [selected, setSelected] = useState<PickerProfile | null>(null);

  const handleSelect = (profile: PickerProfile) => {
    soundManager.play("tap");
    setSelected(profile);
  };

  return (
    <div className="min-h-screen bg-picker-sky flex flex-col items-center justify-center p-6 gap-10 safe-top safe-bottom">
      <div className="text-center">
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-ink-1 drop-shadow-sm">
          Winur Family Hub
        </h1>
        <p className="text-ink-2 mt-2 font-body">Pilih profil untuk melanjutkan</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl w-full">
        {profiles.map((profile, i) => {
          const color = colorForName(profile.name);
          return (
            <motion.button
              key={profile.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => handleSelect(profile)}
              style={{
                borderColor: color,
                boxShadow: `0 8px 24px ${hexToRgba(color, 0.35)}`,
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-card border-[3px] transition-transform hover:scale-105 hover:-translate-y-1 active:scale-95"
            >
              <AvatarDisplay src={profile.photoUrl} color={color} name={profile.name} size={88} />
              <span className="font-heading font-extrabold text-lg text-ink-1">{profile.name}</span>
              <span
                className="text-xs font-bold text-white px-3 py-1 rounded-full"
                style={{ backgroundColor: color }}
              >
                {profile.role === "child" ? `Anak • Lv.${profile.level}` : "Admin"}
              </span>
            </motion.button>
          );
        })}
      </div>

      {profiles.length === 0 && (
        <p className="text-ink-2 text-center max-w-sm">
          Belum ada profil. Silakan selesaikan setup terlebih dahulu.
        </p>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-[24px] border-2 border-border shadow-card-deep p-6 w-full max-w-sm"
            >
              <PinEntry profile={selected} familyId={familyId} onBack={() => setSelected(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
