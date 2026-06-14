"use client";

/**
 * Fallback Web Audio API: dipakai AudioManager saat file MP3 (BGM/SFX) belum
 * tersedia di public/sounds/. Murni oscillator, tidak ada asset eksternal.
 */

import type { BgmTrack, SfxName } from "./types";

let actx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!actx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new Ctor();
  }
  if (actx.state === "suspended") void actx.resume();
  return actx;
}

function tone(f: number, d: number, type: OscillatorType, v = 0.12, dl = 0) {
  const c = getCtx();
  const tt = c.currentTime + dl;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(v, tt);
  g.gain.exponentialRampToValueAtTime(0.001, tt + d);
  o.start(tt);
  o.stop(tt + d);
}

function bark() {
  const c = getCtx();
  [0, 160].forEach((dl) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.connect(f);
    f.connect(g);
    g.connect(c.destination);
    o.type = "sawtooth";
    f.type = "bandpass";
    f.frequency.value = 880;
    const t0 = c.currentTime + dl / 1000;
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.12);
    g.gain.setValueAtTime(0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    o.start(t0);
    o.stop(t0 + 0.14);
  });
}

export function playFallbackSfx(name: SfxName, volume = 1) {
  try {
    const v = 0.12 * volume;
    switch (name) {
      case "pop":
        tone(700, 0.12, "sine", v);
        break;
      case "coin":
        tone(880, 0.12, "square", v * 0.85);
        tone(1320, 0.18, "square", v * 0.85, 0.08);
        break;
      case "sleep":
        tone(330, 0.4, "sine", v * 0.7);
        tone(247, 0.5, "sine", v * 0.6, 0.15);
        break;
      case "wake":
        tone(523, 0.12, "triangle", v * 0.85);
        tone(784, 0.16, "triangle", v * 0.85, 0.1);
        break;
      case "bark":
        bark();
        break;
      case "click":
        tone(900, 0.05, "square", v * 0.5);
        break;
      case "level_up":
        tone(523, 0.1, "triangle", v);
        tone(659, 0.1, "triangle", v, 0.09);
        tone(784, 0.1, "triangle", v, 0.18);
        tone(1046, 0.22, "triangle", v, 0.27);
        break;
      case "unlock":
        tone(660, 0.1, "sine", v * 0.85);
        tone(990, 0.18, "sine", v * 0.85, 0.1);
        break;
      case "task_done":
        tone(523, 0.1, "square", v * 0.85);
        tone(784, 0.18, "square", v * 0.85, 0.1);
        break;
    }
  } catch {
    /* audio unsupported */
  }
}

/* ---- BGM fallback (melodi sederhana per track) ---- */
const BGM_MELODIES: Record<BgmTrack, { mel: number[]; bass: number[]; step: number }> = {
  login: { mel: [392, 440, 494, 440, 392, 349, 392, 440], bass: [196, 196, 220, 220, 196, 196, 175, 175], step: 320 },
  daffa_room: {
    mel: [523, 659, 784, 659, 523, 659, 880, 784, 698, 587, 523, 587, 659, 523, 440, 523],
    bass: [131, 131, 196, 196, 165, 165, 131, 131, 175, 175, 147, 147, 131, 131, 98, 98],
    step: 200,
  },
  dio_room: { mel: [659, 784, 880, 784, 659, 784, 988, 880, 659, 784, 880, 988, 1046, 880, 784, 659], bass: [165, 165, 220, 220, 165, 165, 247, 247, 165, 165, 220, 220, 165, 165, 196, 196], step: 220 },
  admin_home: { mel: [440, 494, 523, 494, 440, 392, 440, 494], bass: [110, 110, 131, 131, 110, 110, 98, 98], step: 420 },
};

let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmStep = 0;
let bgmVolumeRef = 0.05;

export function startFallbackBgm(track: BgmTrack, volume = 0.5) {
  stopFallbackBgm();
  getCtx();
  bgmStep = 0;
  bgmVolumeRef = volume;
  const { mel, bass, step } = BGM_MELODIES[track];
  bgmTimer = setInterval(() => {
    const c = getCtx();
    const m = mel[bgmStep % mel.length];
    const gMel = 0.05 * bgmVolumeRef * 2;
    if (m) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.type = "triangle";
      o.frequency.value = m;
      g.gain.setValueAtTime(gMel, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + step / 1000 + 0.02);
      o.start();
      o.stop(c.currentTime + step / 1000 + 0.04);
    }
    if (bgmStep % 2 === 0) {
      const b = bass[bgmStep % bass.length];
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.type = "sine";
      o.frequency.value = b;
      g.gain.setValueAtTime(0.06 * bgmVolumeRef * 2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + step / 1000 + 0.15);
      o.start();
      o.stop(c.currentTime + step / 1000 + 0.16);
    }
    bgmStep++;
  }, step);
}

export function setFallbackBgmVolume(volume: number) {
  bgmVolumeRef = volume;
}

export function stopFallbackBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

export function isFallbackBgmPlaying() {
  return bgmTimer !== null;
}
