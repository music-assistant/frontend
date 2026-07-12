import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/music-quiz/game_types", async () => {
  const { defineComponent, h } = await import("vue");
  const setupComponent = (quizType: string, answerType: string) =>
    defineComponent({
      props: {
        includeSimilarMusic: {
          type: Boolean,
          required: true,
        },
      },
      emits: ["create"],
      setup(props, { emit }) {
        return () =>
          h(
            "button",
            {
              "data-testid": `create-${quizType}`,
              onClick: () =>
                emit("create", {
                  quiz_type: quizType,
                  answer_type: answerType,
                  config: {
                    source_uris: ["track:test"],
                    include_similar_music: props.includeSimilarMusic,
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
          setup: setupComponent("guess_the_song", "multiple_choice"),
        },
      },
      {
        id: "music_timeline",
        answerType: "timeline",
        labelKey: "timeline_type",
        descriptionKey: "timeline_description",
        icon: { template: "<span />" },
        requiresBackendAvailability: false,
        supportsListenIn: true,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: setupComponent("music_timeline", "timeline"),
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
          setup: setupComponent("trivia", "multiple_choice"),
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

const GAME_CASES = [
  {
    label: "game_type",
    quizType: "guess_the_song",
    answerType: "multiple_choice",
  },
  {
    label: "timeline_type",
    quizType: "music_timeline",
    answerType: "timeline",
  },
  {
    label: "trivia_type",
    quizType: "trivia",
    answerType: "multiple_choice",
  },
] as const;

describe("MusicQuizSetupWizard", () => {
  it("shows Trivia only when the backend reports it available", async () => {
    const wrapper = mountWizard();

    expect(wrapper.text()).toContain("game_type");
    expect(wrapper.text()).not.toContain("trivia_type");

    await wrapper.setProps({ availableQuizTypes: ["trivia"] });

    expect(wrapper.text()).toContain("game_type");
    expect(wrapper.text()).toContain("trivia_type");
  });

  it("moves focus between step headings after navigation", async () => {
    const wrapper = mountWizard({}, true);
    const gameTypeButton = wrapper.get<HTMLButtonElement>("section button");

    gameTypeButton.element.focus();
    await gameTypeButton.trigger("click");
    await nextTick();

    const configureHeading = wrapper.get("h2");
    expect(configureHeading.text()).toBe("providers.music_quiz.configure_game");
    expect(configureHeading.attributes("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(configureHeading.element);

    const backButton = wrapper.get("button");
    backButton.element.focus();
    await backButton.trigger("click");
    await nextTick();

    const chooseHeading = wrapper.get("h2");
    expect(chooseHeading.text()).toBe("providers.music_quiz.choose_game_type");
    expect(chooseHeading.attributes("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(chooseHeading.element);
    wrapper.unmount();
  });

  it.each(GAME_CASES)(
    "renders one shared, accessible setting for $quizType and serializes both values",
    async ({ label, quizType, answerType }) => {
      const wrapper = mountWizard({ availableQuizTypes: ["trivia"] });

      await selectGame(wrapper, label);
      const toggle = wrapper.get('[data-testid="quiz-include-similar-music"]');

      expect(
        wrapper.findAll('[data-testid="quiz-include-similar-music"]'),
      ).toHaveLength(1);
      expect(toggle.attributes("role")).toBe("switch");
      expect(toggle.attributes("aria-checked")).toBe("false");
      expect(
        wrapper.get('label[for="quiz-include-similar-music"]').text(),
      ).toBe("providers.music_quiz.include_similar_music");
      expect(wrapper.text()).toContain(
        "providers.music_quiz.include_similar_music_help",
      );

      await wrapper.get(`[data-testid="create-${quizType}"]`).trigger("click");
      expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
        quiz_type: quizType,
        answer_type: answerType,
        config: {
          include_similar_music: false,
        },
      });

      await toggle.trigger("click");
      expect(toggle.attributes("aria-checked")).toBe("true");
      await wrapper.get(`[data-testid="create-${quizType}"]`).trigger("click");
      expect(wrapper.emitted("create")?.[1]?.[0]).toMatchObject({
        quiz_type: quizType,
        answer_type: answerType,
        config: {
          include_similar_music: true,
        },
      });
    },
  );

  it("preserves the shared choice between game types and resets fresh setup", async () => {
    const wrapper = mountWizard({ availableQuizTypes: ["trivia"] });

    await selectGame(wrapper, "game_type");
    await wrapper
      .get('[data-testid="quiz-include-similar-music"]')
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("back"))
      ?.trigger("click");
    await selectGame(wrapper, "trivia_type");

    expect(
      wrapper
        .get('[data-testid="quiz-include-similar-music"]')
        .attributes("aria-checked"),
    ).toBe("true");

    wrapper.unmount();
    const freshWrapper = mountWizard({ availableQuizTypes: ["trivia"] });
    await selectGame(freshWrapper, "timeline_type");
    expect(
      freshWrapper
        .get('[data-testid="quiz-include-similar-music"]')
        .attributes("aria-checked"),
    ).toBe("false");
  });
});

function mountWizard(
  props: { availableQuizTypes?: string[] } = {},
  attachToDocument = false,
) {
  return mount(MusicQuizSetupWizard, {
    props: { busy: false, ...props },
    ...(attachToDocument ? { attachTo: document.body } : {}),
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

async function selectGame(
  wrapper: ReturnType<typeof mountWizard>,
  label: string,
) {
  await wrapper
    .findAll("section button")
    .find((button) => button.text().includes(label))
    ?.trigger("click");
  await nextTick();
}
