import type {
  MusicQuizGuessTheSongPublicState,
  MusicQuizTimelinePublicState,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizRoundScore,
  getMusicQuizRoundScoreLabel,
} from "@/helpers/music_quiz";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

describe("Music Quiz round score labels", () => {
  it("adds timeline placement and bonus points", () => {
    const currentRound = {
      round_index: 0,
      started_at: 1,
      deadline: 31,
      auto_advance_at: null,
      ended_at: 20,
      question: null,
      timeline: [],
      bonus_definitions: [],
    };
    const state = {
      quiz_type: "music_timeline",
      answer_type: "timeline",
      phase: "reveal",
      name: "Music Timeline",
      round_count: 1,
      answer_duration: 30,
      artist_bonus_mode: "free_text",
      title_bonus_mode: "multiple_choice",
      mode: "venue",
      players: [
        {
          name: "Player",
          score: 1250,
          ready: false,
          answered: true,
          active_from_round: 0,
          placed: true,
          artist_bonus_answered: true,
          title_bonus_answered: true,
          last_answer: {
            placement: {
              previous_entry_id: null,
              next_entry_id: null,
              correct: true,
              points: 1000,
            },
            artist: { correct: true, points: 250 },
            title: { correct: false, points: 0 },
          },
        },
      ],
      current_round: currentRound,
    } satisfies MusicQuizTimelinePublicState;

    expect(getMusicQuizRoundScore(state, "Player")).toBe(1250);
    expect(getMusicQuizRoundScoreLabel(state, "Player")).toBe("(+1250)");
  });

  it("preserves Guess the Song point labels", () => {
    const state = {
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "reveal",
      name: "Quiz",
      round_count: 1,
      suggestion_count: 2,
      answer_duration: 30,
      mode: "venue",
      players: [
        {
          name: "Player",
          score: 1000,
          ready: false,
          answered: true,
          active_from_round: 0,
          last_answer: {
            suggestion_id: "correct",
            correct: true,
            points: 1000,
          },
        },
      ],
      current_round: {
        round_index: 0,
        started_at: 1,
        deadline: 31,
        auto_advance_at: null,
        question: null,
        suggestions: [],
        correct_suggestion_id: "correct",
      },
    } satisfies MusicQuizGuessTheSongPublicState;

    expect(getMusicQuizRoundScore(state, "Player")).toBe(1000);
    expect(getMusicQuizRoundScoreLabel(state, "Player")).toBe("(+1000)");
  });
});
