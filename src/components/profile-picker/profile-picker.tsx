"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { LoginScreen } from "@/components/pin/login-screen";
import { soundManager } from "@/lib/sound/sound-manager";
import { audioManager } from "@/lib/audio/audio-manager";
import type { PickerProfile } from "@/app/actions/auth";

interface ProfilePickerProps {
  profiles: PickerProfile[];
  familyId: string;
}

/**
 * Layar awal pemilihan profil.
 *
 * Tidak ada musik apa pun di sini (B.1): tidak ada autoplay, tidak ada tombol
 * musik, dan tidak ada berkas audio yang dimuat saat halaman pertama dibuka.
 * audioManager hanya disentuh untuk membuka kunci audio browser ketika
 * pengguna mengetuk kartu — itu tidak mengunduh berkas apa pun, hanya
 * menyiapkan AudioContext agar efek suara di halaman berikutnya bisa berbunyi.
 */
export function ProfilePicker({ profiles, familyId }: ProfilePickerProps) {
  const [selected, setSelected] = useState<PickerProfile | null>(null);

  const handleSelect = (profile: PickerProfile) => {
    audioManager.unlockAudio();
    soundManager.play("tap");
    setSelected(profile);
  };

  // Login tampil sebagai halaman penuh, bukan modal kecil di atas picker,
  // sehingga di HP terasa seperti layar aplikasi tersendiri (C.2).
  if (selected) {
    return <LoginScreen profile={selected} familyId={familyId} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="relative flex min-h-screen-dvh flex-col overflow-hidden">
      {/* Latar langit → rumput */}
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,#7BB8E8_0%,#A8D4F0_35%,#C8E8C0_75%,#9BC88F_100%)]" />

      {/* Siluet rumah — disembunyikan di layar sangat sempit agar kartu tidak terdesak */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 hidden h-[200px] w-[480px] max-w-[90vw] -translate-x-1/2 rounded-t-[20px] bg-[linear-gradient(#E8D5B7,#D4BFA0)] opacity-50 min-[380px]:block" />
      <div
        className="pointer-events-none absolute bottom-[185px] left-1/2 -z-10 hidden h-0 w-0 -translate-x-1/2 min-[380px]:block"
        style={{
          borderLeft: "min(270px,45vw) solid transparent",
          borderRight: "min(270px,45vw) solid transparent",
          borderBottom: "90px solid rgba(196,98,86,.5)",
        }}
      />

      <Cloud className="top-[8%] h-8 w-24" />
      <Cloud className="top-[20%] h-6 w-16" delay={-18} />
      <Cloud className="top-[14%] h-5 w-14" delay={-30} />

      {/* Konten dipusatkan vertikal, dengan padding aman untuk perangkat bernotch. */}
      <div className="safe-top safe-bottom safe-x relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 sm:gap-8">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="font-heading text-[26px] font-black leading-tight text-ink-1 drop-shadow-[0_2px_0_rgba(255,255,255,0.45)] min-[380px]:text-3xl sm:text-4xl">
            ⭐ Winur Family Hub
          </h1>
          <p className="mt-1.5 font-body text-[13px] font-semibold text-ink-2 sm:text-sm">
            Siapa yang akan lanjut progres hari ini?
          </p>
        </motion.header>

        {profiles.length === 0 ? (
          <p className="max-w-sm rounded-2xl bg-white/85 px-5 py-4 text-center text-sm font-semibold text-ink-2">
            Belum ada profil. Silakan selesaikan setup terlebih dahulu.
          </p>
        ) : (
          /* 2 kolom proporsional di HP (320–430px), melebar jadi satu baris
             kartu di tablet/desktop. Tidak ada scroll horizontal di lebar mana pun. */
          <div className="grid w-full max-w-[420px] grid-cols-2 gap-3 min-[380px]:gap-4 sm:max-w-none sm:grid-flow-col sm:auto-cols-[150px] sm:gap-5">
            {profiles.map((profile, i) => (
              <ProfileCard key={profile.id} profile={profile} index={i} onSelect={() => handleSelect(profile)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  index,
  onSelect,
}: {
  profile: PickerProfile;
  index: number;
  onSelect: () => void;
}) {
  const color = colorForName(profile.name);
  const isChild = profile.role === "child";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.28 }}
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      aria-label={`Masuk sebagai ${profile.name}`}
      style={{ boxShadow: "0 10px 30px rgba(28,30,38,.18)" }}
      className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-[22px] border-[3px] border-transparent bg-white p-3 text-center transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white sm:min-h-[170px] sm:p-4 sm:hover:-translate-y-2"
    >
      <AvatarDisplay
        src={profile.photoUrl}
        color={color}
        name={profile.name}
        size={64}
        className="!border-0 sm:!h-[74px] sm:!w-[74px]"
      />
      <span className="mt-2 line-clamp-1 font-heading text-[15px] font-black text-ink-1 sm:text-[17px]">
        {profile.name}
      </span>
      <span
        className="mt-1.5 inline-block rounded-full px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-wide text-white"
        style={{ backgroundColor: color }}
      >
        {isChild ? "Anak" : "Admin"}
      </span>
      {isChild && <span className="mt-1 text-[11px] font-bold text-ink-2">⭐ Level {profile.level}</span>}
    </motion.button>
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
