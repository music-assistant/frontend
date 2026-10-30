import { i18n } from "@/plugins/i18n";
import { describe, expect, it } from "vitest";
import {
  formatAnswerSeconds,
  getGameAwards,
  getPersonalStats,
  getPublicRoundFastest,
  getRoundFastest,
  getRoundResultCount,
  matchCorrectAnswerNames,
  type MusicQuizStatsRound,
} from "./music_quiz_stats";

function round(
  index: number,
  answers: Array<
    [id: string, seconds: number, correct: boolean, points: number]
  >,
  started = 100,
): MusicQuizStatsRound {
  return {
    round_index: index,
    started_at: started,
    answers: Object.fromEntries(
      answers.map(([id, seconds, correct, points]) => [
        id,
        {
          player_id: id,
          answered_at: started + seconds,
          is_correct: correct,
          points,
        },
      ]),
    ),
  };
}

const NAMES = { a: "Alex", b: "Sam", c: "Kim" };

describe("matchCorrectAnswerNames", () => {
  it("ties correct answers to names through their points", () => {
    const current = round(0, [
      ["a", 2, true, 1000],
      ["b", 5, true, 500],
      ["c", 3, false, 0],
    ]);
    const players = [
      { name: "Alex", last_answer: { correct: true, points: 1000 } },
      { name: "Sam", last_answer: { correct: true, points: 500 } },
      { name: "Kim", last_answer: { correct: false, points: 0 } },
    ];
    expect(matchCorrectAnswerNames(current, players)).toEqual({
      a: "Alex",
      b: "Sam",
    });
  });

  it("skips points shared by two players", () => {
    const current = round(0, [["a", 2, true, 1000]]);
    const players = [
      { name: "Alex", last_answer: { correct: true, points: 1000 } },
      { name: "Sam", last_answer: { correct: true, points: 1000 } },
    ];
    expect(matchCorrectAnswerNames(current, players)).toEqual({});
  });
});

describe("getRoundFastest", () => {
  it("returns the quickest correct answer", () => {
    const current = round(0, [
      ["c", 1, false, 0],
      ["b", 4.25, true, 500],
      ["a", 2.1, true, 1000],
    ]);
    const fastest = getRoundFastest(current, NAMES);
    expect(fastest?.name).toBe("Alex");
    expect(fastest?.seconds).toBeCloseTo(2.1);
  });

  it("returns null when nobody was right", () => {
    expect(getRoundFastest(round(0, [["a", 1, false, 0]]), NAMES)).toBeNull();
  });
});

describe("getPublicRoundFastest", () => {
  it("picks the correct player with the most points", () => {
    expect(
      getPublicRoundFastest([
        { name: "Sam", last_answer: { correct: true, points: 500 } },
        { name: "Alex", last_answer: { correct: true, points: 1000 } },
        { name: "Kim", last_answer: { correct: false, points: 0 } },
      ]),
    ).toEqual({ name: "Alex", seconds: null });
  });
});

describe("getGameAwards", () => {
  const rounds = [
    round(0, [
      ["a", 2, true, 1000],
      ["b", 9, true, 500],
    ]),
    round(1, [
      ["a", 3, true, 1000],
      ["b", 1.5, false, 0],
    ]),
    round(2, [
      ["a", 6, true, 500],
      ["b", 4, true, 1000],
    ]),
    { round_index: 3, started_at: null },
  ];

  it("hands out fastest, most correct, streak and closest call", () => {
    const awards = getGameAwards(rounds, NAMES, 10);
    expect(awards).toEqual([
      { kind: "fastest", names: ["Alex"], value: 2 },
      { kind: "most_correct", names: ["Alex"], value: 3 },
      { kind: "streak", names: ["Alex"], value: 3 },
      { kind: "closest_call", names: ["Sam"], value: 1 },
    ]);
  });

  it("lists every player who ties", () => {
    const tied = [
      round(0, [
        ["a", 2, true, 1000],
        ["b", 2, true, 500],
      ]),
    ];
    const awards = getGameAwards(tied, NAMES, 10);
    expect(awards[0]).toEqual({
      kind: "fastest",
      names: ["Alex", "Sam"],
      value: 2,
    });
    expect(awards.some((award) => award.kind === "streak")).toBe(false);
  });

  it("leaves out most correct and streak when a correct answer has no name", () => {
    const awards = getGameAwards(rounds, { a: "Alex" }, 10);
    // Sam's unnamed 9s answer had 1s to spare, closer than any of Alex's,
    // so closest call would name the wrong player and is left out too.
    expect(awards.map((award) => award.kind)).toEqual(["fastest"]);
  });

  it("leaves out fastest when an unnamed answer was quicker", () => {
    const quick = [
      round(0, [
        ["a", 3, true, 500],
        ["b", 1, true, 1000],
      ]),
    ];
    const awards = getGameAwards(quick, { a: "Alex" }, 10);
    expect(awards.some((award) => award.kind === "fastest")).toBe(false);
  });

  it("returns nothing before any round is played", () => {
    expect(getGameAwards([], NAMES, 10)).toEqual([]);
  });
});

describe("getPersonalStats", () => {
  it("counts correct rounds and the fastest correct answer", () => {
    expect(
      getPersonalStats([
        { round_index: 0, correct: true, seconds: 3.2 },
        { round_index: 1, correct: false, seconds: 1 },
        { round_index: 2, correct: true, seconds: 2.4 },
      ]),
    ).toEqual({ correct: 2, rounds: 3, fastestSeconds: 2.4 });
  });
});

describe("formatAnswerSeconds", () => {
  it("shows one decimal", () => {
    expect(formatAnswerSeconds(2.14)).toBe("2.1s");
  });

  // Saved languages can look like "en_GB", which Intl rejects; this crashed the
  // host's reveal screen.
  it("accepts a language saved with an underscore", () => {
    const saved = i18n.global.locale.value;
    i18n.global.locale.value = "en_GB";
    try {
      expect(formatAnswerSeconds(2.14)).toBe("2.1s");
    } finally {
      i18n.global.locale.value = saved;
    }
  });
});

describe("getRoundResultCount", () => {
  it("counts right answers among the round's players", () => {
    const players = [
      { name: "Ava", active_from_round: 0, last_answer: { correct: true } },
      { name: "Ben", active_from_round: 0, last_answer: { correct: false } },
      { name: "Cy", active_from_round: 0 },
      // Joined during round 2, so not part of it.
      { name: "Dee", active_from_round: 2, last_answer: { correct: true } },
    ];
    expect(getRoundResultCount(players, 1)).toEqual({ correct: 1, total: 3 });
  });

  it("reads a timeline answer's placement", () => {
    const players = [
      {
        name: "Ava",
        active_from_round: 0,
        last_answer: { placement: { correct: true, points: 100 } },
      },
      {
        name: "Ben",
        active_from_round: 0,
        last_answer: { placement: { correct: false, points: 0 } },
      },
    ];
    expect(getRoundResultCount(players, 0)).toEqual({ correct: 1, total: 2 });
  });
});
