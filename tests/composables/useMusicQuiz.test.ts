import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: mockSendCommand,
  },
}));

import {
  answerMusicQuiz,
  createMusicQuiz,
  getAvailableMusicQuizTypes,
  heartbeatMusicQuiz,
  isMusicQuizProviderEvent,
  isSupportedMusicQuiz,
  parseMusicQuizAnswerType,
  parseMusicQuizType,
  resetMusicQuiz,
  submitMusicQuizAnswer,
  type MusicQuizProviderEvent,
  type MusicQuizPublicState,
} from "@/composables/useMusicQuiz";

function unsupportedQuizType(value: string) {
  const quizType = parseMusicQuizType(value);
  if (
    quizType === "guess_the_song" ||
    quizType === "music_timeline" ||
    quizType === "trivia"
  ) {
    throw new Error("Expected an unsupported quiz type");
  }
  return quizType;
}

function unsupportedAnswerType(value: string) {
  const answerType = parseMusicQuizAnswerType(value);
  if (answerType === "multiple_choice" || answerType === "timeline") {
    throw new Error("Expected an unsupported answer type");
  }
  return answerType;
}

describe("useMusicQuiz commands", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSendCommand.mockResolvedValue(undefined);
  });

  it("sends difficulty in the create payload", async () => {
    await createMusicQuiz({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      config: {
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "hard",
        source_uris: ["library://track/1"],
        name: "Test Quiz",
      },
    });

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/create", {
      quiz_type: "guess_the_song",
      round_count: 5,
      suggestion_count: 4,
      answer_duration: 30,
      difficulty: "hard",
      source_uris: ["library://track/1"],
      name: "Test Quiz",
    });
  });

  it("discovers currently available game types", async () => {
    mockSendCommand.mockResolvedValue([
      "guess_the_song",
      "music_timeline",
      "trivia",
    ]);

    await expect(getAvailableMusicQuizTypes()).resolves.toEqual([
      "guess_the_song",
      "music_timeline",
      "trivia",
    ]);
    expect(mockSendCommand).toHaveBeenCalledWith(
      "music_quiz/available_quiz_types",
    );
  });

  it("opts into replay auto-start explicitly", async () => {
    await resetMusicQuiz(true);

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/reset", {
      auto_start: true,
    });
  });

  it("keeps manual reset backward compatible by default", async () => {
    await resetMusicQuiz();
    await resetMusicQuiz(false);

    expect(mockSendCommand).toHaveBeenNthCalledWith(1, "music_quiz/reset");
    expect(mockSendCommand).toHaveBeenNthCalledWith(2, "music_quiz/reset");
  });

  it("parses the Music Timeline game and generic timeline answer types", () => {
    expect(parseMusicQuizType("music_timeline")).toBe("music_timeline");
    expect(parseMusicQuizAnswerType("timeline")).toBe("timeline");
  });

  it("sends the complete Trivia create payload", async () => {
    await createMusicQuiz({
      quiz_type: "trivia",
      answer_type: "multiple_choice",
      config: {
        language: "sr-Latn",
        round_count: 8,
        suggestion_count: 6,
        answer_duration: 45,
        difficulty: "hard",
        source_uris: ["library://playlist/1", "library://genre/rock"],
        name: "Friday Trivia",
      },
    });

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/create", {
      quiz_type: "trivia",
      language: "sr-Latn",
      round_count: 8,
      suggestion_count: 6,
      answer_duration: 45,
      difficulty: "hard",
      source_uris: ["library://playlist/1", "library://genre/rock"],
      name: "Friday Trivia",
    });
  });

  it("keeps the legacy multiple-choice answer payload", async () => {
    await answerMusicQuiz("player-id", "suggestion-id");

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/answer", {
      player_id: "player-id",
      suggestion_id: "suggestion-id",
    });
  });

  it("sends a flat Music Timeline create payload without answer-only fields", async () => {
    await createMusicQuiz({
      quiz_type: "music_timeline",
      answer_type: "timeline",
      config: {
        round_count: 10,
        answer_duration: 45,
        source_uris: ["library://playlist/1"],
        name: "Friday Music Timeline",
        artist_bonus_mode: "free_text",
        title_bonus_mode: "multiple_choice",
      },
    });

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/create", {
      quiz_type: "music_timeline",
      round_count: 10,
      answer_duration: 45,
      source_uris: ["library://playlist/1"],
      name: "Friday Music Timeline",
      artist_bonus_mode: "free_text",
      title_bonus_mode: "multiple_choice",
    });
  });

  it("sends strict timeline submissions through the generic command", async () => {
    const submission = {
      answer_type: "timeline",
      action: "place",
      previous_entry_id: "older",
      next_entry_id: "newer",
    } as const;

    await submitMusicQuizAnswer("player-id", submission);

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/submit_answer", {
      player_id: "player-id",
      submission,
    });
  });

  it.each([
    {
      answer_type: "timeline",
      action: "bonus_text",
      bonus_type: "artist",
      value: "Massive Attack",
    },
    {
      answer_type: "timeline",
      action: "bonus_choice",
      bonus_type: "title",
      option_id: "option-2",
    },
    {
      answer_type: "timeline",
      action: "finish",
    },
  ] as const)(
    "preserves the exact $action submission keys",
    async (submission) => {
      await submitMusicQuizAnswer("player-id", submission);

      expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/submit_answer", {
        player_id: "player-id",
        submission,
      });
    },
  );

  it("sends a typed player heartbeat", async () => {
    mockSendCommand.mockResolvedValue(true);

    await expect(heartbeatMusicQuiz("player-id")).resolves.toBe(true);
    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/heartbeat", {
      player_id: "player-id",
    });
  });

  it("only narrows the supported quiz and answer pair", () => {
    const known = {
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Quiz",
      round_count: 5,
      suggestion_count: 4,
      answer_duration: 30,
      mode: "venue",
      players: [],
    } satisfies MusicQuizPublicState;
    const unsupported = {
      quiz_type: unsupportedQuizType("future_game"),
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Future Quiz",
    } satisfies MusicQuizPublicState;
    const unsupportedAnswer = {
      quiz_type: "guess_the_song",
      answer_type: unsupportedAnswerType("future_answer"),
      phase: "lobby",
      name: "Future Quiz",
    } satisfies MusicQuizPublicState;
    const musicTimeline = {
      quiz_type: "music_timeline",
      answer_type: "timeline",
      phase: "lobby",
      name: null,
      round_count: 5,
      answer_duration: 30,
      artist_bonus_mode: "off",
      title_bonus_mode: "off",
      mode: "remote",
      players: [],
      current_round: null,
    } satisfies MusicQuizPublicState;
    const trivia = {
      quiz_type: "trivia",
      answer_type: "multiple_choice",
      language: "pt-BR",
      phase: "lobby",
      name: "Trivia",
      round_count: 5,
      suggestion_count: 4,
      answer_duration: 30,
      mode: "venue",
      players: [],
      current_round: null,
    } satisfies MusicQuizPublicState;
    const mismatched = {
      quiz_type: "guess_the_song",
      answer_type: "timeline",
      phase: "lobby",
      name: "Mismatched Quiz",
    } satisfies MusicQuizPublicState;

    expect(isSupportedMusicQuiz(known)).toBe(true);
    expect(isSupportedMusicQuiz(musicTimeline)).toBe(true);
    expect(isSupportedMusicQuiz(trivia)).toBe(true);
    expect(trivia.language).toBe("pt-BR");
    expect(isSupportedMusicQuiz(unsupported)).toBe(false);
    expect(isSupportedMusicQuiz(unsupportedAnswer)).toBe(false);
    expect(isSupportedMusicQuiz(mismatched)).toBe(false);
  });

  it("preserves nullable server fields in supported state", () => {
    const state = {
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "reveal",
      name: null,
      auto_start_at: null,
      round_count: 1,
      suggestion_count: 2,
      answer_duration: 30,
      mode: "venue",
      players: [],
      current_round: {
        question: null,
        round_index: 0,
        started_at: 1,
        deadline: 2,
        auto_advance_at: null,
        suggestions: [],
        track_uri: null,
      },
    } satisfies MusicQuizPublicState;

    expect(isSupportedMusicQuiz(state)).toBe(true);
    expect(state.name).toBeNull();
    expect(state.current_round.question).toBeNull();
    expect(state.current_round.track_uri).toBeNull();
    expect(state.current_round.auto_advance_at).toBeNull();
    expect(state.auto_start_at).toBeNull();
  });

  it("accepts the nullable Music Timeline round start timestamp", () => {
    const state = {
      quiz_type: "music_timeline",
      answer_type: "timeline",
      phase: "answering",
      name: null,
      round_count: 1,
      answer_duration: 30,
      artist_bonus_mode: "off",
      title_bonus_mode: "off",
      mode: "venue",
      players: [],
      current_round: {
        round_index: 0,
        started_at: null,
        deadline: 30,
        auto_advance_at: null,
        question: null,
        timeline: [],
        bonus_definitions: [],
      },
    } satisfies MusicQuizPublicState;

    expect(isSupportedMusicQuiz(state)).toBe(true);
    expect(state.current_round.started_at).toBeNull();
  });

  it("accepts public provider events as invalidation payloads", () => {
    const event = {
      event: "game_updated",
      state: {
        quiz_type: unsupportedQuizType("future_game"),
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Future Quiz",
      },
    } satisfies MusicQuizProviderEvent;

    expect(isMusicQuizProviderEvent(event)).toBe(true);
    expect(isMusicQuizProviderEvent({ event: "game_updated" })).toBe(false);
    expect(
      isMusicQuizProviderEvent({ event: "game_updated", state: null }),
    ).toBe(false);
    expect(
      isMusicQuizProviderEvent({
        event: "game_removed",
        state: event.state,
      }),
    ).toBe(false);
    expect(isMusicQuizProviderEvent({ event: "other" })).toBe(false);
  });
});
