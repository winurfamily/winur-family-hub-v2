/**
 * Collision/auto-nudge dalam ruang persen (tanpa DOM measurement) —
 * port dari rectOverlap/clearHotspots/placeSafe di Docs/ROOM_DAFFA_FINAL.html.
 */
import type { Position, RoomTheme } from "./theme-config";

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Footprint {
  w: number;
  h: number;
}

/** Perkiraan ukuran render avatar/pet/celengan, dipakai hanya untuk cek overlap hotspot. */
export const FOOTPRINT: Record<"avatar" | "pet" | "piggy", Footprint> = {
  avatar: { w: 10.5, h: 14 },
  pet: { w: 6.5, h: 8 },
  piggy: { w: 12, h: 9 },
};

export function rectOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return !(a.right < b.left - pad || a.left > b.right + pad || a.bottom < b.top - pad || a.top > b.bottom + pad);
}

function hotspotRect(h: { left: number; top: number; width: number; height: number }): Rect {
  return { left: h.left, top: h.top, right: h.left + h.width, bottom: h.top + h.height };
}

function objectRect(pos: Position, fp: Footprint): Rect {
  return {
    left: pos.x - fp.w / 2,
    right: pos.x + fp.w / 2,
    top: 100 - pos.b - fp.h,
    bottom: 100 - pos.b,
  };
}

/** Geser objek menjauh dari hotspot yang tertutup, maks 14 iterasi. */
export function clearHotspots(pos: Position, fp: Footprint, theme: RoomTheme): Position {
  const wb = theme.walkable;
  let { x, b } = pos;
  const cx = (wb.xMin + wb.xMax) / 2;

  for (let i = 0; i < 14; i++) {
    const r = objectRect({ x, b }, fp);
    const hit = theme.hotspots.some((h) => rectOverlap(r, hotspotRect(h), 4));
    if (!hit) break;
    b = Math.max(wb.bMin, b - 3);
    x += x > cx ? -2.5 : 2.5;
    x = Math.max(wb.xMin, Math.min(wb.xMax, x));
  }

  return { x, b };
}

/** Clamp ke walkable area lalu jauhkan dari hotspot. */
export function placeSafe(x: number, b: number, fp: Footprint, theme: RoomTheme): Position {
  const wb = theme.walkable;
  return clearHotspots(
    {
      x: Math.max(wb.xMin, Math.min(wb.xMax, x)),
      b: Math.max(wb.bMin, Math.min(wb.bMax, b)),
    },
    fp,
    theme
  );
}
