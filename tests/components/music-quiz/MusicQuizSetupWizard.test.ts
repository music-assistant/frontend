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
        labelKey: "game_type",
        descriptionKey: "game_type_description",
        icon: { template: "<span />" },
        available: true,
        configComponent,
      },
    ],
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
  it("forwards the selected game component's create request", async () => {
    const wrapper = mount(MusicQuizSetupWizard, {
      props: { busy: false },
      global: {
        stubs: {
          Badge: true,
          Button: {
            template: "<button><slot /></button>",
          },
          Progress: true,
        },
      },
    });

    await wrapper.find("section button").trigger("click");
    await nextTick();
    await wrapper.find("section button").trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="create-game"]').trigger("click");

    expect(wrapper.emitted("create")).toEqual([[request]]);
  });
});
