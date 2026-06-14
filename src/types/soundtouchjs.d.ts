// soundtouchjs 0.3.0 ships no type definitions. Minimal surface used by
// src/lib/audio/pitch-shift.ts (formant-preserving pitch shift, tempo-locked).
declare module "soundtouchjs" {
  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number, onEnd?: () => void);
    tempo: number;
    pitch: number;
    pitchSemitones: number;
    rate: number;
    percentagePlayed: number;
    connect(toNode: AudioNode): void;
    disconnect(): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event?: string | null): void;
  }
}
