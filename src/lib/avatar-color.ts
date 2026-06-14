const FALLBACK_COLORS = ["#FF6B35", "#4CAF50", "#7C3AED", "#2196F3", "#FF6B9D", "#FFD93D"];

const NAME_COLOR_OVERRIDES: Record<string, string> = {
  Daffa: "#FF6B35",
};

export function colorForName(name: string): string {
  if (NAME_COLOR_OVERRIDES[name]) {
    return NAME_COLOR_OVERRIDES[name];
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
