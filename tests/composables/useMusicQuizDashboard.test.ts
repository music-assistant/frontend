import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMusicQuizPublicState, mockSubscribe, providerHandlers } =
  vi.hoisted(() => ({
    mockGetMusicQuizPublicState: vi.fn(),
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

vi.mock("@/composables/music-quiz/useMusicQuiz", () => ({
  getMusicQuizPublicState: mockGetMusicQuizPublicState,
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

vi.mock("@/plugins/api/helpers", () => ({
  waitForApiInitialization: () => Promise.resolve(),
}));

import { EventType } from "@/plugins/api/interfaces";
import { useMusicQuizDashboard } from "@/composables/music-quiz/useMusicQuizDashboard";

const LOBBY_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 3,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: null,
  join_url: "http://ma/join",
} as const;

const ANSWERING_STATE = {
  ...LOBBY_STATE,
  phase: "answering",
  players: [
    {
      name: "Alice",
      score: 0,
      ready: false,
      answered: false,
      active_from_round: 0,
    },
  ],
  current_round: {
    round_index: 1,
    started_at: 10,
    deadline: 40,
    auto_advance_at: null,
    question: null,
    suggestions: [{ suggestion_id: "one", label: "One" }],
  },
} as const;

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("useMusicQuizDashboard", () => {
  beforeEach(() => {
    providerHandlers.length = 0;
    mockGetMusicQuizPublicState.mockReset();
    mockSubscribe.mockReset();
    mockGetMusicQuizPublicState.mockResolvedValue({ ...LOBBY_STATE });
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

  it("cold-starts from the guest-safe public state", async () => {
    const dashboard = useMusicQuizDashboard();
    await flushPromises();

    expect(mockGetMusicQuizPublicState).toHaveBeenCalledOnce();
    expect(mockSubscribe).toHaveBeenCalledWith(
      EventType.PROVIDER_EVENT,
      expect.any(Function),
    );
    expect(dashboard.state.value?.phase).toBe("lobby");
    expect(dashboard.joinLink.value).toBe("http://ma/join");
    expect(dashboard.loading.value).toBe(false);
  });

  it("consumes the game_updated payload directly instead of re-fetching", async () => {
    const dashboard = useMusicQuizDashboard();
    await flushPromises();
    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: ANSWERING_STATE },
    });
    await flushPromises();

    expect(dashboard.state.value?.phase).toBe("answering");
    expect(dashboard.currentRound.value?.round_index).toBe(1);
    // the payload already IS the public state: a re-fetch would only add latency
    expect(mockGetMusicQuizPublicState).toHaveBeenCalledOnce();
  });

  it("ignores events from another provider instance", async () => {
    const dashboard = useMusicQuizDashboard();
    await flushPromises();
    const handler = providerHandlers[0];

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: LOBBY_STATE },
    });
    handler({
      object_id: "other-instance",
      data: { event: "game_updated", state: ANSWERING_STATE },
    });
    await flushPromises();

    expect(dashboard.state.value?.phase).toBe("lobby");

    handler({ object_id: "other-instance", data: { event: "game_removed" } });
    expect(dashboard.state.value).not.toBeNull();
  });

  it("falls back to the waiting screen when the game is removed", async () => {
    const dashboard = useMusicQuizDashboard();
    await flushPromises();
    const handler = providerHandlers[0];

    handler({ object_id: "quiz-instance", data: { event: "game_removed" } });

    expect(dashboard.state.value).toBeNull();
    expect(dashboard.joinLink.value).toBe("");
    expect(dashboard.currentRound.value).toBeNull();
  });

  it("never lets a late cold-start response overwrite a newer event payload", async () => {
    const pending = deferred<typeof LOBBY_STATE>();
    mockGetMusicQuizPublicState.mockReturnValue(pending.promise);
    const dashboard = useMusicQuizDashboard();
    await flushPromises();
    const handler = providerHandlers[0];

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: ANSWERING_STATE },
    });
    pending.resolve({ ...LOBBY_STATE });
    await flushPromises();

    expect(dashboard.state.value?.phase).toBe("answering");
  });

  it("shows the waiting screen when the cold start fails", async () => {
    mockGetMusicQuizPublicState.mockRejectedValue(new Error("Unavailable"));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dashboard = useMusicQuizDashboard();
    await flushPromises();

    expect(dashboard.state.value).toBeNull();
    expect(dashboard.loading.value).toBe(false);
    expect(consoleWarn).toHaveBeenCalledOnce();
    consoleWarn.mockRestore();
  });
});
