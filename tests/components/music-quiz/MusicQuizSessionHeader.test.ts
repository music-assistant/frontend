import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const icon = { template: '<svg data-testid="game-icon" />' };
const adapters = {
  setup: icon,
  player: icon,
  hostPanel: icon,
  host: icon,
  present: icon,
};

function game(
  id: "guess_the_song" | "trivia",
  supportsListenIn: boolean,
): MusicQuizGameDefinition {
  return {
    id,
    answerType: "multiple_choice",
    labelKey: `game.${id}`,
    descriptionKey: "",
    icon,
    requiresBackendAvailability: false,
    supportsListenIn,
    revealPhaseLabelKey: "",
    adapters,
  };
}

describe("MusicQuizSessionHeader", () => {
  it("uses a custom session name as the heading for named games", () => {
    const wrapper = mount(MusicQuizSessionHeader, {
      props: {
        game: game("guess_the_song", true),
        name: "Friday Quiz",
        phaseLabel: "Answers open",
        roundLabel: "Round 2 / 5",
        mode: "remote",
      },
    });

    expect(wrapper.find('[data-testid="game-icon"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-testid="game-icon"]').attributes("aria-hidden"),
    ).toBe("true");
    expect(
      wrapper
        .get('[data-testid="music-quiz-session-header"]')
        .attributes("aria-label"),
    ).toBeUndefined();
    expect(wrapper.text()).toContain("game.guess_the_song");
    expect(wrapper.get("h2").text()).toBe("Friday Quiz");
    expect(wrapper.text()).toContain("Answers open");
    expect(wrapper.text()).toContain("Round 2 / 5");
    expect(wrapper.text()).toContain("providers.music_quiz.mode_remote");
    expect(wrapper.get('[role="status"]').attributes("aria-live")).toBe(
      "polite",
    );
  });

  it("uses the game label for unnamed games without playback mode", () => {
    const wrapper = mount(MusicQuizSessionHeader, {
      props: {
        game: game("trivia", false),
        phaseLabel: "Answers open",
        mode: "venue",
      },
    });

    expect(wrapper.get("h2").text()).toBe("game.trivia");
    expect(wrapper.find('[data-testid="music-quiz-mode"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain("providers.music_quiz.mode_venue");
  });

  it("uses compact sizing only for present mode", () => {
    const props = {
      game: game("guess_the_song", true),
      name: "Friday Quiz",
      phaseLabel: "Answers open",
      roundLabel: "Round 2 / 5",
      mode: "venue" as const,
    };
    const regular = mount(MusicQuizSessionHeader, { props });
    const present = mount(MusicQuizSessionHeader, {
      props: {
        ...props,
        present: true,
      },
    });

    expect(
      regular.get('[data-testid="music-quiz-session-header"]').classes(),
    ).toEqual(expect.arrayContaining(["gap-3", "p-4"]));
    expect(regular.get("h2").classes()).toEqual(
      expect.arrayContaining(["text-lg", "sm:text-xl"]),
    );

    expect(
      present.get('[data-testid="music-quiz-session-header"]').classes(),
    ).toEqual(expect.arrayContaining(["gap-2", "p-3", "sm:p-4"]));
    expect(present.get("h1").classes()).toEqual(
      expect.arrayContaining(["text-xl", "sm:text-2xl"]),
    );
    expect(
      present.get('[data-testid="game-icon"]').element.parentElement?.classList,
    ).toContain("size-11");
    expect(regular.find("h1").exists()).toBe(false);
    expect(present.find("h2").exists()).toBe(false);
  });
});
