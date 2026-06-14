"use client";

/**
 * Singleton audio manager (Howler.js) — BGM crossfade, SFX, voice ducking.
 * Jika file MP3 di public/sounds/ belum ada, otomatis fallback ke Web Audio
 * oscillator (lihat web-audio-fallback.ts) tanpa melempar error.
 */

import { Howl, Howler } from "howler";
import { BGM_FILES, SFX_FILES, VOICE_FILES } from "./files";
import {
  playFallbackSfx,
  startFallbackBgm,
  stopFallbackBgm,
  setFallbackBgmVolume,
} from "./web-audio-fallback";
import { playWithPitchShift } from "./pitch-shift";
import type { BgmTrack, SfxName, VoiceCharacter, VoiceLine } from "./types";

const DEFAULT_BGM_VOLUME = 0.5;
const DEFAULT_SFX_VOLUME = 0.7;

class AudioManager {
  private bgmHowls = new Map<BgmTrack, Howl>();
  private bgmFailed = new Set<BgmTrack>();
  private sfxHowls = new Map<SfxName, Howl>();
  private sfxFailed = new Set<SfxName>();

  private voiceFailed = new Set<string>();
  /** Bumped lewat invalidateVoiceLine() setiap rekam ulang, untuk cache-bust fetch. */
  private voiceVersion = new Map<string, number>();

  private currentBgm: BgmTrack | null = null;
  private bgmPaused = false;

  private bgmVolume = DEFAULT_BGM_VOLUME;
  private sfxVolume = DEFAULT_SFX_VOLUME;
  private muted = false;
  private duckFactor = 1;

  private fallbackRampTimer: ReturnType<typeof setInterval> | null = null;

  private effectiveBgmVolume(): number {
    return this.muted ? 0 : this.bgmVolume * this.duckFactor;
  }

  private effectiveSfxVolume(): number {
    return this.muted ? 0 : this.sfxVolume;
  }

  private getBgmHowl(track: BgmTrack): Howl {
    let howl = this.bgmHowls.get(track);
    if (!howl) {
      howl = new Howl({
        src: [BGM_FILES[track]],
        loop: true,
        volume: 0,
        html5: true,
        onloaderror: () => {
          this.bgmFailed.add(track);
          if (this.currentBgm === track && !this.bgmPaused) {
            howl?.stop();
            startFallbackBgm(track, this.effectiveBgmVolume());
          }
        },
      });
      this.bgmHowls.set(track, howl);
    }
    return howl;
  }

  private getSfxHowl(name: SfxName): Howl {
    let howl = this.sfxHowls.get(name);
    if (!howl) {
      howl = new Howl({
        src: [SFX_FILES[name]],
        preload: true,
        onloaderror: () => this.sfxFailed.add(name),
      });
      this.sfxHowls.set(name, howl);
    }
    return howl;
  }

  private clearFallbackRamp() {
    if (this.fallbackRampTimer) {
      clearInterval(this.fallbackRampTimer);
      this.fallbackRampTimer = null;
    }
  }

  private rampFallbackVolume(to: number, duration: number) {
    this.clearFallbackRamp();
    const steps = 12;
    const from = 0;
    let i = 0;
    this.fallbackRampTimer = setInterval(() => {
      i++;
      const v = from + ((to - from) * i) / steps;
      setFallbackBgmVolume(v);
      if (i >= steps) this.clearFallbackRamp();
    }, duration / steps);
  }

  /** Resume AudioContext setelah interaksi pertama (autoplay policy). */
  unlockAudio() {
    if (Howler.ctx && Howler.ctx.state === "suspended") {
      void Howler.ctx.resume();
    }
  }

  playBGM(track: BgmTrack) {
    if (this.currentBgm === track && !this.bgmPaused) return;
    this.stopBGM();
    this.currentBgm = track;
    this.bgmPaused = false;

    if (this.bgmFailed.has(track)) {
      startFallbackBgm(track, this.effectiveBgmVolume());
      return;
    }
    const howl = this.getBgmHowl(track);
    howl.volume(this.effectiveBgmVolume());
    howl.play();
  }

  crossfadeBGM(track: BgmTrack, duration = 800) {
    if (this.currentBgm === track && !this.bgmPaused) return;

    const prevTrack = this.currentBgm;
    const prevHowl = prevTrack ? this.bgmHowls.get(prevTrack) : null;
    const prevWasFallback = prevTrack ? this.bgmFailed.has(prevTrack) : false;

    this.currentBgm = track;
    this.bgmPaused = false;

    if (prevHowl && prevHowl.playing()) {
      prevHowl.fade(prevHowl.volume(), 0, duration);
      setTimeout(() => prevHowl.stop(), duration);
    }
    if (prevWasFallback) {
      this.rampFallbackVolume(0, duration);
      setTimeout(() => stopFallbackBgm(), duration);
    }

    const target = this.effectiveBgmVolume();
    if (this.bgmFailed.has(track)) {
      startFallbackBgm(track, 0);
      this.rampFallbackVolume(target, duration);
      return;
    }
    const howl = this.getBgmHowl(track);
    howl.volume(0);
    howl.play();
    howl.fade(0, target, duration);
  }

