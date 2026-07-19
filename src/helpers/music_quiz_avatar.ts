export interface MusicQuizAvatarStyle {
  background: string;
  color: string;
}

/**
 * Initials for a player avatar: up to two uppercased letters derived from the
 * name. Multi-word names use the first letter of the first and last word; a
 * single word uses its first two letters. Falls back to "?" for blank names.
 */
export function getMusicQuizAvatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [firstLetter(words[0]), firstLetter(words[words.length - 1])];
  return letters.join("").toLocaleUpperCase();
}

/**
 * Hue (0–359) deterministically derived from the name, so a given player always
 * gets the same avatar color.
 */
export function getMusicQuizAvatarHue(name: string): number {
  let hash = 0;
  for (const char of name.trim()) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }
  return hash;
}

/**
 * Avatar background/foreground for a player. Fixed saturation and lightness keep
 * text legible against the generated color in both light and dark themes.
 */
export function getMusicQuizAvatarStyle(name: string): MusicQuizAvatarStyle {
  return {
    background: `hsl(${getMusicQuizAvatarHue(name)} 60% 45%)`,
    color: "hsl(0 0% 100%)",
  };
}

function firstLetter(word: string): string {
  return Array.from(word)[0] ?? "";
}
