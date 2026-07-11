import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDeleteMusicQuiz,
  mockGetMusicQuiz,
  mockSubscribe,
  providerHandlers,
} = vi.hoisted(() => ({
  mockDeleteMusicQuiz: vi.fn(),
  mockGetMusicQuiz: vi.fn(),
  mockSubscribe: vi.fn(),
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
  getMusicQuiz: mockGetMusicQuiz,
  createMusicQuiz: vi.fn(),
  startMusicQuiz: vi.fn(),
  revealMusicQuiz: vi.fn(),
  nextMusicQuiz: vi.fn(),
  resetMusicQuiz: vi.fn(),
  deleteMusicQuiz: mockDeleteMusicQuiz,
  isSupportedMusicQuiz: (value: { quiz_type?: string; answer_type?: string }) =>
    (value.quiz_type === "guess_the_song" &&
      value.answer_type === "multiple_choice") ||
    (value.quiz_type === "hitster" && value.answer_type === "timeline"),
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

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

import { EventType } from "@/plugins/api/interfaces";
import { useMusicQuizHost } from "@/composables/useMusicQuizHost";

const HOST_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [],
  created_at: 1,
  sources: [],
  join_url: "http://join",
  rounds: [],
  current_round: null,
} as const;

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMusicQuizHost", () => {
  beforeEach(() => {
    providerHandlers.length = 0;
    mockDeleteMusicQuiz.mockReset();
    mockGetMusicQuiz.mockReset();
    mockSubscribe.mockReset();
    mockDeleteMusicQuiz.mockResolvedValue(undefined);
    mockGetMusicQuiz.mockResolvedValue({ ...HOST_STATE });
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

  it("scopes provider updates to a single provider instance", async () => {
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();
    expect(mockGetMusicQuiz).toHaveBeenCalledTimes(1);

    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: HOST_STATE },
    });
    await flushPromises();
    expect(mockGetMusicQuiz).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: { event: "game_updated", state: HOST_STATE },
    });
    await flushPromises();
    expect(mockGetMusicQuiz).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: { event: "game_removed" },
    });
    expect(host.state.value).not.toBeNull();

    handler({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    expect(host.state.value).toBeNull();
  });

  it("treats a null response as setup state without a toast", async () => {
    mockGetMusicQuiz.mockResolvedValue(null);
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(host.state.value).toBeNull();
  });

  it("treats a no-active-game string as an empty state without a toast", async () => {
    mockGetMusicQuiz.mockRejectedValue("There is no active Music Quiz game");
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(host.state.value).toBeNull();
  });

  it("keeps the setup state when a stale update finishes after game removal", async () => {
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    let resolveUpdate: (state: typeof HOST_STATE) => void = () => {};
    mockGetMusicQuiz.mockReturnValueOnce(
      new Promise<typeof HOST_STATE>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const handler = providerHandlers[0];
    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: HOST_STATE },
    });
    handler({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    resolveUpdate(HOST_STATE);
    await flushPromises();

    expect(host.state.value).toBeNull();
    expect(host.loading.value).toBe(false);
  });

  it("returns to setup when the delete event arrives before the command completes", async () => {
    let resolveDelete: () => void = () => {};
    mockDeleteMusicQuiz.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    const deleting = host.deleteGame();
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });

    expect(host.state.value).toBeNull();
    expect("gameRemoved" in host).toBe(false);

    resolveDelete();
    await expect(deleting).resolves.toBe(true);
    expect(host.state.value).toBeNull();
  });

  it("treats a no-active-game Error as an empty state without a toast", async () => {
    mockGetMusicQuiz.mockRejectedValue(
      new Error("There is no active Music Quiz game"),
    );
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(host.state.value).toBeNull();
  });

  it("notifies when loading fails for another reason", async () => {
    mockGetMusicQuiz.mockRejectedValue(new Error("Server unavailable"));
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).toHaveBeenCalledOnce();
    expect(notifyError).toHaveBeenCalledWith("Server unavailable");
    expect(host.state.value).toBeNull();
  });

  it("does not expose guess-the-song state for an unknown game type", async () => {
    mockGetMusicQuiz.mockResolvedValue({
      quiz_type: "future_game",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Future Quiz",
    });

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.state.value?.quiz_type).toBe("future_game");
    expect(host.currentRound.value).toBeNull();
    expect(host.joinLink.value).toBe("");
    expect(host.isLastRound.value).toBe(false);
  });

  it("does not expose gameplay for an unknown answer type", async () => {
    mockGetMusicQuiz.mockResolvedValue({
      quiz_type: "guess_the_song",
      answer_type: "future_answer",
      phase: "lobby",
      name: "Future Quiz",
    });

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.state.value?.answer_type).toBe("future_answer");
    expect(host.currentRound.value).toBeNull();
    expect(host.joinLink.value).toBe("");
  });

  it("exposes the supported Hitster round and join link", async () => {
    const timelineRound = {
      round_index: 0,
      started_at: 1,
      deadline: 31,
      question: null,
      timeline: [],
      bonus_definitions: [],
    };
    mockGetMusicQuiz.mockResolvedValue({
      quiz_type: "hitster",
      answer_type: "timeline",
      phase: "answering",
      name: "Timeline Quiz",
      round_count: 5,
      answer_duration: 30,
      artist_bonus_mode: "off",
      title_bonus_mode: "off",
      mode: "venue",
      players: [],
      current_round: timelineRound,
      created_at: 1,
      sources: [],
      join_url: "http://timeline-join",
      rounds: [],
    });

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.currentRound.value).toEqual(timelineRound);
    expect(host.joinLink.value).toBe("http://timeline-join");
    expect(host.isLastRound.value).toBe(false);
  });
});
