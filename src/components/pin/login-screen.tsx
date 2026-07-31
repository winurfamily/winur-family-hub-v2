"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { PinDots } from "./pin-dots";
import { PinPad } from "./pin-pad";
import { verifyPin, type PickerProfile } from "@/app/actions/auth";
import { useSessionStore } from "@/store/session-store";
import { soundManager } from "@/lib/sound/sound-manager";

interface LoginScreenProps {
  profile: PickerProfile;
  familyId: string;
  onBack: () => void;
}

/**
 * Layar masuk PIN — satu halaman penuh di HP, kartu terpusat di desktop.
 *
 * Catatan keamanan: layar ini tidak menentukan peran apa pun. Tujuan setelah
 * login diambil dari `role` yang dikembalikan server setelah PIN diverifikasi
 * (C.3), bukan dari data yang dipegang browser, dan setiap halaman /admin
 * memvalidasi ulang sesi di server.
 */
export function LoginScreen({ profile, familyId, onBack }: LoginScreenProps) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const setProfile = useSessionStore((s) => s.setProfile);
  const submittedFor = useRef<string | null>(null);

  const busy = isPending || isRedirecting;

  const submit = (value: string) => {
    // Cegah pengiriman ganda untuk PIN yang sama (mis. tap cepat/double event).
    if (submittedFor.current === value) return;
    submittedFor.current = value;

    startTransition(async () => {
      const result = await verifyPin(profile.id, value);

      if (!result.success || !result.profile) {
        setError(result.error ?? "PIN salah, coba lagi.");
        setShake(true);
        submittedFor.current = null;
        setTimeout(() => {
          setShake(false);
          setPin("");
        }, 400);
        return;
      }

      setProfile({
        id: result.profile.id,
        familyId,
        name: result.profile.name,
        role: result.profile.role,
      });

      soundManager.play("switch");
      // Tahan layar pada kondisi "memuat" sampai navigasi selesai, supaya
      // tidak ada kedipan kembali ke form login (C.4).
      setIsRedirecting(true);
      router.replace(result.profile.role === "admin" ? "/admin" : `/child/${result.profile.id}`);
    });
  };

  const appendDigit = (digit: string) => {
    if (busy) return;
    setPin((current) => {
      if (current.length >= profile.pinLength) return current;
      const next = current + digit;
      setError(null);
      if (next.length === profile.pinLength) submit(next);
      return next;
    });
  };

  const handleBackspace = () => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  // Dukungan papan ketik fisik di desktop (J.19).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") appendDigit(event.key);
      else if (event.key === "Backspace") handleBackspace();
      else if (event.key === "Escape" && !busy) onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const color = colorForName(profile.name);

  return (
    <div className="relative flex min-h-screen-dvh flex-col overflow-hidden bg-[linear-gradient(180deg,#7BB8E8_0%,#A8D4F0_40%,#E8F4FD_100%)]">
      {/* Header ringkas dengan tombol kembali (C.2). */}
      <header className="safe-top safe-x sticky top-0 z-10 flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          aria-label="Kembali ke pemilihan profil"
          className="tap-target flex items-center gap-1 rounded-xl bg-white/70 px-2.5 font-heading text-sm font-bold text-ink-1 backdrop-blur transition-colors active:bg-white disabled:opacity-50"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="pr-1">Kembali</span>
        </button>
      </header>

      <div className="safe-bottom safe-x flex flex-1 flex-col items-center justify-center px-5 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex w-full max-w-[360px] flex-col items-center rounded-[26px] bg-card px-5 py-6 shadow-card-deep sm:border-2 sm:border-border"
        >
          {/* Profil yang sedang masuk terlihat jelas. */}
          <AvatarDisplay src={profile.photoUrl} color={color} name={profile.name} size={72} />
          <h1 className="mt-3 font-heading text-xl font-black text-ink-1">{profile.name}</h1>
          <p className="mt-0.5 text-sm font-semibold text-ink-2">
            Masukkan PIN {profile.pinLength} digit
          </p>

          <PinDots length={profile.pinLength} filled={pin.length} shake={shake} />

          {/* Tinggi dikunci agar layout tidak melompat saat pesan muncul. */}
          <p
            role="alert"
            aria-live="polite"
            className="-mt-2 flex h-6 items-center text-center text-sm font-bold text-destructive"
          >
            {error ?? ""}
          </p>

          {busy ? (
            <div className="flex h-[212px] flex-col items-center justify-center gap-2 text-ink-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm font-bold">
                {isRedirecting ? "Menyiapkan halaman…" : "Memeriksa PIN…"}
              </span>
            </div>
          ) : (
            <PinPad onDigit={appendDigit} onBackspace={handleBackspace} disabled={busy} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
