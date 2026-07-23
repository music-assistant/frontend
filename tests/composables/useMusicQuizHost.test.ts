import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const {
  mockCreateMusicQuiz,
  mockDeleteMusicQuiz,
  mockGetAvailableMusicQuizTypes,
  mockGetMusicQuiz,
  mockGetMusicQuizPlaybackOptions,
  mockNextMusicQuiz,
  mockRevealMusicQuiz,
  mockResetMusicQuiz,
  mockStartMusicQuiz,
  mockSubscribe,
  providerHandlers,
} = vi.hoisted(() => ({
  mockCreateMusicQuiz: vi.fn(),
  mockDeleteMusicQuiz: vi.fn(),
  mockGetAvailableMusicQuizTypes: vi.fn(),
  mockGetMusicQuiz: vi.fn(),
  mockGetMusicQuizPlaybackOptions: vi.fn(),
  mockNextMusicQuiz: vi.fn(),
  mockRevealMusicQuiz: vi.fn(),
  mockResetMusicQuiz: vi.fn(),
  mockStartMusicQuiz: vi.fn(),
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
  getMusicQuiz: mockGetMusicQuiz,
  getAvailableMusicQuizTypes: mockGetAvailableMusicQuizTypes,
  getMusicQuizPlaybackOptions: mockGetMusicQuizPlaybackOptions,
  createMusicQuiz: mockCreateMusicQuiz,
  startMusicQuiz: mockStartMusicQuiz,
  revealMusicQuiz: mockRevealMusicQuiz,
  nextMusicQuiz: mockNextMusicQuiz,
  resetMusicQuiz: mockResetMusicQuiz,
  deleteMusicQuiz: mockDeleteMusicQuiz,
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

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

import { EventType } from "@/plugins/api/interfaces";
import type { MusicQuizCreateRequest } from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizHost } from "@/composables/music-quiz/useMusicQuizHost";

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

const CREATE_REQUEST: MusicQuizCreateRequest = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  config: {
    round_count: 5,
    suggestion_count: 4,
    answer_duration: 30,
    difficulty: "normal",
    source_uris: [],
    include_similar_music: false,
  },
};
const PLAYBACK_OPTIONS = {
  default_playback_mode: "venue",
  default_venue_player_id: "living-room",
  venue_available: true,
  remote_available: true,
  venue_players: [{ player_id: "living-room", name: "Living Room" }],
} as const;

type Host = ReturnType<typeof useMusicQuizHost>;

const HOST_ACTIONS = [
  {
    name: "create",
    command: mockCreateMusicQuiz,
    invoke: (host: Host) => host.create(CREATE_REQUEST),
    result: HOST_STATE,
  },
  {
    name: "start",
    command: mockStartMusicQuiz,
    invoke: (host: Host) => host.start(),
    result: HOST_STATE,
  },
  {
    name: "reveal",
    command: mockRevealMusicQuiz,
    invoke: (host: Host) => host.reveal(),
    result: HOST_STATE,
  },
  {
    name: "next",
    command: mockNextMusicQuiz,
    invoke: (host: Host) => host.next(),
    result: HOST_STATE,
  },
  {
    name: "reset",
    command: mockResetMusicQuiz,
    invoke: (host: Host) => host.reset(),
    result: HOST_STATE,
  },
  {
    name: "delete",
    command: mockDeleteMusicQuiz,
    invoke: (host: Host) => host.deleteGame(),
    result: undefined,
  },
] satisfies Array<{
  name: string;
  command: Mock;
  invoke: (host: Host) => Promise<boolean>;
  result: typeof HOST_STATE | undefined;
}>;

async function flushPromises() {
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

describe("useMusicQuizHost", () => {
  beforeEach(() => {
    providerHandlers.length = 0;
    mockCreateMusicQuiz.mockReset();
    mockDeleteMusicQuiz.mockReset();
    mockGetAvailableMusicQuizTypes.mockReset();
    mockGetMusicQuiz.mockReset();
    mockGetMusicQuizPlaybackOptions.mockReset();
    mockNextMusicQuiz.mockReset();
    mockRevealMusicQuiz.mockReset();
    mockResetMusicQuiz.mockReset();
    mockStartMusicQuiz.mockReset();
    mockSubscribe.mockReset();
    mockCreateMusicQuiz.mockResolvedValue({ ...HOST_STATE });
    mockDeleteMusicQuiz.mockResolvedValue(undefined);
    mockGetAvailableMusicQuizTypes.mockResolvedValue([
      "guess_the_song",
      "music_timeline",
    ]);
    mockGetMusicQuiz.mockResolvedValue({ ...HOST_STATE });
    mockGetMusicQuizPlaybackOptions.mockResolvedValue(PLAYBACK_OPTIONS);
    mockNextMusicQuiz.mockResolvedValue({ ...HOST_STATE });
    mockRevealMusicQuiz.mockResolvedValue({ ...HOST_STATE });
    mockResetMusicQuiz.mockResolvedValue({ ...HOST_STATE });
    mockStartMusicQuiz.mockResolvedValue({ ...HOST_STATE });
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

  it("exposes backend-discovered quiz types", async () => {
    mockGetAvailableMusicQuizTypes.mockResolvedValue([
      "guess_the_song",
      "music_timeline",
      "trivia",
    ]);

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.availableQuizTypes.value).toEqual([
      "guess_the_song",
      "music_timeline",
      "trivia",
    ]);
  });

  it("discovers playback options with the available game types", async () => {
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockGetAvailableMusicQuizTypes).toHaveBeenCalledOnce();
    expect(mockGetMusicQuizPlaybackOptions).toHaveBeenCalledOnce();
    expect(host.playbackOptions.value).toEqual(PLAYBACK_OPTIONS);
    expect(host.playbackOptionsLoading.value).toBe(false);
    expect(host.playbackOptionsLegacy.value).toBe(false);
    expect(host.playbackOptionsError.value).toBe(false);
  });

  it("skips setup data when only host controls are needed", async () => {
    useMusicQuizHost({
      loadSetupData: false,
      notifyError: vi.fn(),
    });
    await flushPromises();

    expect(mockGetMusicQuiz).toHaveBeenCalledOnce();
    expect(mockGetAvailableMusicQuizTypes).not.toHaveBeenCalled();
    expect(mockGetMusicQuizPlaybackOptions).not.toHaveBeenCalled();
  });

  it("exposes playback discovery loading state", async () => {
    const pending = deferred<typeof PLAYBACK_OPTIONS>();
    mockGetMusicQuizPlaybackOptions.mockReturnValue(pending.promise);

    const host = useMusicQuizHost({ notifyError: vi.fn() });

    expect(host.playbackOptions.value).toBeNull();
    expect(host.playbackOptionsLoading.value).toBe(true);

    pending.resolve(PLAYBACK_OPTIONS);
    await flushPromises();

    expect(host.playbackOptions.value).toEqual(PLAYBACK_OPTIONS);
    expect(host.playbackOptionsLoading.value).toBe(false);
  });

  it("silently falls back for playback options on older servers", async () => {
    mockGetMusicQuizPlaybackOptions.mockRejectedValue(
      "Invalid command: music_quiz/playback_options",
    );
    const notifyError = vi.fn();

    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(host.playbackOptions.value).toBeNull();
    expect(host.playbackOptionsLoading.value).toBe(false);
    expect(host.playbackOptionsLegacy.value).toBe(true);
    expect(host.playbackOptionsError.value).toBe(false);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("blocks legacy fallback after an initial playback discovery failure", async () => {
    mockGetMusicQuizPlaybackOptions.mockRejectedValue(
      new Error("Server unavailable"),
    );
    const notifyError = vi.fn();

    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(host.playbackOptions.value).toBeNull();
    expect(host.playbackOptionsLoading.value).toBe(false);
    expect(host.playbackOptionsLegacy.value).toBe(false);
    expect(host.playbackOptionsError.value).toBe(true);
    expect(notifyError).toHaveBeenCalledWith(
      "providers.music_quiz.error_load_playback_options",
    );
  });

  it("recovers playback discovery through retry", async () => {
    mockGetMusicQuizPlaybackOptions
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockResolvedValueOnce(PLAYBACK_OPTIONS);
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.playbackOptionsError.value).toBe(true);

    await host.fetchPlaybackOptions();

    expect(host.playbackOptions.value).toEqual(PLAYBACK_OPTIONS);
    expect(host.playbackOptionsLegacy.value).toBe(false);
    expect(host.playbackOptionsError.value).toBe(false);
  });

  it("retains explicit playback options when refresh fails", async () => {
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();
    mockGetMusicQuizPlaybackOptions.mockRejectedValueOnce(
      new Error("Server unavailable"),
    );

    await host.fetchPlaybackOptions();

    expect(host.playbackOptions.value).toEqual(PLAYBACK_OPTIONS);
    expect(host.playbackOptionsLegacy.value).toBe(false);
    expect(host.playbackOptionsError.value).toBe(true);
  });

  it("ignores stale playback option responses", async () => {
    const first = deferred<typeof PLAYBACK_OPTIONS>();
    const refreshedOptions = {
      ...PLAYBACK_OPTIONS,
      default_playback_mode: "remote",
    } as const;
    mockGetMusicQuizPlaybackOptions
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(refreshedOptions);

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    const refresh = host.fetchPlaybackOptions();
    await refresh;

    expect(host.playbackOptions.value).toEqual(refreshedOptions);

    first.resolve(PLAYBACK_OPTIONS);
    await flushPromises();

    expect(host.playbackOptions.value).toEqual(refreshedOptions);
    expect(host.playbackOptionsLoading.value).toBe(false);
  });

  it("keeps optional game types hidden on older servers", async () => {
    mockGetAvailableMusicQuizTypes.mockRejectedValue(
      "Invalid command: music_quiz/available_quiz_types",
    );
    const notifyError = vi.fn();

    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(host.availableQuizTypes.value).toEqual([]);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("treats a null response as setup state without a toast", async () => {
    mockGetMusicQuiz.mockResolvedValue(null);
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(host.state.value).toBeNull();
  });

  it("keeps host resets manual unless auto-start is requested", async () => {
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    await host.reset();
    await host.reset(true);

    expect(mockResetMusicQuiz).toHaveBeenNthCalledWith(1, false);
    expect(mockResetMusicQuiz).toHaveBeenNthCalledWith(2, true);
  });

  it("replays immediately without scheduling a new lobby", async () => {
    const startedState = {
      ...HOST_STATE,
      phase: "answering",
    } as const;
    mockStartMusicQuiz.mockResolvedValueOnce(startedState);
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    await expect(host.replay()).resolves.toBe(true);

    expect(mockResetMusicQuiz).toHaveBeenCalledOnce();
    expect(mockResetMusicQuiz).toHaveBeenCalledWith(false);
    expect(mockStartMusicQuiz).toHaveBeenCalledOnce();
    expect(mockResetMusicQuiz.mock.invocationCallOrder[0]).toBeLessThan(
      mockStartMusicQuiz.mock.invocationCallOrder[0],
    );
    expect(host.state.value).toEqual(startedState);
  });

  it("keeps replay serialized across reset and start", async () => {
    const pendingReset = deferred<typeof HOST_STATE>();
    mockResetMusicQuiz.mockReturnValueOnce(pendingReset.promise);
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    const replay = host.replay();

    await expect(host.replay()).resolves.toBe(false);
    expect(host.busy.value).toBe(true);
    expect(host.starting.value).toBe(true);
    expect(mockStartMusicQuiz).not.toHaveBeenCalled();

    pendingReset.resolve(HOST_STATE);
    await expect(replay).resolves.toBe(true);

    expect(mockStartMusicQuiz).toHaveBeenCalledOnce();
    expect(host.busy.value).toBe(false);
    expect(host.starting.value).toBe(false);
  });

  it("stays in the lobby when immediate replay cannot start", async () => {
    mockStartMusicQuiz.mockRejectedValueOnce(new Error("Unavailable"));
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    await expect(host.replay()).resolves.toBe(false);

    expect(host.state.value).toEqual(HOST_STATE);
    expect(host.busy.value).toBe(false);
    expect(host.starting.value).toBe(false);
  });

  it("exposes preparation state while a game is starting", async () => {
    const pending = deferred<typeof HOST_STATE>();
    mockStartMusicQuiz.mockReturnValueOnce(pending.promise);
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    const start = host.start();

    expect(host.starting.value).toBe(true);
    expect(host.busy.value).toBe(true);

    pending.resolve(HOST_STATE);
    await expect(start).resolves.toBe(true);

    expect(host.starting.value).toBe(false);
    expect(host.busy.value).toBe(false);
  });

  it("clears preparation state when starting fails", async () => {
    mockStartMusicQuiz.mockRejectedValueOnce(new Error("Unavailable"));
    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    await expect(host.start()).resolves.toBe(false);

    expect(host.starting.value).toBe(false);
    expect(host.busy.value).toBe(false);
  });

  it.each(HOST_ACTIONS)(
    "serializes concurrent $name commands",
    async ({ command, invoke, result }) => {
      const pending = deferred<typeof result>();
      command.mockReturnValueOnce(pending.promise);
      const host = useMusicQuizHost({ notifyError: vi.fn() });
      await flushPromises();

      const firstAction = invoke(host);
      await expect(invoke(host)).resolves.toBe(false);

      expect(command).toHaveBeenCalledOnce();
      expect(host.busy.value).toBe(true);

      pending.resolve(result);
      await expect(firstAction).resolves.toBe(true);
      expect(host.busy.value).toBe(false);

      await expect(invoke(host)).resolves.toBe(true);
      expect(command).toHaveBeenCalledTimes(2);
    },
  );

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
      answer_type: "timeline",
      phase: "lobby",
      name: "Future Quiz",
    });

    const host = useMusicQuizHost({ notifyError: vi.fn() });
    await flushPromises();

    expect(host.state.value?.answer_type).toBe("timeline");
    expect(host.currentRound.value).toBeNull();
    expect(host.joinLink.value).toBe("");
  });
});
