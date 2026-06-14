"use client";

import { useEffect } from "react";
import { audioManager } from "@/lib/audio/audio-manager";
import { useAudioStore } from "@/store/audio-store";
import type { BgmTrack } from "@/lib/audio/types";

/**
 * Mount di server layout untuk memicu crossfade BGM saat masuk section ini.
 * `track={null}` mematikan BGM (mis. section admin yang tanpa backsound).
 */
export function BgmTrigger({ track }: { track: BgmTrack | null }) {
  useEffect(() => {
    void useAudioStore.getState().hydrateFromServer();
    if (track === null) {
      audioManager.stopBGM();
    } else {
      audioManager.crossfadeBGM(track);
    }
  }, [track]);

  return null;
}
