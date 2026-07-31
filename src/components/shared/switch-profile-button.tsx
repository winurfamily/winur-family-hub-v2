"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutSession } from "@/app/actions/auth";
import { useSessionStore } from "@/store/session-store";
import { soundManager } from "@/lib/sound/sound-manager";
import { audioManager } from "@/lib/audio/audio-manager";
import { cn } from "@/lib/utils";

interface SwitchProfileButtonProps {
  className?: string;
  iconOnly?: boolean;
}

export function SwitchProfileButton({ className, iconOnly = false }: SwitchProfileButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const clearProfile = useSessionStore((s) => s.clearProfile);

  const handleSwitch = () => {
    soundManager.play("switch");
    startTransition(async () => {
      // Urutan penting: cookie sesi dihapus di server LEBIH DULU, baru state
      // klien dibersihkan, baru navigasi. Kalau dibalik, halaman berikutnya
      // masih bisa terbaca sebagai sesi lama sesaat.
      await logoutSession();
      clearProfile();
      audioManager.stopBGM();
      // replace (bukan push) supaya tombol "kembali" browser tidak
      // memunculkan lagi halaman admin dari profil sebelumnya.
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border-2 border-border bg-card font-heading font-bold text-sm text-ink-2 shadow-card transition-transform active:scale-95 disabled:opacity-50",
        iconOnly ? "h-12 w-12 justify-center" : "px-3 py-2",
        className
      )}
    >
      <LogOut className="w-4 h-4" />
      {!iconOnly && "Ganti Profil"}
    </button>
  );
}
