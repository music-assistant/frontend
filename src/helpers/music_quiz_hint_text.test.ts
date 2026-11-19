import { describe, expect, it } from "vitest";
import type { MusicQuizHintTextPlayer } from "@/composables/music-quiz/useMusicQuiz";
import {
  countHiddenHintLetters,
  getHintTextSolvers,
  splitHintTextMask,
} from "./music_quiz_hint_text";

describe("splitHintTextMask", () => {
  it("splits on spaces and keeps punctuation inside its word", () => {
    expect(splitHintTextMask(["D", null, "'", null, " ", null, "!"])).toEqual([
      [
        { character: "D", hidden: false },
        { character: null, hidden: true },
        { character: "'", hidden: false },
        { character: null, hidden: true },
      ],
      [
        { character: null, hidden: true },
        { character: "!", hidden: false },
      ],
    ]);
  });

  it("ignores repeated and surrounding spaces", () => {
    expect(splitHintTextMask([" ", null, " ", " ", null, " "])).toEqual([
      [{ character: null, hidden: true }],
      [{ character: null, hidden: true }],
    ]);
  });
});

describe("countHiddenHintLetters", () => {
  it("counts only hidden letters", () => {
    expect(countHiddenHintLetters(["H", null, null, " ", "-", null])).toBe(3);
  });
});

describe("getHintTextSolvers", () => {
  function player(
    name: string,
    solvedRank: number | null,
  ): MusicQuizHintTextPlayer {
    return {
      name,
      score: 0,
      ready: false,
      answered: solvedRank !== null,
      active_from_round: 0,
      solved_rank: solvedRank,
    };
  }

  it("returns solvers ordered by their rank", () => {
    const solvers = getHintTextSolvers([
      player("Bob", 2),
      player("Carol", null),
      player("Alice", 1),
    ]);

    expect(solvers.map((item) => item.name)).toEqual(["Alice", "Bob"]);
  });
});
