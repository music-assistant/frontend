import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMusicQuiz, mockSubscribe, providerHandlers } = vi.hoisted(
  () => ({
    mockGetMusicQuiz: vi.fn(),
    mockSubscribe: vi.fn(),
    providerHandlers: [] as Array<
      (event: { object_id?: string; data?: unknown }) => void
    >,
  }),
);

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
  deleteMusicQuiz: vi.fn(),
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
    mockGetMusicQuiz.mockReset();
    mockSubscribe.mockReset();
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
      data: { event: "game_updated" },
    });
    await flushPromises();
    expect(mockGetMusicQuiz).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: { event: "game_updated" },
    });
    await flushPromises();
    expect(mockGetMusicQuiz).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: { event: "game_removed" },
    });
    expect(host.state.value).not.toBeNull();
    expect(host.gameRemoved.value).toBe(false);

    handler({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    expect(host.state.value).toBeNull();
    expect(host.gameRemoved.value).toBe(true);
  });

  it("treats a no-active-game error as an empty state without a toast", async () => {
    mockGetMusicQuiz.mockRejectedValue("There is no active Music Quiz game");
    const notifyError = vi.fn();
    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(host.state.value).toBeNull();
    expect(host.gameRemoved.value).toBe(false);
  });
});
