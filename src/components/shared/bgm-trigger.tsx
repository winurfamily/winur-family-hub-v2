"use client";

import { useEffect } from "react";
import { audioManager } from "@/lib/audio/audio-manager";
import { useAudioStore } from "@/store/audio-store";
import type { BgmTrack } from "@/lib/audio/types";

/** Mount di server layout untuk memicu crossfade BGM saat masuk section ini. */
export function BgmTrigger({ track }: { track: BgmTrack }) {
  useEffect(() => {
    void useAudioStore.getState().hydrateFromServer();
    audioManager.crossfadeBGM(track);
  }, [track]);

  return null;
}
