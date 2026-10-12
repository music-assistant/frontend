import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { getLocaleOptions } from "@/plugins/i18n";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openSelect,
  pickSelectOption,
  selectOptions,
} from "../../fixtures/rekaSelect";

const { mockI18n } = vi.hoisted(() => ({
  mockI18n: {
    global: {
      locale: { value: "en" },
      availableLocales: ["de", "en", "en_AU", "pt_BR", "sr", "sr_Latn"],
    },
  },
}));

vi.mock("@/plugins/api", () => ({
  api: {
    providers: {},
    providerManifests: {},
    search: vi.fn<MusicAssistantApi["search"]>(),
    getLibraryGenres: vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
  },
}));

vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
  i18n: mockI18n,
}));

vi.mock("@/helpers/utils", () => ({
  getArtistsString: (artists?: Array<{ name: string }>) =>
    artists?.map((artist) => artist.name).join(" / ") || "",
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    template: "<div />",
  },
}));

// the select listboxes are portalled out of the wrapper, so tear them down even
// when an assertion fails
enableAutoUnmount(afterEach);

// the localized label reka shows for a locale, so a test can pick it by sight
const localeLabels = () =>
  getLocaleOptions(
    mockI18n.global.availableLocales,
    mockI18n.global.locale.value,
  );
const localeLabel = (locale: string) =>
  localeLabels().find((option) => option.value === locale)!.label;

describe("TriviaSetup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockI18n.global.locale.value = "en";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves selected sources, difficulty, and language in the create request", async () => {
    const wrapper = mountSetup(true);

    await wrapper.get('[data-testid="select-sources"]').trigger("click");
    await pickSelectOption(
      wrapper,
      "#trivia-difficulty",
      "providers.music_quiz.difficulty_hard",
    );
    await pickSelectOption(wrapper, "#trivia-language", localeLabel("sr_Latn"));
    await nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")).toEqual([
      [
        {
          quiz_type: "trivia",
          answer_type: "multiple_choice",
          config: {
            language: "sr-Latn",
            play_reveal_audio: true,
            round_count: 5,
            suggestion_count: 4,
            answer_duration: 30,
            difficulty: "hard",
            source_uris: ["library://playlist/1", "library://genre/rock"],
            include_similar_music: true,
          },
        },
      ],
    ]);
  });

  it("never renders or emits a session name", async () => {
    const wrapper = mountSetup();

    expect(wrapper.find("#trivia-name").exists()).toBe(false);
    await wrapper.get('[data-testid="select-sources"]').trigger("click");
    await nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toEqual({
      quiz_type: "trivia",
      answer_type: "multiple_choice",
      config: {
        language: "en",
        play_reveal_audio: true,
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "normal",
        source_uris: ["library://playlist/1", "library://genre/rock"],
        include_similar_music: false,
      },
    });
  });

  it("blocks create when shared setup is invalid", async () => {
    const wrapper = mountSetup(false, false);

    await wrapper.get('[data-testid="select-sources"]').trigger("click");
    await nextTick();
    const createButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"));

    expect(createButton?.attributes("disabled")).toBeDefined();
    await createButton?.trigger("click");
    expect(wrapper.emitted("create")).toBeUndefined();
  });

  it("defaults reveal audio on and emits an explicit disabled value", async () => {
    const wrapper = mountSetup();
    const toggle = wrapper.get('[data-testid="trivia-play-reveal-audio"]');

    expect(toggle.attributes("data-state")).toBe("checked");

    await toggle.trigger("click");
    await wrapper.get('[data-testid="select-sources"]').trigger("click");
    await nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(toggle.attributes("data-state")).toBe("unchecked");
    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      quiz_type: "trivia",
      config: {
        play_reveal_audio: false,
      },
    });
  });

  it("defaults to the current effective UI locale", () => {
    mockI18n.global.locale.value = "pt_BR";
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");

    const wrapper = mountSetup();

    expect(wrapper.get("#trivia-language").text()).toBe(localeLabel("pt_BR"));
  });

  it("offers only shipped locales with localized, predictable labels", async () => {
    mockI18n.global.locale.value = "de";
    const wrapper = mountSetup();
    const options = localeLabels();
    const labelByValue = Object.fromEntries(
      options.map((option) => [option.value, option.label]),
    );

    // the listbox renders every option the helper offers, in its order
    await openSelect(wrapper, "#trivia-language");
    expect(selectOptions().map((option) => option.textContent?.trim())).toEqual(
      options.map((option) => option.label),
    );
    const displayNames = new Intl.DisplayNames(["de"], {
      type: "language",
      fallback: "code",
      languageDisplay: "dialect",
    });

    expect(options.map((option) => option.value).sort()).toEqual(
      [...mockI18n.global.availableLocales].sort(),
    );
    expect(labelByValue).toMatchObject({
      de: displayNames.of("de"),
      en: displayNames.of("en"),
      en_AU: displayNames.of("en-AU"),
      pt_BR: displayNames.of("pt-BR"),
      sr: displayNames.of("sr"),
      sr_Latn: displayNames.of("sr-Latn"),
    });
    expect(labelByValue.en_AU).not.toBe(labelByValue.en);
    expect(labelByValue.sr_Latn).not.toBe(labelByValue.sr);
    expect(options.map((option) => option.label)).toEqual(
      options
        .map((option) => option.label)
        .toSorted(new Intl.Collator("de", { sensitivity: "base" }).compare),
    );
  });
});

function mountSetup(includeSimilarMusic = false, sharedConfigValid = true) {
  return mount(TriviaSetup, {
    props: { busy: false, includeSimilarMusic, sharedConfigValid },
    global: {
      stubs: {
        MusicQuizSourceSelector: {
          template:
            "<button data-testid=\"select-sources\" @click=\"$emit('update:modelValue', ['library://playlist/1', 'library://genre/rock'])\" />",
        },
        NumberField: {
          template: "<div><slot /></div>",
        },
        NumberFieldContent: {
          template: "<div><slot /></div>",
        },
        NumberFieldDecrement: true,
        NumberFieldIncrement: true,
        NumberFieldInput: true,
      },
    },
  });
}
