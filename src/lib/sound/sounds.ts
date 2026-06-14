export const SOUND_KEYS = [
  "tap",
  "task_done",
  "approved",
  "level_up",
  "unlock",
  "claim",
  "streak",
  "invest_done",
  "switch",
  "pet_idle",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

export const SOUND_FILES: Record<SoundKey, string> = {
  tap: "/sounds/tap.wav",
  task_done: "/sounds/task_done.wav",
  approved: "/sounds/approved.wav",
  level_up: "/sounds/level_up.wav",
  unlock: "/sounds/unlock.wav",
  claim: "/sounds/claim.wav",
  streak: "/sounds/streak.wav",
  invest_done: "/sounds/invest_done.wav",
  switch: "/sounds/switch.wav",
  pet_idle: "/sounds/pet_idle.wav",
};
