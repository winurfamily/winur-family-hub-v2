"use client";

/**
 * Efek pitch sementara (runtime-only) untuk rekaman suara karakter.
 * Pakai SoundTouch (WSOLA) lewat soundtouchjs: pitch naik beberapa semitone
 * tanpa mengubah tempo, sehingga formant ikut sedikit naik secara alami
 * (bukan playbackRate biasa yang bikin efek chipmunk).
 */

import { PitchShifter } from "soundtouchjs";

/** Naik ~2.5 semitone agar suara terdengar seperti anak ±5 tahun, tetap natural. */
export const VOICE_PITCH_SEMITONES = 2.5;

const PROCESSOR_BUFFER_SIZE = 4096;

/**
 * Decode lalu putar `arrayBuffer` dengan pitch shift sementara. Buffer audio
 * & node efek dilepas begitu playback selesai — tidak ada hasil efek yang
 * disimpan, hanya dimainkan langsung ke speaker.
 */
export async function playWithPitchShift(
  ctx: AudioContext,
  arrayBuffer: ArrayBuffer,
  semitones: number = VOICE_PITCH_SEMITONES,
  volume = 1
): Promise<void> {
  const buffer = await ctx.decodeAudioData(arrayBuffer);

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        shifter.disconnect();
      } catch {
        // node sudah terlepas
      }
      gain.disconnect();
      shifter.off();
      resolve();
    };

    const shifter = new PitchShifter(ctx, buffer, PROCESSOR_BUFFER_SIZE, finish);
    shifter.tempo = 1; // tempo tetap normal
    shifter.pitchSemitones = semitones;

    const gain = ctx.createGain();
    gain.gain.value = volume;
    shifter.connect(gain);
    gain.connect(ctx.destination);
  });
}
