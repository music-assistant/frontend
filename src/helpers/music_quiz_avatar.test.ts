import { describe, it, expect } from "vitest";
import {
  getMusicQuizAvatarHue,
  getMusicQuizAvatarInitials,
  getMusicQuizAvatarStyle,
} from "./music_quiz_avatar";

describe("getMusicQuizAvatarInitials", () => {
  it("uses the first letter of the first and last word", () => {
    expect(getMusicQuizAvatarInitials("Marcel van der Veldt")).toBe("MV");
    expect(getMusicQuizAvatarInitials("Ada Lovelace")).toBe("AL");
  });

  it("uses the first two letters of a single word", () => {
    expect(getMusicQuizAvatarInitials("Alice")).toBe("AL");
    expect(getMusicQuizAvatarInitials("Bo")).toBe("BO");
    expect(getMusicQuizAvatarInitials("X")).toBe("X");
  });

  it("trims and collapses surrounding whitespace", () => {
    expect(getMusicQuizAvatarInitials("  Jane   Doe  ")).toBe("JD");
  });

  it("falls back to '?' for a blank name", () => {
    expect(getMusicQuizAvatarInitials("")).toBe("?");
    expect(getMusicQuizAvatarInitials("   ")).toBe("?");
  });

  it("handles multi-byte characters without splitting them", () => {
    expect(getMusicQuizAvatarInitials("🎧")).toBe("🎧");
  });
});

describe("getMusicQuizAvatarHue", () => {
  it("is deterministic for the same name", () => {
    expect(getMusicQuizAvatarHue("Alice")).toBe(getMusicQuizAvatarHue("Alice"));
  });

  it("stays within the 0–359 range", () => {
    for (const name of ["Alice", "Bob", "Charlie", "🎧", "a very long name"]) {
      const hue = getMusicQuizAvatarHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe("getMusicQuizAvatarStyle", () => {
  it("returns an hsl background derived from the hue and white text", () => {
    const style = getMusicQuizAvatarStyle("Alice");
    expect(style.background).toBe(
      `hsl(${getMusicQuizAvatarHue("Alice")} 60% 45%)`,
    );
    expect(style.color).toBe("hsl(0 0% 100%)");
  });
});
