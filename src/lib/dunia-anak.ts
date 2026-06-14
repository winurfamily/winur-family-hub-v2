import "server-only";

/** XP dibutuhkan untuk naik dari `level` ke `level + 1`. Formula: round(20 * 1.4^(level-1)) */
export function xpForLevel(level: number): number {
  return Math.round(20 * Math.pow(1.4, level - 1));
}

export interface XpResult {
  level: number;
  xp: number;
  xpNextLevel: number;
  leveledUp: boolean;
}

/** Tambahkan XP ke profil, naikkan level berkali-kali jika perlu (unlimited, no prestige). */
export function applyXpGain(level: number, xp: number, gainedXp: number): XpResult {
  let newLevel = level;
  let newXp = xp + gainedXp;
  let xpNeeded = xpForLevel(newLevel);
  let leveledUp = false;

  while (newXp >= xpNeeded) {
    newXp -= xpNeeded;
    newLevel += 1;
    leveledUp = true;
    xpNeeded = xpForLevel(newLevel);
  }

  return { level: newLevel, xp: newXp, xpNextLevel: xpNeeded, leveledUp };
}

/** Senin sebagai awal minggu untuk tanggal yang diberikan ("YYYY-MM-DD"). */
export function getWeekRange(dateStr: string): { weekStart: string; weekEnd: string } {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay(); // 0=Minggu, 1=Senin, ... 6=Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: toISO(monday), weekEnd: toISO(sunday) };
}

export function isSunday(dateStr: string): boolean {
  return new Date(`${dateStr}T00:00:00`).getDay() === 0;
}
