import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ProfileRole } from "@/lib/supabase/types";

export interface SessionProfile {
  id: string;
  familyId: string;
  name: string;
  role: ProfileRole;
}

interface SessionState {
  profile: SessionProfile | null;
  soundEnabled: boolean;
  setProfile: (profile: SessionProfile) => void;
  clearProfile: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      profile: null,
      soundEnabled: true,
      setProfile: (profile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    }),
    {
      name: "winur-session",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
