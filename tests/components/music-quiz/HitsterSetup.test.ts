import HitsterSetup from "@/components/music-quiz/game-types/hitster/HitsterSetup.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch, mockGetLibraryGenres } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGetLibraryGenres: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    providers: {},
    providerManifests: {},
    search: mockSearch,
    getLibraryGenres: mockGetLibraryGenres,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// helpers/utils transitively imports router/auth, which need a real browser
// environment; MediaSearch only needs getArtistsString from it
vi.mock("@/helpers/utils", () => ({
  getArtistsString: (artists?: Array<{ name: string }>) =>
    artists?.map((artist) => artist.name).join(" / ") || "",
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
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSearch.mockResolvedValue({
      tracks: [],
      playlists: [
        {
          uri: "playlist:test",
          name: "Test playlist",
          media_type: MediaType.PLAYLIST,
        },
      ],
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
    expect(wrapper.find("#hitster-name").exists()).toBe(false);

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
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
        source_uris: ["playlist:test"],
        artist_bonus_mode: "off",
        title_bonus_mode: "off",
      },
    });
  });

  it("keeps bonus modes independent without adding a name", async () => {
    const wrapper = mount(HitsterSetup, {
      props: { busy: false },
      global: {
        stubs: {
          Button: { template: "<button><slot /></button>" },
        },
      },
    });

    await wrapper.get("#hitster-artist-bonus").setValue("free_text");
    await wrapper.get("#hitster-title-bonus").setValue("multiple_choice");
    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    const request = wrapper.emitted("create")?.[0]?.[0];
    expect(request).toMatchObject({
      config: {
        artist_bonus_mode: "free_text",
        title_bonus_mode: "multiple_choice",
      },
    });
    expect(request).not.toHaveProperty("config.name");
  });

  it("labels removable sources for keyboard and screen-reader users", async () => {
    const wrapper = mount(HitsterSetup, { props: { busy: false } });

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");

    expect(
      wrapper
        .find('button[aria-label="providers.music_quiz.remove_music_source"]')
        .exists(),
    ).toBe(true);
  });
});
