import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/music-quiz/game_types", async () => {
  const { defineComponent, h } = await import("vue");
  const configComponent = defineComponent({
    emits: ["create"],
    setup(_, { emit }) {
      return () =>
        h(
          "button",
          {
            "data-testid": "create-game",
            onClick: () =>
              emit("create", {
                quiz_type: "guess_the_song",
                answer_type: "multiple_choice",
                config: {
                  round_count: 5,
                  suggestion_count: 4,
                  answer_duration: 30,
                  difficulty: "normal",
                  source_uris: ["track:test"],
                  name: "Test Quiz",
                },
              }),
          },
          "Create",
        );
    },
  });

  return {
    MUSIC_QUIZ_GAME_TYPES: [
      {
        id: "guess_the_song",
        answerType: "multiple_choice",
        labelKey: "game_type",
        descriptionKey: "game_type_description",
        icon: { template: "<span />" },
        requiresBackendAvailability: false,
        supportsListenIn: true,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: configComponent,
        },
      },
      {
        id: "trivia",
        answerType: "multiple_choice",
        labelKey: "trivia_type",
        descriptionKey: "trivia_description",
        icon: { template: "<span />" },
        requiresBackendAvailability: true,
        supportsListenIn: false,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: configComponent,
        },
      },
    ],
    isMusicQuizGameAvailable: (
      game: { id: string; requiresBackendAvailability: boolean },
      availableQuizTypes: string[],
    ) =>
      !game.requiresBackendAvailability || availableQuizTypes.includes(game.id),
  };
});

const request = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  config: {
    round_count: 5,
    suggestion_count: 4,
    answer_duration: 30,
    difficulty: "normal",
    source_uris: ["track:test"],
    name: "Test Quiz",
  },
} as const;

describe("MusicQuizSetupWizard", () => {
  it("shows Trivia only when the backend reports it available", async () => {
    const wrapper = mountWizard();

    expect(wrapper.text()).toContain("game_type");
    expect(wrapper.text()).not.toContain("trivia_type");

    await wrapper.setProps({ availableQuizTypes: ["trivia"] });

    expect(wrapper.text()).toContain("game_type");
    expect(wrapper.text()).toContain("trivia_type");
  });

  it("forwards the selected game component's create request", async () => {
    const wrapper = mountWizard();

    await wrapper.find("section button").trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="create-game"]').trigger("click");

    expect(wrapper.emitted("create")).toEqual([[request]]);
  });
});

function mountWizard() {
  return mount(MusicQuizSetupWizard, {
    props: { busy: false },
    global: {
      stubs: {
        Button: {
          template: "<button><slot /></button>",
        },
        Progress: true,
      },
    },
  });
}
