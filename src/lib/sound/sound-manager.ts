import { Howl } from "howler";
import { SOUND_FILES, SOUND_KEYS, type SoundKey } from "./sounds";

class SoundManager {
  private cache = new Map<SoundKey, Howl>();
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  private getHowl(key: SoundKey): Howl {
    let howl = this.cache.get(key);
    if (!howl) {
      howl = new Howl({ src: [SOUND_FILES[key]], preload: true });
      this.cache.set(key, howl);
    }
    return howl;
  }

  play(key: SoundKey) {
    if (!this.enabled) return;
    if (typeof window === "undefined") return;
    this.getHowl(key).play();
  }

  preloadAll() {
    if (typeof window === "undefined") return;
    SOUND_KEYS.forEach((key) => this.getHowl(key));
  }
}

export const soundManager = new SoundManager();
