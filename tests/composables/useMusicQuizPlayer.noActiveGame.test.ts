import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMusicQuizInfo,
  mockGetMusicQuizState,
  mockJoinMusicQuiz,
  mockReadyMusicQuiz,
  mockAnswerMusicQuiz,
  mockSubscribe,
  storedPlayerId,
} = vi.hoisted(() => ({
  mockGetMusicQuizInfo: vi.fn(),
  mockGetMusicQuizState: vi.fn(),
  mockJoinMusicQuiz: vi.fn(),
  mockReadyMusicQuiz: vi.fn(),
  mockAnswerMusicQuiz: vi.fn(),
  mockSubscribe: vi.fn(() => () => {}),
  storedPlayerId: { value: "player-1" as string | null },
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
}));

vi.mock("@/helpers/music_quiz", () => ({
  clearStoredMusicQuizPlayerId: () => {
    storedPlayerId.value = null;
  },
  getStoredMusicQuizPlayerId: () => storedPlayerId.value,
  storeMusicQuizPlayerId: (playerId: string) => {
    storedPlayerId.value = playerId;
  },
  getMusicQuizErrorMessage: (err: unknown, fallback = "") =>
    err instanceof Error ? err.message : fallback,
  isNoActiveMusicQuizError: (err: unknown) =>
    err instanceof Error && err.message.toLowerCase().includes("no active"),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMusicQuizPlayer no active game handling", () => {
  beforeEach(() => {
    storedPlayerId.value = "player-1";
    mockGetMusicQuizInfo.mockReset();
    mockGetMusicQuizState.mockReset();
    mockJoinMusicQuiz.mockReset();
    mockReadyMusicQuiz.mockReset();
    mockAnswerMusicQuiz.mockReset();
    mockSubscribe.mockClear();
  });

  it("does not notify on no-active-game state fetch errors", async () => {
    mockGetMusicQuizState.mockRejectedValue(
      new Error("There is no active Music Quiz game"),
    );
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(player.state.value).toBeNull();
    expect(player.playerId.value).toBeNull();
    expect(player.gameRemoved.value).toBe(true);
    expect(notifyError).not.toHaveBeenCalled();
  });
});
