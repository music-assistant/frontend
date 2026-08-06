import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongRound,
  MusicQuizHostPlayback,
  MusicQuizPhase,
} from "@/composables/music-quiz/useMusicQuiz";
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
          "providers.music_quiz.next": "Next Round",
          "providers.music_quiz.finish": "Finish Quiz",
          "providers.music_quiz.next_round_countdown": "Next Round · {0}",
          "providers.music_quiz.finish_quiz_countdown": "Finish Quiz · {0}",
          "providers.music_quiz.waiting_for_next": "Waiting for next round...",
          "providers.music_quiz.waiting_for_final_results":
            "Waiting for final results...",
          "providers.music_quiz.play_again": "Play again",
          "providers.music_quiz.set_up_new_game": "Set up new game…",
          "providers.music_quiz.playback": "Playback",
          "providers.music_quiz.playback_venue": "Venue",
          "providers.music_quiz.playback_summary_venue": "Venue · {0}",
          "providers.music_quiz.playback_summary_remote":
            "Remote · Players listen on their own device",
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
} satisfies MusicQuizGuessTheSongHostState;
const HOST_ROUND = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: 31,
  auto_advance_at: null,
  suggestions: [],
} satisfies MusicQuizGuessTheSongRound;

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
    [
      {
        mode: "venue",
        venue_player_id: "living-room",
        venue_player_name: "Living Room",
      },
      "Playback: Venue · Living Room",
    ],
    [
      {
        mode: "remote",
        venue_player_id: null,
        venue_player_name: null,
      },
      "Playback: Remote · Players listen on their own device",
    ],
  ] satisfies Array<[MusicQuizHostPlayback, string]>)(
    "shows the host lobby playback summary",
    (playback, expected) => {
      const wrapper = mountPanel("lobby", false, { playback });

      expect(
        wrapper.get('[data-testid="music-quiz-playback-summary"]').text(),
      ).toBe(expected);
    },
  );

  it("keeps playback details out of non-lobby host UI", () => {
    const wrapper = mountPanel("answering", false, {
      playback: {
        mode: "venue",
        venue_player_id: "living-room",
        venue_player_name: "Living Room",
      },
    });

    expect(
      wrapper.find('[data-testid="music-quiz-playback-summary"]').exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("Living Room");
  });

  it("keeps legacy lobbies usable without a playback summary", () => {
    const wrapper = mountPanel("lobby");

    expect(
      wrapper.find('[data-testid="music-quiz-playback-summary"]').exists(),
    ).toBe(false);
  });

  it.each([
    ["lobby", "Start Quiz"],
    ["answering", "providers.music_quiz.phase_reveal"],
    ["reveal", "Next Round"],
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
    const wrapper = mountPanel("lobby", false, {
      autoStartAt: Date.now() / 1000 + 12,
    });
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
    const wrapper = mountPanel("lobby", true, { autoStartAt: null });
    const startButton = wrapper.get('[data-testid="start-quiz"]');

    expect(startButton.text()).toContain("Start Quiz");
    expect(startButton.attributes("disabled")).toBeDefined();

    await startButton.trigger("click");
    expect(wrapper.emitted("start")).toBeUndefined();
  });

  it.each([
    [false, "Next Round · 15s"],
    [true, "Finish Quiz · 15s"],
  ] as const)(
    "shows the authoritative Trivia reveal action for final=%s",
    async (isLastRound, expectedLabel) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const wrapper = mountPanel("reveal", false, {
        revealCountdown: true,
        autoAdvanceAt: Date.now() / 1000 + 15,
        isLastRound,
      });
      const nextButton = wrapper.get('[data-testid="next-quiz"]');

      expect(nextButton.text()).toContain(expectedLabel);
      await nextButton.trigger("click");
      expect(wrapper.emitted("next")).toEqual([[]]);
    },
  );

  it.each([
    [false, "Next Round"],
    [true, "Finish Quiz"],
  ] as const)(
    "keeps elapsed Trivia recovery actionable for final=%s",
    async (isLastRound, expectedLabel) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const wrapper = mountPanel("reveal", false, {
        revealCountdown: true,
        autoAdvanceAt: Date.now() / 1000 + 1,
        isLastRound,
      });
      const nextButton = wrapper.get('[data-testid="next-quiz"]');

      await vi.advanceTimersByTimeAsync(1_000);

      expect(nextButton.text()).toContain(expectedLabel);
      expect(nextButton.text()).not.toContain("0s");
      expect(nextButton.attributes("disabled")).toBeUndefined();
      expect(wrapper.emitted("next")).toBeUndefined();

      await nextButton.trigger("click");

      expect(wrapper.emitted("next")).toEqual([[]]);
    },
  );

  it("keeps a null Trivia reveal deadline manual", async () => {
    const wrapper = mountPanel("reveal", false, {
      revealCountdown: true,
      autoAdvanceAt: Date.now() / 1000 + 15,
    });
    const nextButton = wrapper.get('[data-testid="next-quiz"]');

    expect(nextButton.text()).toContain("·");

    await wrapper.setProps({
      state: {
        ...HOST_STATE,
        phase: "reveal",
        current_round: {
          ...HOST_ROUND,
          auto_advance_at: null,
        },
      },
    });

    expect(nextButton.text()).toContain("Next Round");
    expect(nextButton.text()).not.toContain("·");
    expect(nextButton.attributes("disabled")).toBeUndefined();

    await nextButton.trigger("click");
    expect(wrapper.emitted("next")).toEqual([[]]);
  });
});

function mountPanel(
  phase: MusicQuizPhase,
  busy = false,
  options: {
    autoStartAt?: number | null;
    revealCountdown?: boolean;
    autoAdvanceAt?: number | null;
    isLastRound?: boolean;
    playback?: MusicQuizHostPlayback;
  } = {},
) {
  return mount(MusicQuizHostPanel, {
    props: {
      state: {
        ...HOST_STATE,
        phase,
        auto_start_at: options.autoStartAt,
        current_round:
          phase === "answering" || phase === "reveal"
            ? {
                ...HOST_ROUND,
                auto_advance_at: options.autoAdvanceAt ?? null,
              }
            : null,
        ...(options.playback ? { playback: options.playback } : {}),
      },
      busy,
      joinLink: HOST_STATE.join_url,
      isLastRound: options.isLastRound ?? false,
      revealCountdown: options.revealCountdown ?? false,
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
