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
        h("div", {}, [
          h(
            "button",
            {
              "data-testid": "create-guess-the-song",
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
          ),
          h(
            "button",
            {
              "data-testid": "create-hitster",
              onClick: () =>
                emit("create", {
                  quiz_type: "hitster",
                  answer_type: "timeline",
                  config: {
                    round_count: 5,
                    answer_duration: 30,
                    source_uris: ["track:test"],
                    artist_bonus_mode: "free_text",
                    title_bonus_mode: "off",
                  },
                }),
            },
            "Create Hitster",
          ),
        ]);
    },
  });

  return {
    MUSIC_QUIZ_GAME_TYPES: [
      {
        id: "guess_the_song",
        answerType: "multiple_choice",
        labelKey: "game_type",
        descriptionKey: "game_type_description",
        revealActionKey: "reveal_action",
        revealPhaseKey: "reveal_phase",
        icon: { template: "<span />" },
        available: true,
        supportsListenIn: true,
        adapters: {
          setup: configComponent,
        },
      },
      {
        id: "hitster",
        answerType: "timeline",
        labelKey: "hitster_type",
        descriptionKey: "hitster_type_description",
        revealActionKey: "hitster_reveal_action",
        revealPhaseKey: "hitster_reveal_phase",
        icon: { template: "<span />" },
        available: true,
        supportsListenIn: true,
        adapters: {
          setup: configComponent,
        },
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
    await wrapper.get('[data-testid="create-guess-the-song"]').trigger("click");

    expect(wrapper.emitted("create")).toEqual([[request]]);
  });

  it("forwards the Hitster setup request unchanged", async () => {
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
    await wrapper
      .findAll("section button")
      .find((button) => button.text().includes("hitster_type"))
      ?.trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="create-hitster"]').trigger("click");

    expect(wrapper.emitted("create")).toEqual([
      [
        {
          quiz_type: "hitster",
          answer_type: "timeline",
          config: {
            round_count: 5,
            answer_duration: 30,
            source_uris: ["track:test"],
            artist_bonus_mode: "free_text",
            title_bonus_mode: "off",
          },
        },
      ],
    ]);
  });
});
