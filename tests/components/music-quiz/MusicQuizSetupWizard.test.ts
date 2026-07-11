import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: mockSendCommand,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/music-quiz/game_types", async () => {
  const { defineComponent, h, markRaw } = await import("vue");
  const configComponent = markRaw(
    defineComponent({
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
    }),
  );

  return {
    MUSIC_QUIZ_GAME_TYPES: [
      {
        id: "guess_the_song",
        answerType: "multiple_choice",
        labelKey: "game_type",
        descriptionKey: "game_type_description",
        icon: markRaw({ template: "<span />" }),
        availability: "always",
        supportsListenIn: true,
        adapters: {
          setup: configComponent,
        },
      },
      {
        id: "trivia",
        answerType: "multiple_choice",
        labelKey: "trivia_type",
        descriptionKey: "trivia_type_description",
        icon: markRaw({ template: "<span />" }),
        availability: "server",
        supportsListenIn: false,
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
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSendCommand.mockResolvedValue(["guess_the_song", "hitster", "trivia"]);
  });

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

  it("keeps Trivia disabled until the server confirms availability", async () => {
    let resolveAvailability = (_value: string[]) => {};
    mockSendCommand.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveAvailability = resolve;
      }),
    );
    const wrapper = mountWizard();

    await wrapper.find("section button").trigger("click");
    await nextTick();

    const triviaButton = wrapper
      .findAll("section button")
      .find((button) => button.text().includes("trivia_type"));
    expect(triviaButton?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(
      "providers.music_quiz.trivia_checking_availability",
    );

    resolveAvailability(["guess_the_song", "hitster", "trivia"]);
    await flushPromises();

    expect(triviaButton?.attributes("disabled")).toBeUndefined();
    expect(mockSendCommand).toHaveBeenCalledWith(
      "music_quiz/available_quiz_types",
    );
    wrapper.unmount();
  });

  it("explains when Trivia is unavailable without blocking other games", async () => {
    mockSendCommand.mockResolvedValueOnce(["guess_the_song", "hitster"]);
    const wrapper = mountWizard();

    await wrapper.find("section button").trigger("click");
    await flushPromises();

    const gameButtons = wrapper.findAll("section button");
    const guessButton = gameButtons.find((button) =>
      button.text().includes("game_type"),
    );
    const triviaButton = gameButtons.find((button) =>
      button.text().includes("trivia_type"),
    );
    expect(guessButton?.attributes("disabled")).toBeUndefined();
    expect(triviaButton?.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(
      "providers.music_quiz.trivia_requires_ai_provider",
    );
    wrapper.unmount();
  });

  it("offers an accessible retry after an availability error", async () => {
    mockSendCommand
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(["guess_the_song", "hitster", "trivia"]);
    const wrapper = mountWizard();

    await wrapper.find("section button").trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain(
      "providers.music_quiz.trivia_availability_failed",
    );
    await wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.retry_availability"),
      )
      ?.trigger("click");
    await flushPromises();

    const triviaButton = wrapper
      .findAll("section button")
      .find((button) => button.text().includes("trivia_type"));
    expect(triviaButton?.attributes("disabled")).toBeUndefined();
    expect(mockSendCommand).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});

function mountWizard() {
  return mount(MusicQuizSetupWizard, {
    props: { busy: false },
    global: {
      stubs: {
        Badge: true,
        Button: {
          template: '<button :disabled="$attrs.disabled"><slot /></button>',
        },
        Progress: true,
      },
    },
  });
}
