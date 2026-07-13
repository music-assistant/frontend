import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import MusicTimelineSetup from "@/components/music-quiz/game-types/music-timeline/MusicTimelineSetup.vue";
import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale,
  getLocaleOptions: () => [],
  i18n: {
    global: {
      availableLocales: ["en"],
      locale: { value: "en" },
    },
  },
}));

vi.mock("@/components/music-quiz/MusicQuizSourceSelector.vue", () => ({
  default: {
    name: "MusicQuizSourceSelector",
    template: '<div data-testid="music-quiz-source-selector" />',
  },
}));

const SETUP_COMPONENTS = [
  { label: "Guess the Song", component: GuessTheSongSetup },
  { label: "Music Timeline", component: MusicTimelineSetup },
  { label: "Trivia", component: TriviaSetup },
] as const;

describe("Music Quiz setup source placement", () => {
  it.each(SETUP_COMPONENTS)(
    "renders the shared source option immediately before sources for $label",
    ({ component }) => {
      const wrapper = shallowMount(component, {
        props: {
          busy: false,
          includeSimilarMusic: false,
          sharedConfigValid: true,
        },
        slots: {
          "before-sources":
            '<div data-testid="include-similar-option">Include similar music</div>',
        },
      });

      const includeSimilar = wrapper.get(
        '[data-testid="include-similar-option"]',
      );
      const sourceSelector = wrapper.getComponent(MusicQuizSourceSelector);

      expect(sourceSelector.element.previousElementSibling).toBe(
        includeSimilar.element,
      );
    },
  );
});
