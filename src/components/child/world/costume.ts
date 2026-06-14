/**
 * Data & helper kostum untuk Dunia Anak.
 * Modul ini TANPA "use client" agar bisa diimpor dari Server Component
 * (mis. src/app/child/[id]/page.tsx) maupun Client Component (CharacterSvg, sheets).
 */

export type CostumeKey =
  | "default"
  | "polisi"
  | "tentara"
  | "boboi"
  | "minecraft"
  | "robot"
  | "astro"
  | "pirate";

export interface CostumeConfig {
  shirt: string;
  slv: string;
  pants: string;
  pock: string;
  cuff: string;
  shoe: string;
  hat: string | null;
  kit: string | null;
  col: boolean;
}

export const DAFFA_COS: Record<CostumeKey, CostumeConfig> = {
  default: { shirt: "#F5F1E3", slv: "#F5F1E3", pants: "#5C6B3A", pock: "#4A5730", cuff: "#6B7A45", shoe: "#3E8E4E", hat: null, kit: null, col: true },
  polisi: { shirt: "#2E4A7A", slv: "#2E4A7A", pants: "#1F3355", pock: "#16263F", cuff: "#2E4A7A", shoe: "#1F1A17", hat: "capPol", kit: "kitPol", col: false },
  tentara: { shirt: "#5C6B3A", slv: "#5C6B3A", pants: "#4A5730", pock: "#3A4526", cuff: "#6B7A45", shoe: "#3A3A28", hat: "capTentara", kit: "kitTentara", col: false },
  boboi: { shirt: "#FF7B30", slv: "#FF7B30", pants: "#2E3A4D", pock: "#1F2A3A", cuff: "#E8641F", shoe: "#FFD24D", hat: "capBoboi", kit: "kitBoboi", col: false },
  minecraft: { shirt: "#16A085", slv: "#16A085", pants: "#4A6FA5", pock: "#3A5A8C", cuff: "#12806A", shoe: "#6B4A2E", hat: "hatSteve", kit: "kitSteve", col: false },
  robot: { shirt: "#9AA8BE", slv: "#9AA8BE", pants: "#6E7A8E", pock: "#5A6678", cuff: "#8A98AE", shoe: "#5A6678", hat: "helmRobot", kit: "kitRobot", col: false },
  astro: { shirt: "#F2F4F8", slv: "#F2F4F8", pants: "#E2E6EE", pock: "#C5CBD8", cuff: "#C5CBD8", shoe: "#C5CBD8", hat: "helmAstro", kit: "kitAstro", col: false },
  pirate: { shirt: "#6E4A28", slv: "#6E4A28", pants: "#3A2A1C", pock: "#2A1E14", cuff: "#5E3A1E", shoe: "#2A1E14", hat: "hatPirate", kit: "kitPirate", col: false },
};

// Dio (balita) — kostum hanya ganti warna (tanpa kit/hat kompleks), tema Tayo.
export const DIO_COS: Record<CostumeKey, CostumeConfig> = {
  default: { shirt: "#5AB7E8", slv: "#5AB7E8", pants: "#1F3A5F", pock: "#16304D", cuff: "#3E9BD0", shoe: "#4A90D9", hat: null, kit: null, col: true },
  polisi: { shirt: "#2E4A7A", slv: "#2E4A7A", pants: "#1F3355", pock: "#16263F", cuff: "#2E4A7A", shoe: "#1F1A17", hat: null, kit: null, col: false },
  tentara: { shirt: "#5C6B3A", slv: "#5C6B3A", pants: "#4A5730", pock: "#3A4526", cuff: "#6B7A45", shoe: "#3A3A28", hat: null, kit: null, col: false },
  boboi: { shirt: "#FF7B30", slv: "#FF7B30", pants: "#2E3A4D", pock: "#1F2A3A", cuff: "#E8641F", shoe: "#FFD24D", hat: null, kit: null, col: false },
  minecraft: { shirt: "#16A085", slv: "#16A085", pants: "#4A6FA5", pock: "#3A5A8C", cuff: "#12806A", shoe: "#6B4A2E", hat: null, kit: null, col: false },
  robot: { shirt: "#9AA8BE", slv: "#9AA8BE", pants: "#6E7A8E", pock: "#5A6678", cuff: "#8A98AE", shoe: "#5A6678", hat: null, kit: null, col: false },
  astro: { shirt: "#F2F4F8", slv: "#F2F4F8", pants: "#E2E6EE", pock: "#C5CBD8", cuff: "#C5CBD8", shoe: "#C5CBD8", hat: null, kit: null, col: false },
  pirate: { shirt: "#FFC24D", slv: "#FFC24D", pants: "#3A2A1C", pock: "#2A1E14", cuff: "#E0A33A", shoe: "#2A1E14", hat: null, kit: null, col: false },
};

/** Alias kata kunci (id/en) → CostumeKey SVG. */
const COSTUME_ALIASES: Record<string, CostumeKey> = {
  polisi: "polisi",
  tentara: "tentara",
  boboi: "boboi",
  boboiboy: "boboi",
  minecraft: "minecraft",
  robot: "robot",
  astro: "astro",
  astronot: "astro",
  pirate: "pirate",
  bajaklaut: "pirate",
  "bajak laut": "pirate",
};

/**
 * Mapping string costume/nama avatar dari DB → CostumeKey SVG.
 * Cek kolom `costume` dulu, lalu fallback ke `name` avatar
 * (banyak avatar lawas dibuat tanpa mengisi kolom `costume`).
 */
export function costumeKeyFrom(costume: string | null | undefined, name?: string | null): CostumeKey {
  const sources = [costume, name].filter((s): s is string => !!s).map((s) => s.toLowerCase());
  for (const [alias, key] of Object.entries(COSTUME_ALIASES)) {
    if (sources.some((s) => s.includes(alias))) return key;
  }
  return "default";
}
