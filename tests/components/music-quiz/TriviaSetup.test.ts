import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  api: {
    providers: {},
    providerManifests: {},
    search: vi.fn(),
    getLibraryGenres: vi.fn(),
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
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

describe("TriviaSetup", () => {
  it("preserves selected sources and difficulty in the create request", async () => {
    const wrapper = mount(TriviaSetup, {
      props: { busy: false },
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

    await wrapper.get('[data-testid="select-sources"]').trigger("click");
    await wrapper.get("#trivia-difficulty").setValue("hard");
    await wrapper.get("#trivia-name").setValue("Friday Trivia");
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
            round_count: 5,
            suggestion_count: 4,
            answer_duration: 30,
            difficulty: "hard",
            source_uris: ["library://playlist/1", "library://genre/rock"],
            name: "Friday Trivia",
          },
        },
      ],
    ]);
  });

  it("omits a blank optional session name", async () => {
    const wrapper = mount(TriviaSetup, {
      props: { busy: false },
      global: {
        stubs: {
          MusicQuizSourceSelector: {
            template:
              "<button data-testid=\"select-sources\" @click=\"$emit('update:modelValue', ['library://playlist/1'])\" />",
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

    expect(wrapper.get("#trivia-name").element).toHaveProperty("value", "");
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
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "normal",
        source_uris: ["library://playlist/1"],
      },
    });
  });
});
