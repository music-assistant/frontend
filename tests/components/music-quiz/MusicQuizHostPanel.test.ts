import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import type { MusicQuizSupportedHostState } from "@/composables/useMusicQuiz";
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
    const wrapper = mount(MusicQuizHostPanel, {
      props: {
        state: HOST_STATE,
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

    const endGameButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("End game"));
    expect(endGameButton).toBeDefined();
    expect(wrapper.text()).not.toContain("Delete");

    await endGameButton?.trigger("click");
    expect(wrapper.emitted("delete")).toHaveLength(1);
  });
});
