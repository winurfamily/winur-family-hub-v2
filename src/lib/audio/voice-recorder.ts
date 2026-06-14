"use client";

/**
 * Rekam suara mic, encode jadi MP3 mono (lamejs) di browser. Hasil dipakai
 * untuk menimpa file di public/sounds/voice/<karakter>/<line>.mp3 lewat
 * /api/voice/record (lihat voice-recorder-manager.tsx).
 */

import { Mp3Encoder } from "@breezystack/lamejs";

const MP3_KBPS = 96;
const MP3_BLOCK_SIZE = 1152;

export interface VoiceRecording {
  blob: Blob;
  durationSec: number;
}

export interface ActiveRecording {
  stop: () => Promise<VoiceRecording>;
  cancel: () => void;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeMp3(buffer: AudioBuffer): Blob {
  const encoder = new Mp3Encoder(1, buffer.sampleRate, MP3_KBPS);
  const samples = floatTo16BitPCM(buffer.getChannelData(0));
  const chunks: Uint8Array<ArrayBuffer>[] = [];

  for (let i = 0; i < samples.length; i += MP3_BLOCK_SIZE) {
    const chunk = samples.subarray(i, i + MP3_BLOCK_SIZE);
    const encoded = encoder.encodeBuffer(chunk);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));

  return new Blob(chunks, { type: "audio/mpeg" });
}

/** Mulai rekam dari mic. Panggil `stop()` untuk selesai & encode ke MP3. */
export async function startVoiceRecording(): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const releaseMic = () => stream.getTracks().forEach((t) => t.stop());

  recorder.start();

  return {
    stop: () =>
      new Promise<VoiceRecording>((resolve, reject) => {
        recorder.onstop = async () => {
          releaseMic();
          let audioCtx: AudioContext | null = null;
          try {
            const recordedBlob = new Blob(chunks, { type: recorder.mimeType });
            const arrayBuffer = await recordedBlob.arrayBuffer();
            audioCtx = new AudioContext();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            resolve({ blob: encodeMp3(audioBuffer), durationSec: audioBuffer.duration });
          } catch (err) {
            reject(err);
          } finally {
            void audioCtx?.close();
          }
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      releaseMic();
    },
  };
}
