/**
 * Konfigurasi tema kamar (V3 redesign, BAGIAN 2) — image-based room + hotspot.
 * Tanpa "use client" agar bisa diimpor dari Server Component (child/[id]/page.tsx)
 * maupun Client Component (child-world.tsx, room-stage.tsx, tema-sheet.tsx).
 *
 * Layout perabot (jendela/lemari/meja/rak/kasur) identik di ketiga background
 * bawaan (roket/minecraft/tayo), jadi satu konfigurasi hotspot/walkable/posisi
 * dipakai bersama — IKUTI PERSIS Docs/ROOM_DAFFA_FINAL.html.
 */

export type HotspotAction = "task" | "kostum" | "riwayat" | "tema" | "daynight";

export interface Hotspot {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  action: HotspotAction;
  label: string;
}

export interface WalkableArea {
  xMin: number;
  xMax: number;
  bMin: number;
  bMax: number;
}

export interface Position {
  x: number;
  b: number;
}

export interface RoomTheme {
  key: string;
  name: string;
  dayImage: string;
  nightImage: string;
  /** Dimensi asli gambar siang/malam (px) — basis hitung cover-scale `.stage`. */
  imgW: number;
  imgH: number;
  hotspots: Hotspot[];
  walkable: WalkableArea;
  defaultPosition: { avatar: Position; pet: Position; piggy: Position };
  notifPosition: { left: number; top: number };
  forKind: ("daffa" | "dio")[];
}

/** Kanvas standar tema kamar (16:10) — lihat Docs/FIX_KAMAR_ANAK.md. */
const CANVAS_W = 1586;
const CANVAS_H = 992;

const SHARED_HOTSPOTS: Hotspot[] = [
  { id: "jendela", left: 39, top: 4, width: 21, height: 40, action: "daynight", label: "🌗 Jendela · Siang/Malam" },
  { id: "lemari", left: 77, top: 22, width: 17, height: 40, action: "kostum", label: "👕 Lemari · Ganti Baju" },
  { id: "meja", left: 80, top: 60, width: 20, height: 28, action: "task", label: "📋 Meja · Tugas" },
  { id: "rak", left: 0, top: 46, width: 12, height: 22, action: "riwayat", label: "📖 Rak · Riwayat" },
  { id: "kasur", left: 3, top: 40, width: 35, height: 34, action: "tema", label: "🛏️ Kasur · Tema Kamar" },
];

const SHARED_WALKABLE: WalkableArea = { xMin: 20, xMax: 72, bMin: 8, bMax: 30 };

const SHARED_DEFAULT_POSITION = {
  avatar: { x: 46, b: 14 },
  pet: { x: 58, b: 11 },
  piggy: { x: 66, b: 11 },
};

const SHARED_NOTIF_POSITION = { left: 88, top: 52 };

/**
 * Tema "roket" — kalibrasi baru (Docs/FIX_KAMAR_ANAK.md poin 2), khusus untuk
 * gambar 16:10 1586x992 (`roket-siang.webp` / `roket-malam.webp`). Koordinat
 * persen relatif ke `.stage` (cover-scaled), bukan ke `SHARED_*`.
 */
const ROKET_HOTSPOTS: Hotspot[] = [
  { id: "jendela", left: 40, top: 12, width: 20, height: 34, action: "daynight", label: "🌗 Jendela · Siang/Malam" },
  { id: "lemari", left: 70, top: 28, width: 17, height: 34, action: "kostum", label: "👕 Lemari · Ganti Baju" },
  { id: "meja", left: 78, top: 58, width: 21, height: 26, action: "task", label: "📋 Meja · Tugas" },
  { id: "rak", left: 4, top: 60, width: 13, height: 24, action: "riwayat", label: "📖 Rak · Riwayat" },
  { id: "kasur", left: 11, top: 44, width: 30, height: 34, action: "tema", label: "🛏️ Kasur · Tema Kamar" },
];

const ROKET_WALKABLE: WalkableArea = { xMin: 30, xMax: 70, bMin: 8, bMax: 26 };

const ROKET_DEFAULT_POSITION = {
  avatar: { x: 40, b: 14 },
  pet: { x: 55, b: 10 },
  piggy: { x: 62, b: 10 },
};

const ROKET_NOTIF_POSITION = { left: 88, top: 50 };

/**
 * Bangun RoomTheme dari sepasang gambar (siang/malam) memakai layout perabot
 * BERSAMA (hotspot/walkable/posisi) — dipakai tema bawaan MAUPUN tema custom hasil
 * upload admin, supaya area klik selalu presisi seperti Docs/ROOM_DAFFA_FINAL.html.
 * `imgW`/`imgH` default ke kanvas standar 16:10 (Docs/FIX_KAMAR_ANAK.md poin 7).
 */
export function makeRoomTheme(
  key: string,
  name: string,
  dayImage: string,
  nightImage: string,
  forKind: ("daffa" | "dio")[] = ["daffa", "dio"],
  imgW: number = CANVAS_W,
  imgH: number = CANVAS_H
): RoomTheme {
  return {
    key,
    name,
    dayImage,
    nightImage,
    imgW,
    imgH,
    hotspots: SHARED_HOTSPOTS,
    walkable: SHARED_WALKABLE,
    defaultPosition: SHARED_DEFAULT_POSITION,
    notifPosition: SHARED_NOTIF_POSITION,
    forKind,
  };
}

function builtinTheme(key: string, name: string, forKind: ("daffa" | "dio")[]): RoomTheme {
  return makeRoomTheme(key, name, `/themes/${key}-siang.webp`, `/themes/${key}-malam.webp`, forKind);
}

/** Tema "roket": gambar 16:10 1586x992 + kalibrasi hotspot/walkable/posisi sendiri. */
function roketTheme(): RoomTheme {
  return {
    key: "roket",
    name: "Roket",
    dayImage: "/themes/roket-siang.webp",
    nightImage: "/themes/roket-malam.webp",
    imgW: CANVAS_W,
    imgH: CANVAS_H,
    hotspots: ROKET_HOTSPOTS,
    walkable: ROKET_WALKABLE,
    defaultPosition: ROKET_DEFAULT_POSITION,
    notifPosition: ROKET_NOTIF_POSITION,
    forKind: ["daffa"],
  };
}

export const BUILTIN_THEMES: Record<string, RoomTheme> = {
  roket: roketTheme(),
  minecraft: builtinTheme("minecraft", "Minecraft", ["daffa"]),
  tayo: builtinTheme("tayo", "Tayo", ["dio"]),
};

export function getDefaultThemeKey(kind: "daffa" | "dio"): string {
  return kind === "daffa" ? "roket" : "tayo";
}

export function getThemesForKind(kind: "daffa" | "dio"): RoomTheme[] {
  return Object.values(BUILTIN_THEMES).filter((t) => t.forKind.includes(kind));
}

/** Derive jenis dunia anak (daffa/dio) dari nama/usia profil. */
export function deriveKind(name: string, age: number | null): "daffa" | "dio" {
  const n = name.toLowerCase();
  if (n.includes("dio")) return "dio";
  if (n.includes("daffa")) return "daffa";
  if (age != null && age <= 3) return "dio";
  return "daffa";
}
