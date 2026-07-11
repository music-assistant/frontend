import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import type {
  MusicQuizPhase,
  MusicQuizSupportedHostState,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) =>
    key === "providers.music_quiz.end_game" ? "End game" : key,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
}));

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
  it("offers the host an end-game action", async () => {
    const wrapper = mountPanel("lobby");

    const endGameButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("End game"));
    expect(endGameButton).toBeDefined();
    expect(wrapper.text()).not.toContain("Delete");

    await endGameButton?.trigger("click");
    expect(wrapper.emitted("endGame")).toHaveLength(1);
  });

  it.each([
    ["lobby", "providers.music_quiz.start"],
    ["answering", "providers.music_quiz.phase_reveal"],
    ["reveal", "providers.music_quiz.next"],
    ["finished", "providers.music_quiz.new_game"],
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
});

function mountPanel(phase: MusicQuizPhase) {
  return mount(MusicQuizHostPanel, {
    props: {
      state: { ...HOST_STATE, phase },
      busy: false,
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
