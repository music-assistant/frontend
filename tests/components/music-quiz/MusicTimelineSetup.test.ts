import MusicTimelineSetup from "@/components/music-quiz/game-types/music-timeline/MusicTimelineSetup.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { SearchResults } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../../fixtures/playlist";

const { mockSearch, mockGetLibraryGenres } = vi.hoisted(() => ({
  mockSearch: vi.fn<MusicAssistantApi["search"]>(),
  mockGetLibraryGenres: vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
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

// api.search always returns every result list, so fill the ones a case does not
// exercise rather than letting a partial mock stand in for a server response
const searchResults = (lists: Partial<SearchResults> = {}): SearchResults => ({
  artists: [],
  albums: [],
  tracks: [],
  playlists: [],
  radio: [],
  podcasts: [],
  audiobooks: [],
  genres: [],
  ...lists,
});

const mountTimeline = (
  props: Partial<InstanceType<typeof MusicTimelineSetup>["$props"]> = {},
) =>
  mount(MusicTimelineSetup, {
    props: { busy: false, includeSimilarMusic: false, ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: { template: "<button><slot /></button>" },
      },
    },
  });

describe("MusicTimelineSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlist({ uri: "playlist:test", name: "Test playlist" })],
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits only the Music Timeline configuration fields", async () => {
    const wrapper = mountTimeline();

    expect(wrapper.text()).not.toContain("providers.music_quiz.difficulty");
    expect(wrapper.text()).not.toContain("providers.music_quiz.answer_choices");
    expect(wrapper.find("#music-timeline-name").exists()).toBe(false);

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
      quiz_type: "music_timeline",
      answer_type: "timeline",
      config: {
        round_count: 5,
        answer_duration: 30,
        source_uris: ["playlist:test"],
        include_similar_music: false,
        artist_bonus_mode: "off",
        title_bonus_mode: "off",
      },
    });
  });

  it("blocks create when shared setup is invalid", async () => {
    const wrapper = mountTimeline({ sharedConfigValid: false });

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    const createButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"));

    expect(createButton?.attributes("disabled")).toBeDefined();
    await createButton?.trigger("click");
    expect(wrapper.emitted("create")).toBeUndefined();
  });

  it("keeps bonus modes independent without adding a name", async () => {
    const wrapper = mountTimeline({ includeSimilarMusic: true });

    await wrapper.get("#music-timeline-artist-bonus").setValue("free_text");
    await wrapper
      .get("#music-timeline-title-bonus")
      .setValue("multiple_choice");
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
        include_similar_music: true,
        artist_bonus_mode: "free_text",
        title_bonus_mode: "multiple_choice",
      },
    });
    expect(request).not.toHaveProperty("config.name");
  });

  it("labels removable sources for keyboard and screen-reader users", async () => {
    const wrapper = mountTimeline();

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
