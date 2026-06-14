// Formula XP & Level — Docs/03_DATABASE_ERD.md
// xpNeeded(level) = round(20 * 1.4^(level-1))

export function xpNeeded(level: number): number {
  return Math.round(20 * Math.pow(1.4, level - 1));
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpNextLevel: number;
  leveledUp: boolean;
  levelsGained: number;
}

/**
 * Tambahkan XP ke profile dan hitung naik level (bisa naik >1 level sekaligus).
 */
export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  xpGain: number
): LevelProgress {
  let level = currentLevel;
  let xp = currentXp + xpGain;
  let xpNextLevel = xpNeeded(level);
  let levelsGained = 0;

  while (xp >= xpNextLevel) {
    xp -= xpNextLevel;
    level += 1;
    levelsGained += 1;
    xpNextLevel = xpNeeded(level);
  }

  return {
    level,
    xp,
    xpNextLevel,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
}
