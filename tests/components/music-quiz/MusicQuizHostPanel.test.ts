import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import type {
  MusicQuizPhase,
  MusicQuizSupportedHostState,
} from "@/composables/useMusicQuiz";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) => {
    const message =
      (
        {
          "providers.music_quiz.start": "Start Quiz",
          "providers.music_quiz.start_now_countdown": "Start now · {0}",
          "providers.music_quiz.start_now_waiting": "Start now · Waiting…",
          "providers.music_quiz.end_game": "End game",
          "providers.music_quiz.play_again": "Play again",
          "providers.music_quiz.set_up_new_game": "Set up new game…",
        } as Record<string, string>
      )[key] ?? key;
    return message.replace("{0}", String(values[0] ?? ""));
  },
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
});

const HOST_STATE: MusicQuizSupportedHostState = {
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
};

describe("MusicQuizHostPanel", () => {
  it("keeps Present mode and End game available", async () => {
    const wrapper = mountPanel("lobby");

    const presentButton = wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.enter_present_mode"),
      );
    const endGameButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("End game"));
    expect(presentButton).toBeDefined();
    expect(endGameButton).toBeDefined();
    expect(wrapper.text()).not.toContain("Delete");

    await presentButton?.trigger("click");
    await endGameButton?.trigger("click");
    expect(wrapper.emitted("present")).toHaveLength(1);
    expect(wrapper.emitted("endGame")).toHaveLength(1);
  });

  it.each([
    ["lobby", "Start Quiz"],
    ["answering", "providers.music_quiz.phase_reveal"],
    ["reveal", "providers.music_quiz.next"],
    ["finished", "Play again"],
  ] as const)(
    "keeps the %s lifecycle action in the shared control bar",
    (phase, actionLabel) => {
      const wrapper = mountPanel(phase);
      const actions = wrapper.get('[data-testid="quiz-host-actions"]');

      expect(actions.text()).toContain(
        "providers.music_quiz.enter_present_mode",
      );
      expect(actions.text()).toContain("End game");
      expect(actions.text()).toContain(actionLabel);
    },
  );

  it("keeps replay separate from fresh setup", async () => {
    const wrapper = mountPanel("finished");
    const replayButton = wrapper.get('[data-testid="play-again"]');
    const menuButton = wrapper.get('[data-testid="play-again-menu"]');

    expect(replayButton.text()).toContain("Play again");
    expect(wrapper.text()).not.toContain("New Game");
    expect(menuButton.attributes("aria-label")).toBe("Set up new game…");
    expect(menuButton.attributes("aria-haspopup")).toBe("menu");

    await replayButton.trigger("click");
    expect(wrapper.emitted("reset")).toHaveLength(1);
    expect(wrapper.emitted("setUpNewGame")).toBeUndefined();

    await menuButton.trigger("keydown", { key: "Enter" });
    await flushPromises();
    const setupItem = document.body.querySelector<HTMLElement>(
      '[data-testid="set-up-new-game"]',
    );
    expect(setupItem?.textContent).toContain("Set up new game…");

    setupItem?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("setUpNewGame")).toHaveLength(1);
    expect(wrapper.emitted("reset")).toHaveLength(1);

    wrapper.unmount();
  });

  it("disables both finished-state actions while busy", async () => {
    const wrapper = mountPanel("finished", true);
    const replayButton = wrapper.get('[data-testid="play-again"]');
    const menuButton = wrapper.get('[data-testid="play-again-menu"]');

    expect(replayButton.attributes("disabled")).toBeDefined();
    expect(menuButton.attributes("disabled")).toBeDefined();

    await replayButton.trigger("click");
    await menuButton.trigger("click");
    expect(wrapper.emitted("reset")).toBeUndefined();
    expect(wrapper.emitted("setUpNewGame")).toBeUndefined();
  });

  it("uses the server deadline for replay and never starts on its own", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const wrapper = mountPanel("lobby", false, Date.now() / 1000 + 12);
    const startButton = wrapper.get('[data-testid="start-quiz"]');

    expect(startButton.text()).toContain("Start now · 12s");

    await startButton.trigger("click");
    expect(wrapper.emitted("start")).toHaveLength(1);

    vi.advanceTimersByTime(12_000);
    await flushPromises();
    expect(startButton.text()).toContain("Start now · Waiting…");
    expect(wrapper.emitted("start")).toHaveLength(1);

    await wrapper.setProps({
      state: {
        ...HOST_STATE,
        phase: "lobby",
        auto_start_at: null,
      },
    });
    expect(startButton.text()).toContain("Start Quiz");
    expect(startButton.text()).not.toContain("Start now");
    wrapper.unmount();
  });

  it("keeps a no-player lobby manual and guards Start while busy", async () => {
    const wrapper = mountPanel("lobby", true, null);
    const startButton = wrapper.get('[data-testid="start-quiz"]');

    expect(startButton.text()).toContain("Start Quiz");
    expect(startButton.attributes("disabled")).toBeDefined();

    await startButton.trigger("click");
    expect(wrapper.emitted("start")).toBeUndefined();
  });
});

function mountPanel(
  phase: MusicQuizPhase,
  busy = false,
  autoStartAt?: number | null,
) {
  return mount(MusicQuizHostPanel, {
    props: {
      state: { ...HOST_STATE, phase, auto_start_at: autoStartAt },
      busy,
      joinLink: HOST_STATE.join_url,
      isLastRound: false,
    },
    slots: {
      game: "<div />",
    },
    global: {
      stubs: {
        MusicQuizQrCard: true,
      },
    },
  });
}
