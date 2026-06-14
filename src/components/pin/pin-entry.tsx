"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { colorForName } from "@/lib/avatar-color";
import { PinDots } from "./pin-dots";
import { PinPad } from "./pin-pad";
import { GameButton } from "@/components/ui/game-button";
import { verifyPin, type PickerProfile } from "@/app/actions/auth";
import { useSessionStore } from "@/store/session-store";
import { soundManager } from "@/lib/sound/sound-manager";

interface PinEntryProps {
  profile: PickerProfile;
  familyId: string;
  onBack: () => void;
}

export function PinEntry({ profile, familyId, onBack }: PinEntryProps) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const setProfile = useSessionStore((s) => s.setProfile);

  const submit = (value: string) => {
    startTransition(async () => {
      const result = await verifyPin(profile.id, value);

      if (!result.success || !result.profile) {
        setError(result.error ?? "PIN salah, coba lagi.");
        setShake(true);
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
      router.push(result.profile.role === "admin" ? "/admin" : `/child/${result.profile.id}`);
    });
  };

  const handleDigit = (digit: string) => {
    if (isPending || pin.length >= profile.pinLength) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === profile.pinLength) submit(next);
  };

  const handleBackspace = () => {
    if (isPending) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <AvatarDisplay src={profile.photoUrl} color={colorForName(profile.name)} name={profile.name} size={64} />
      <h2 className="font-heading font-extrabold text-xl text-ink-1">{profile.name}</h2>
      <p className="text-sm text-ink-2">Masukkan PIN {profile.pinLength} digit</p>

      <PinDots length={profile.pinLength} filled={pin.length} shake={shake} />

      <p className="text-destructive text-sm font-bold h-5 -mt-2">{error ?? ""}</p>

      <PinPad onDigit={handleDigit} onBackspace={handleBackspace} disabled={isPending} />

      <GameButton variant="outline" size="sm" block onClick={onBack} className="mt-2">
        Kembali
      </GameButton>
    </div>
  );
}
