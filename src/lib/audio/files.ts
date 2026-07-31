import type { BgmTrack, SfxName, VoiceCharacter, VoiceLine } from "./types";

export const BGM_FILES: Record<BgmTrack, string> = {
  daffa_room: "/sounds/bgm/room.mp3",
  dio_room: "/sounds/bgm/room.mp3",
  admin_home: "/sounds/bgm/room.mp3",
};

export const SFX_FILES: Record<SfxName, string> = {
  pop: "/sounds/tap.wav",
  coin: "/sounds/claim.wav",
  bark: "/sounds/pet_idle.wav",
  sleep: "/sounds/pet_idle.wav",
  wake: "/sounds/switch.wav",
  click: "/sounds/tap.wav",
  level_up: "/sounds/level_up.wav",
  unlock: "/sounds/unlock.wav",
  task_done: "/sounds/task_done.wav",
};

export const VOICE_FILES: Record<VoiceCharacter, Record<VoiceLine, string>> = {
  daffa: {
    halo: "/sounds/voice/daffa/halo.mp3",
    aku: "/sounds/voice/daffa/aku.mp3",
    belajar: "/sounds/voice/daffa/belajar.mp3",
    bermain: "/sounds/voice/daffa/bermain.mp3",
    istirahat: "/sounds/voice/daffa/istirahat.mp3",
    keren: "/sounds/voice/daffa/keren.mp3",
  },
  dio: {
    halo: "/sounds/voice/dio/halo.mp3",
    aku: "/sounds/voice/dio/aku.mp3",
    belajar: "/sounds/voice/dio/belajar.mp3",
    bermain: "/sounds/voice/dio/bermain.mp3",
    istirahat: "/sounds/voice/dio/istirahat.mp3",
    keren: "/sounds/voice/dio/keren.mp3",
  },
};
