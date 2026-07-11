import HitsterSetup from "@/components/music-quiz/game-types/hitster/HitsterSetup.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
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

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

async function flushPromises() {
  await Promise.resolve();
  await nextTick();
}

describe("HitsterSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockSearch.mockResolvedValue({
      tracks: [
        {
          uri: "track:test",
          name: "Test track",
          media_type: MediaType.TRACK,
        },
      ],
      playlists: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits only the Hitster configuration fields", async () => {
    const wrapper = mount(HitsterSetup, {
      props: { busy: false },
      global: {
        stubs: {
          Button: { template: "<button><slot /></button>" },
        },
      },
    });
    expect(wrapper.text()).not.toContain("providers.music_quiz.difficulty");
    expect(wrapper.text()).not.toContain("providers.music_quiz.answer_choices");

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test track"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toEqual({
      quiz_type: "hitster",
      answer_type: "timeline",
      config: {
        round_count: 5,
        answer_duration: 30,
        source_uris: ["track:test"],
        artist_bonus_mode: "off",
        title_bonus_mode: "off",
      },
    });
  });

  it("keeps the name optional and bonus modes independent", async () => {
    const wrapper = mount(HitsterSetup, {
      props: { busy: false },
      global: {
        stubs: {
          Button: { template: "<button><slot /></button>" },
        },
      },
    });

    await wrapper.get("#hitster-name").setValue("  Friday Hitster  ");
    await wrapper.get("#hitster-artist-bonus").setValue("free_text");
    await wrapper.get("#hitster-title-bonus").setValue("multiple_choice");
    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test track"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      config: {
        name: "Friday Hitster",
        artist_bonus_mode: "free_text",
        title_bonus_mode: "multiple_choice",
      },
    });
  });

  it("labels removable sources for keyboard and screen-reader users", async () => {
    const wrapper = mount(HitsterSetup, { props: { busy: false } });

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test track"))
      ?.trigger("click");

    expect(
      wrapper
        .find('button[aria-label="providers.music_quiz.remove_music_source"]')
        .exists(),
    ).toBe(true);
  });
});
