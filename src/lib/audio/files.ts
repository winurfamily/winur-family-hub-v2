import type { BgmTrack, SfxName, VoiceCharacter, VoiceLine } from "./types";

export const BGM_FILES: Record<BgmTrack, string> = {
  login: "/sounds/bgm/login.mp3",
  daffa_room: "/sounds/bgm/room.mp3",
  dio_room: "/sounds/bgm/room.mp3",
  admin_home: "/sounds/bgm/admin_home.mp3",
};

export const SFX_FILES: Record<SfxName, string> = {
  pop: "/sounds/sfx/pop.mp3",
  coin: "/sounds/sfx/coin.mp3",
  bark: "/sounds/sfx/bark.mp3",
  sleep: "/sounds/sfx/sleep.mp3",
  wake: "/sounds/sfx/wake.mp3",
  click: "/sounds/sfx/click.mp3",
  level_up: "/sounds/sfx/level_up.mp3",
  unlock: "/sounds/sfx/unlock.mp3",
  task_done: "/sounds/sfx/task_done.mp3",
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
