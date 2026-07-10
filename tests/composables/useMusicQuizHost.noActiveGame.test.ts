import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetMusicQuiz, mockSubscribe } = vi.hoisted(() => ({
  mockGetMusicQuiz: vi.fn(),
  mockSubscribe: vi.fn(() => () => {}),
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
  deleteMusicQuiz: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

import { useMusicQuizHost } from "@/composables/useMusicQuizHost";

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMusicQuizHost no active game handling", () => {
  beforeEach(() => {
    mockGetMusicQuiz.mockReset();
    mockSubscribe.mockClear();
  });

  it("treats 'no active game' as an empty state without notifying", async () => {
    mockGetMusicQuiz.mockRejectedValue(
      new Error("There is no active Music Quiz game"),
    );
    const notifyError = vi.fn();

    const host = useMusicQuizHost({ notifyError });
    await flushPromises();

    expect(host.state.value).toBeNull();
    expect(host.gameRemoved.value).toBe(false);
    expect(notifyError).not.toHaveBeenCalled();
  });
});
