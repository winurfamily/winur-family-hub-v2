import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { audioManager } from "@/lib/audio/audio-manager";
import { soundManager } from "@/lib/sound/sound-manager";
import { useSessionStore } from "@/store/session-store";
import { getSoundSettings, updateSoundSettings } from "@/app/actions/sound-settings";

function applyMute(muted: boolean) {
  if (muted) audioManager.muteAll();
  else audioManager.unmuteAll();
  soundManager.setEnabled(!muted);
  useSessionStore.getState().setSoundEnabled(!muted);
}

interface AudioState {
  bgmVolume: number;
  sfxVolume: number;
  isMuted: boolean;
  setBgmVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  toggleMute: () => void;
  hydrateFromServer: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(settings: { bgmVolume: number; sfxVolume: number; isMuted: boolean }) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void updateSoundSettings(settings), 600);
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      bgmVolume: 0.5,
      sfxVolume: 0.7,
      isMuted: false,

      setBgmVolume: (v) => {
        audioManager.setVolumeBGM(v);
        set({ bgmVolume: v });
        const { sfxVolume, isMuted } = get();
        scheduleSave({ bgmVolume: v, sfxVolume, isMuted });
      },

      setSfxVolume: (v) => {
        audioManager.setVolumeSFX(v);
        set({ sfxVolume: v });
        const { bgmVolume, isMuted } = get();
        scheduleSave({ bgmVolume, sfxVolume: v, isMuted });
      },

      toggleMute: () => {
        const next = !get().isMuted;
        applyMute(next);
        set({ isMuted: next });
        const { bgmVolume, sfxVolume } = get();
        scheduleSave({ bgmVolume, sfxVolume, isMuted: next });
      },

      hydrateFromServer: async () => {
        const remote = await getSoundSettings();
        const next = {
          bgmVolume: remote?.bgmVolume ?? get().bgmVolume,
          sfxVolume: remote?.sfxVolume ?? get().sfxVolume,
          isMuted: remote?.isMuted ?? get().isMuted,
        };
        audioManager.setVolumeBGM(next.bgmVolume);
        audioManager.setVolumeSFX(next.sfxVolume);
        applyMute(next.isMuted);
        set(next);
      },
    }),
    {
      name: "winur-audio-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bgmVolume: state.bgmVolume,
        sfxVolume: state.sfxVolume,
        isMuted: state.isMuted,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        audioManager.setVolumeBGM(state.bgmVolume);
        audioManager.setVolumeSFX(state.sfxVolume);
        applyMute(state.isMuted);
      },
    }
  )
);
