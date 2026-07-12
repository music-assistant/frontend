import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import type { MusicQuizPlaybackOptions } from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/music-quiz/game_types", async () => {
  const { defineComponent, h, markRaw, ref } = await import("vue");
  const setupComponent = (quizType: string, answerType: string) =>
    defineComponent({
      props: {
        includeSimilarMusic: {
          type: Boolean,
          required: true,
        },
        sharedConfigValid: {
          type: Boolean,
          default: true,
        },
      },
      emits: ["create"],
      setup(props, { emit }) {
        const gameSetting = ref(0);
        return () =>
          h("div", [
            h(
              "button",
              {
                "data-testid": `change-${quizType}`,
                onClick: () => gameSetting.value++,
              },
              "Change setting",
            ),
            h(
              "span",
              { "data-testid": `setting-${quizType}` },
              String(gameSetting.value),
            ),
            h(
              "button",
              {
                "data-testid": `create-${quizType}`,
                disabled: !props.sharedConfigValid,
                onClick: () =>
                  emit("create", {
                    quiz_type: quizType,
                    answer_type: answerType,
                    config: {
                      source_uris: ["track:test"],
                      include_similar_music: props.includeSimilarMusic,
                      game_setting: gameSetting.value,
                    },
                  }),
              },
              "Create",
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
        icon: markRaw({ template: "<span />" }),
        requiresBackendAvailability: false,
        supportsListenIn: true,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: markRaw(setupComponent("guess_the_song", "multiple_choice")),
        },
      },
      {
        id: "music_timeline",
        answerType: "timeline",
        labelKey: "timeline_type",
        descriptionKey: "timeline_description",
        icon: markRaw({ template: "<span />" }),
        requiresBackendAvailability: false,
        supportsListenIn: true,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: markRaw(setupComponent("music_timeline", "timeline")),
        },
      },
      {
        id: "trivia",
        answerType: "multiple_choice",
        labelKey: "trivia_type",
        descriptionKey: "trivia_description",
        icon: markRaw({ template: "<span />" }),
        requiresBackendAvailability: true,
        supportsListenIn: false,
        revealPhaseLabelKey: "reveal",
        adapters: {
          setup: markRaw(setupComponent("trivia", "multiple_choice")),
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

const PLAYBACK_OPTIONS = {
  default_playback_mode: "venue",
  default_venue_player_id: "living-room",
  venue_available: true,
  remote_available: true,
  venue_players: [
    { player_id: "living-room", name: "Living Room" },
    { player_id: "kitchen", name: "Kitchen" },
  ],
} satisfies MusicQuizPlaybackOptions;

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

    const configureHeading = wrapper
      .findAll("h2")
      .find((heading) =>
        heading.text().includes("providers.music_quiz.configure_game"),
      );
    expect(configureHeading?.attributes("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(configureHeading?.element);

    const backButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("back"));
    backButton?.element.focus();
    await backButton?.trigger("click");
    await nextTick();

    const chooseHeading = wrapper
      .findAll("h2")
      .find((heading) =>
        heading.text().includes("providers.music_quiz.choose_game_type"),
      );
    expect(chooseHeading?.attributes("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(chooseHeading?.element);
    wrapper.unmount();
  });

  it.each(GAME_CASES)(
    "adds one shared playback payload without changing $quizType config",
    async ({ label, quizType, answerType }) => {
      const wrapper = mountWizard({
        availableQuizTypes: ["trivia"],
        playbackOptions: PLAYBACK_OPTIONS,
      });

      await selectGame(wrapper, label);

      expect(
        wrapper.findAll('[data-testid="music-quiz-playback-controls"]'),
      ).toHaveLength(1);
      expect(
        wrapper.get("#music-quiz-playback-venue").attributes("aria-checked"),
      ).toBe("true");
      expect(
        wrapper.get<HTMLSelectElement>("#music-quiz-venue-player").element
          .value,
      ).toBe("living-room");
      expect(wrapper.text()).not.toContain("Automatic");

      await wrapper
        .get('[data-testid="quiz-include-similar-music"]')
        .trigger("click");
      await wrapper.get(`[data-testid="create-${quizType}"]`).trigger("click");

      expect(wrapper.emitted("create")?.[0]?.[0]).toEqual({
        quiz_type: quizType,
        answer_type: answerType,
        playback_mode: "venue",
        venue_player_id: "living-room",
        config: {
          source_uris: ["track:test"],
          include_similar_music: true,
          game_setting: 0,
        },
      });

      await wrapper.get("#music-quiz-playback-remote").trigger("click");
      await wrapper.get(`[data-testid="create-${quizType}"]`).trigger("click");

      expect(wrapper.emitted("create")?.[1]?.[0]).toEqual({
        quiz_type: quizType,
        answer_type: answerType,
        playback_mode: "remote",
        venue_player_id: null,
        config: {
          source_uris: ["track:test"],
          include_similar_music: true,
          game_setting: 0,
        },
      });
    },
  );

  it("retains shared and per-game values while switching game types", async () => {
    const wrapper = mountWizard({
      availableQuizTypes: ["trivia"],
      playbackOptions: PLAYBACK_OPTIONS,
    });

    await selectGame(wrapper, "game_type");
    await wrapper
      .get('[data-testid="quiz-include-similar-music"]')
      .trigger("click");
    await wrapper.get('[data-testid="change-guess_the_song"]').trigger("click");
    await wrapper.get("#music-quiz-venue-player").setValue("kitchen");

    await goBack(wrapper);
    expect(
      wrapper.find('[data-testid="setting-guess_the_song"]').exists(),
    ).toBe(false);
    await selectGame(wrapper, "trivia_type");
    await wrapper.get('[data-testid="change-trivia"]').trigger("click");
    await wrapper.get('[data-testid="change-trivia"]').trigger("click");

    expect(
      wrapper
        .get('[data-testid="quiz-include-similar-music"]')
        .attributes("aria-checked"),
    ).toBe("true");
    expect(
      wrapper.get<HTMLSelectElement>("#music-quiz-venue-player").element.value,
    ).toBe("kitchen");
    expect(wrapper.get('[data-testid="setting-trivia"]').text()).toBe("2");

    await goBack(wrapper);
    await selectGame(wrapper, "game_type");

    expect(wrapper.get('[data-testid="setting-guess_the_song"]').text()).toBe(
      "1",
    );
    expect(
      wrapper.get<HTMLSelectElement>("#music-quiz-venue-player").element.value,
    ).toBe("kitchen");
  });

  it("resets from newly supplied server defaults in a fresh setup", async () => {
    const wrapper = mountWizard({ playbackOptions: PLAYBACK_OPTIONS });
    await selectGame(wrapper, "game_type");
    await wrapper.get("#music-quiz-venue-player").setValue("kitchen");
    wrapper.unmount();

    const freshOptions = {
      ...PLAYBACK_OPTIONS,
      default_playback_mode: "remote",
      default_venue_player_id: "kitchen",
    } satisfies MusicQuizPlaybackOptions;
    const freshWrapper = mountWizard({ playbackOptions: freshOptions });
    await selectGame(freshWrapper, "timeline_type");

    expect(
      freshWrapper
        .get("#music-quiz-playback-remote")
        .attributes("aria-checked"),
    ).toBe("true");
    expect(freshWrapper.find("#music-quiz-venue-player").exists()).toBe(false);
    expect(
      freshWrapper
        .get('[data-testid="quiz-include-similar-music"]')
        .attributes("aria-checked"),
    ).toBe("false");

    await freshWrapper.get("#music-quiz-playback-venue").trigger("click");
    expect(
      freshWrapper.get<HTMLSelectElement>("#music-quiz-venue-player").element
        .value,
    ).toBe("kitchen");
  });

  it("hides playback controls and omits fields for a legacy server", async () => {
    const wrapper = mountWizard();
    await selectGame(wrapper, "game_type");

    expect(
      wrapper.find('[data-testid="music-quiz-playback-controls"]').exists(),
    ).toBe(false);

    await wrapper.get('[data-testid="create-guess_the_song"]').trigger("click");
    const request = wrapper.emitted("create")?.[0]?.[0];

    expect(request).not.toHaveProperty("playback_mode");
    expect(request).not.toHaveProperty("venue_player_id");
  });

  it("blocks create while playback discovery is loading", async () => {
    const wrapper = mountWizard({ playbackOptionsLoading: true });
    await selectGame(wrapper, "game_type");

    expect(
      wrapper.find('[data-testid="music-quiz-playback-loading"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .get('[data-testid="create-guess_the_song"]')
        .attributes("disabled"),
    ).toBeDefined();

    await wrapper.get('[data-testid="create-guess_the_song"]').trigger("click");
    expect(wrapper.emitted("create")).toBeUndefined();
  });

  it("shows preparation progress without discarding setup state", async () => {
    const wrapper = mountWizard({ playbackOptions: PLAYBACK_OPTIONS }, true);
    await selectGame(wrapper, "game_type");
    await wrapper.get('[data-testid="change-guess_the_song"]').trigger("click");

    await wrapper.setProps({ busy: true });
    await nextTick();

    const status = wrapper.get('[data-testid="music-quiz-preparing"]');
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toContain("providers.music_quiz.preparing_game");
    expect(status.text()).toContain("providers.music_quiz.preparing_game_help");
    expect(document.activeElement).toBe(status.element);
    expect(
      wrapper.get('[data-testid="setting-guess_the_song"]').isVisible(),
    ).toBe(false);

    await wrapper.setProps({ busy: false });
    expect(wrapper.get('[data-testid="setting-guess_the_song"]').text()).toBe(
      "1",
    );
    wrapper.unmount();
  });

  it("disables Venue with the empty-player reason while Remote stays usable", async () => {
    const options = {
      default_playback_mode: "remote",
      default_venue_player_id: null,
      venue_available: true,
      remote_available: true,
      venue_players: [],
    } satisfies MusicQuizPlaybackOptions;
    const wrapper = mountWizard({ playbackOptions: options });
    await selectGame(wrapper, "game_type");

    expect(
      wrapper.get("#music-quiz-playback-venue").attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="music-quiz-venue-unavailable"]').text(),
    ).toBe("providers.music_quiz.no_available_speakers");
    expect(
      wrapper
        .get('[data-testid="create-guess_the_song"]')
        .attributes("disabled"),
    ).toBeUndefined();
  });

  it("shows a clear reason and disables create when no mode is available", async () => {
    const options = {
      default_playback_mode: "venue",
      default_venue_player_id: null,
      venue_available: false,
      remote_available: false,
      venue_players: [],
    } satisfies MusicQuizPlaybackOptions;
    const wrapper = mountWizard({ playbackOptions: options });
    await selectGame(wrapper, "timeline_type");

    expect(
      wrapper.get('[data-testid="music-quiz-no-playback-modes"]').text(),
    ).toBe("providers.music_quiz.no_playback_modes");
    expect(
      wrapper
        .get('[data-testid="create-music_timeline"]')
        .attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get("#music-quiz-venue-player").attributes("aria-invalid"),
    ).toBe("false");
  });

  it("requires a concrete eligible speaker for Venue", async () => {
    const options = {
      ...PLAYBACK_OPTIONS,
      default_venue_player_id: null,
    } satisfies MusicQuizPlaybackOptions;
    const wrapper = mountWizard({ playbackOptions: options });
    await selectGame(wrapper, "game_type");

    const createButton = wrapper.get('[data-testid="create-guess_the_song"]');
    expect(createButton.attributes("disabled")).toBeDefined();

    await wrapper.get("#music-quiz-venue-player").setValue("living-room");
    expect(createButton.attributes("disabled")).toBeUndefined();
  });
});

function mountWizard(
  props: {
    availableQuizTypes?: string[];
    playbackOptions?: MusicQuizPlaybackOptions | null;
    playbackOptionsLoading?: boolean;
  } = {},
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

async function goBack(wrapper: ReturnType<typeof mountWizard>) {
  await wrapper
    .findAll("button")
    .find((button) => button.text().includes("back"))
    ?.trigger("click");
  await nextTick();
}
