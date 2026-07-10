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
  heartbeatMusicQuiz,
  isMusicQuizProviderEvent,
  isSupportedMusicQuiz,
  parseMusicQuizAnswerType,
  parseMusicQuizType,
  type MusicQuizProviderEvent,
  type MusicQuizPublicState,
} from "@/composables/useMusicQuiz";

function unsupportedQuizType(value: string) {
  const quizType = parseMusicQuizType(value);
  if (quizType === "guess_the_song") {
    throw new Error("Expected an unsupported quiz type");
  }
  return quizType;
}

function unsupportedAnswerType(value: string) {
  const answerType = parseMusicQuizAnswerType(value);
  if (answerType === "multiple_choice") {
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

  it("keeps the legacy multiple-choice answer payload", async () => {
    await answerMusicQuiz("player-id", "suggestion-id");

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/answer", {
      player_id: "player-id",
      suggestion_id: "suggestion-id",
    });
  });

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
      answer_type: unsupportedAnswerType("timeline"),
      phase: "lobby",
      name: "Future Quiz",
    } satisfies MusicQuizPublicState;

    expect(isSupportedMusicQuiz(known)).toBe(true);
    expect(isSupportedMusicQuiz(unsupported)).toBe(false);
    expect(isSupportedMusicQuiz(unsupportedAnswer)).toBe(false);
  });

  it("preserves nullable server fields in supported state", () => {
    const state = {
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "reveal",
      name: null,
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
        suggestions: [],
        track_uri: null,
      },
    } satisfies MusicQuizPublicState;

    expect(isSupportedMusicQuiz(state)).toBe(true);
    expect(state.name).toBeNull();
    expect(state.current_round.question).toBeNull();
    expect(state.current_round.track_uri).toBeNull();
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
