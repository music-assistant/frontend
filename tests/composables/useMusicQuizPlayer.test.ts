import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMusicQuizInfo,
  mockGetMusicQuizState,
  mockJoinMusicQuiz,
  mockReadyMusicQuiz,
  mockAnswerMusicQuiz,
  mockSubscribe,
  mockStorePlayerId,
  mockGetStoredPlayerId,
  mockClearStoredPlayerId,
  mockGetMusicQuizErrorMessage,
  storedPlayerId,
  providerHandlers,
} = vi.hoisted(() => ({
  mockGetMusicQuizInfo: vi.fn(),
  mockGetMusicQuizState: vi.fn(),
  mockJoinMusicQuiz: vi.fn(),
  mockReadyMusicQuiz: vi.fn(),
  mockAnswerMusicQuiz: vi.fn(),
  mockSubscribe: vi.fn(),
  mockStorePlayerId: vi.fn(),
  mockGetStoredPlayerId: vi.fn(),
  mockClearStoredPlayerId: vi.fn(),
  mockGetMusicQuizErrorMessage: vi.fn(),
  storedPlayerId: { value: null as string | null },
  providerHandlers: [] as Array<
    (event: { object_id?: string; data?: unknown }) => void
  >,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: () => {},
  };
});

vi.mock("@/composables/useMusicQuiz", () => ({
  getMusicQuizInfo: mockGetMusicQuizInfo,
  getMusicQuizState: mockGetMusicQuizState,
  joinMusicQuiz: mockJoinMusicQuiz,
  readyMusicQuiz: mockReadyMusicQuiz,
  answerMusicQuiz: mockAnswerMusicQuiz,
  isSupportedMusicQuiz: (value: { quiz_type?: string; answer_type?: string }) =>
    value.quiz_type === "guess_the_song" &&
    value.answer_type === "multiple_choice",
  isMusicQuizProviderEvent: (value: unknown) => {
    if (!value || typeof value !== "object" || !("event" in value))
      return false;
    return (
      value.event === "game_removed" ||
      (value.event === "game_updated" && "state" in value)
    );
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/helpers/music_quiz", () => ({
  storeMusicQuizPlayerId: mockStorePlayerId,
  getStoredMusicQuizPlayerId: mockGetStoredPlayerId,
  clearStoredMusicQuizPlayerId: mockClearStoredPlayerId,
  getMusicQuizErrorMessage: mockGetMusicQuizErrorMessage,
  isNoActiveGameError: (err: unknown) => {
    const message = (
      err instanceof Error ? err.message : typeof err === "string" ? err : ""
    ).toLowerCase();
    return (
      message.includes("no active game") ||
      message.includes("no active music quiz game") ||
      (message.includes("no active") && message.includes("music quiz"))
    );
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

import { EventType } from "@/plugins/api/interfaces";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";

const QUIZ_INFO = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  name: "Quiz",
  phase: "lobby",
  player_count: 2,
  round_count: 5,
  mode: "venue",
} as const;

const PLAYER_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: null,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} as const;

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMusicQuizPlayer", () => {
  beforeEach(() => {
    storedPlayerId.value = null;
    providerHandlers.length = 0;
    mockGetMusicQuizInfo.mockReset();
    mockGetMusicQuizState.mockReset();
    mockJoinMusicQuiz.mockReset();
    mockReadyMusicQuiz.mockReset();
    mockAnswerMusicQuiz.mockReset();
    mockSubscribe.mockReset();
    mockStorePlayerId.mockReset();
    mockGetStoredPlayerId.mockReset();
    mockClearStoredPlayerId.mockReset();
    mockGetMusicQuizErrorMessage.mockReset();
    mockGetStoredPlayerId.mockImplementation(() => storedPlayerId.value);
    mockStorePlayerId.mockImplementation((playerId: string) => {
      storedPlayerId.value = playerId;
    });
    mockClearStoredPlayerId.mockImplementation(() => {
      storedPlayerId.value = null;
    });
    mockGetMusicQuizErrorMessage.mockImplementation(
      (error: unknown, fallback = "") =>
        error instanceof Error ? error.message : fallback,
    );
    mockSubscribe.mockImplementation(
      (
        _event: EventType,
        handler: (event: { object_id?: string; data?: unknown }) => void,
      ) => {
        providerHandlers.push(handler);
        return () => {};
      },
    );
  });

  it("recovers from a stale player token by returning to the join/info state", async () => {
    storedPlayerId.value = "stale-player";
    mockGetMusicQuizState.mockRejectedValue(new Error("player not found"));
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(player.gameRemoved.value).toBe(false);
    expect(storedPlayerId.value).toBeNull();
  });

  it("recovers from a no-active-game error (string rejection) without a toast", async () => {
    storedPlayerId.value = "some-player";
    mockGetMusicQuizState.mockRejectedValue(
      "There is no active Music Quiz game",
    );
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(storedPlayerId.value).toBeNull();
  });

  it("returns from game-removed state when a new game update arrives", async () => {
    mockGetMusicQuizInfo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(QUIZ_INFO);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.gameRemoved.value).toBe(true);

    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");
    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: QUIZ_INFO },
    });
    await flushPromises();

    expect(player.gameRemoved.value).toBe(false);
    expect(player.info.value).toEqual(QUIZ_INFO);
  });

  it("only handles provider events from the active quiz instance", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(mockGetMusicQuizInfo).toHaveBeenCalledTimes(1);

    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: QUIZ_INFO },
    });
    await flushPromises();
    expect(mockGetMusicQuizInfo).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: { event: "game_updated", state: QUIZ_INFO },
    });
    await flushPromises();
    expect(mockGetMusicQuizInfo).toHaveBeenCalledTimes(2);
  });

  it("keeps game identity across info, join, and provider refresh", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "player-id",
      state: PLAYER_STATE,
    });
    mockGetMusicQuizState.mockResolvedValue({
      ...PLAYER_STATE,
      phase: "answering",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(player.info.value?.quiz_type).toBe("guess_the_song");
    expect(player.info.value?.answer_type).toBe("multiple_choice");

    await player.join("Player");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PLAYER_STATE },
    });
    await flushPromises();

    expect(mockGetMusicQuizState).toHaveBeenCalledWith("player-id");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");
    expect(player.state.value?.phase).toBe("answering");
  });

  it("preserves game identity when reconnecting with a stored player", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.playerId.value).toBe("stored-player");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");
  });

  it("submits a discriminated answer through the legacy command", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const answeredState = {
      ...PLAYER_STATE,
      phase: "answering",
      you: {
        ...PLAYER_STATE.you,
        answer: {
          suggestion_id: "suggestion-1",
          answered_at: 10,
        },
      },
    } as const;
    mockAnswerMusicQuiz.mockResolvedValue(answeredState);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    await player.submitAnswer({
      answer_type: "multiple_choice",
      suggestion_id: "suggestion-1",
    });

    expect(mockAnswerMusicQuiz).toHaveBeenCalledWith(
      "stored-player",
      "suggestion-1",
    );
    expect(player.state.value).toEqual(answeredState);
  });

  it("does not expose guess-the-song fields for an unknown game type", async () => {
    mockGetMusicQuizInfo.mockResolvedValue({
      quiz_type: "future_game",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Future Quiz",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.info.value?.quiz_type).toBe("future_game");
    expect(player.currentRound.value).toBeNull();
    expect(player.players.value).toEqual([]);
    expect(player.yourName.value).toBe("");
  });

  it("does not expose gameplay for an unknown answer type", async () => {
    mockGetMusicQuizInfo.mockResolvedValue({
      quiz_type: "guess_the_song",
      answer_type: "timeline",
      phase: "lobby",
      name: "Future Quiz",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.info.value?.answer_type).toBe("timeline");
    expect(player.currentRound.value).toBeNull();
    expect(player.players.value).toEqual([]);
  });
});
