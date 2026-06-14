export type BgmTrack = "login" | "daffa_room" | "dio_room" | "admin_home";

export type SfxName = "pop" | "coin" | "bark" | "sleep" | "wake" | "click" | "level_up" | "unlock" | "task_done";

export type VoiceCharacter = "daffa" | "dio";

/** Baris suara rekaman tetap (sapaan), diputar via Howler sebelum fallback ke TTS. */
export type VoiceLine = "halo" | "aku" | "belajar" | "bermain" | "istirahat" | "keren";

export interface AudioSettings {
  bgmVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}