  stopBGM() {
    this.clearFallbackRamp();
    stopFallbackBgm();
    this.bgmHowls.forEach((howl) => howl.stop());
    this.currentBgm = null;
    this.bgmPaused = false;
  }

  /** Pause sementara (mis. saat karakter bicara), bisa resume ke track sama. */
  pauseBGM() {
    if (!this.currentBgm || this.bgmPaused) return;
    this.bgmPaused = true;
    if (this.bgmFailed.has(this.currentBgm)) {
      stopFallbackBgm();
      return;
    }
    this.bgmHowls.get(this.currentBgm)?.pause();
  }

  resumeBGM() {
    if (!this.currentBgm || !this.bgmPaused) return;
    this.bgmPaused = false;
    if (this.bgmFailed.has(this.currentBgm)) {
      startFallbackBgm(this.currentBgm, this.effectiveBgmVolume());
      return;
    }
    const howl = this.bgmHowls.get(this.currentBgm);
    howl?.volume(this.effectiveBgmVolume());
    howl?.play();
  }

  /** Kecilkan volume BGM sementara (mis. saat rekam mic) tanpa mengubah setting volume. */
  duckBGM(factor = 0.2) {
    this.duckFactor = factor;
    this.applyBgmVolume();
  }

  unduckBGM() {
    this.duckFactor = 1;
    this.applyBgmVolume();
  }

  private applyBgmVolume() {
    if (!this.currentBgm || this.bgmPaused) return;
    const v = this.effectiveBgmVolume();
    if (this.bgmFailed.has(this.currentBgm)) {
      setFallbackBgmVolume(v);
    } else {
      this.bgmHowls.get(this.currentBgm)?.volume(v);
    }
  }

  playSFX(name: SfxName) {
    if (this.muted) return;
    if (this.sfxFailed.has(name)) {
      playFallbackSfx(name, this.sfxVolume);
      return;
    }
    const howl = this.getSfxHowl(name);
    howl.volume(this.effectiveSfxVolume());
    howl.play();
  }

  /**
   * Putar baris suara rekaman (file di public/sounds/voice/<karakter>/<line>.mp3)
   * dengan efek pitch sementara (lihat pitch-shift.ts). Resolve true jika
   * berhasil dimainkan sampai selesai, false jika file belum ada / gagal
   * dimuat — pemanggil lalu fallback ke ElevenLabs/SpeechSynthesis.
   */
  async playVoiceLine(character: VoiceCharacter, line: VoiceLine): Promise<boolean> {
    const key = `${character}:${line}`;
    if (this.voiceFailed.has(key) || this.muted) return false;

    const ctx = Howler.ctx as AudioContext | undefined;
    if (!ctx) return false;

    const version = this.voiceVersion.get(key);
    const url = VOICE_FILES[character][line] + (version ? `?v=${version}` : "");

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("voice file not found");
      const arrayBuffer = await res.arrayBuffer();
      await playWithPitchShift(ctx, arrayBuffer);
      return true;
    } catch {
      this.voiceFailed.add(key);
      return false;
    }
  }

  /**
   * Reset status baris suara setelah rekam ulang (lihat voice-recorder.ts):
   * hapus flag "gagal" & bump versi supaya fetch berikutnya memuat file
   * yang baru ditimpa, bukan dari cache HTTP.
   */
  invalidateVoiceLine(character: VoiceCharacter, line: VoiceLine) {
    const key = `${character}:${line}`;
    this.voiceFailed.delete(key);
    this.voiceVersion.set(key, Date.now());
  }

  setVolumeBGM(v: number) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    this.applyBgmVolume();
  }

  setVolumeSFX(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  getVolumeBGM() {
    return this.bgmVolume;
  }

  getVolumeSFX() {
    return this.sfxVolume;
  }

  muteAll() {
    this.muted = true;
    this.applyBgmVolume();
  }

  unmuteAll() {
    this.muted = false;
    this.applyBgmVolume();
  }

  isMuted() {
    return this.muted;
  }

  getCurrentTrack() {
    return this.currentBgm;
  }
}

export const audioManager = new AudioManager();
export type { BgmTrack, SfxName };
