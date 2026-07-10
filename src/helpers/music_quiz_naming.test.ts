import { describe, it, expect } from "vitest";
import {
  generateMusicQuizSessionName,
  MUSIC_QUIZ_NAME_ADJECTIVES,
  MUSIC_QUIZ_NAME_NOUNS,
} from "./music_quiz_naming";

describe("generateMusicQuizSessionName", () => {
  it("combines a known adjective and noun with the given time", () => {
    const name = generateMusicQuizSessionName(new Date("2024-01-01T21:45:00"));
    const [adjective, noun, ...rest] = name.split(" ");
    expect(MUSIC_QUIZ_NAME_ADJECTIVES).toContain(adjective as never);
    expect(MUSIC_QUIZ_NAME_NOUNS).toContain(noun as never);
    expect(rest.join(" ")).toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it("produces a fresh name on each call", () => {
    const names = new Set(
      Array.from({ length: 20 }, () => generateMusicQuizSessionName()),
    );
    // Randomized, so at least a couple of distinct names are expected.
    expect(names.size).toBeGreaterThan(1);
  });
});
