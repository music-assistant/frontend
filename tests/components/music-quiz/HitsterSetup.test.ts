import HitsterSetup from "@/components/music-quiz/game-types/hitster/HitsterSetup.vue";
import MusicQuizSourcePicker from "@/components/music-quiz/MusicQuizSourcePicker.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    search: mockSearch,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

describe("HitsterSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockSearch.mockResolvedValue({
      tracks: [
        {
          uri: "library://track/dated",
          name: "Dated track",
          media_type: MediaType.TRACK,
          artists: [{ name: "Artist" }],
        },
      ],
      playlists: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits the exact Hitster configuration without a generated name", async () => {
    const wrapper = mount(HitsterSetup, { props: { busy: false } });
    const createButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"));

    expect(createButton?.attributes("disabled")).toBeDefined();

    await wrapper
      .get('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("dated");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Dated track"))
      ?.trigger("click");
    await wrapper.get("#hitster-artist-bonus").setValue("free_text");
    await wrapper.get("#hitster-title-bonus").setValue("multiple_choice");
    await createButton?.trigger("click");

    expect(wrapper.emitted("create")).toEqual([
      [
        {
          quiz_type: "hitster",
          answer_type: "timeline",
          config: {
            round_count: 5,
            answer_duration: 30,
            source_uris: ["library://track/dated"],
            artist_bonus_mode: "free_text",
            title_bonus_mode: "multiple_choice",
          },
        },
      ],
    ]);
  });

  it("trims an optional name and disables create while busy", async () => {
    const wrapper = mount(HitsterSetup, { props: { busy: false } });

    await wrapper.get("#hitster-name").setValue("  Decades  ");
    await wrapper
      .get('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("dated");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Dated track"))
      ?.trigger("click");
    await wrapper.setProps({ busy: true });

    const createButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"));
    expect(createButton?.attributes("disabled")).toBeDefined();
    await createButton?.trigger("click");
    expect(wrapper.emitted("create")).toBeUndefined();

    await wrapper.setProps({ busy: false });
    await createButton?.trigger("click");
    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      config: { name: "Decades" },
    });
  });

  it("does not overwrite an initial source model on mount", async () => {
    const updateModel = vi.fn();
    const wrapper = mount(MusicQuizSourcePicker, {
      props: {
        modelValue: ["library://playlist/existing"],
        "onUpdate:modelValue": updateModel,
      },
    });

    await nextTick();
    expect(updateModel).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
