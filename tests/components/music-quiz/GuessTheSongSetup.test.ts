import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
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

type ResultItem = { uri: string; name: string; media_type: MediaType };

type SearchResult = {
  tracks: ResultItem[];
  playlists: ResultItem[];
  albums?: ResultItem[];
  artists?: ResultItem[];
  genres?: ResultItem[];
};

type DeferredSearch = {
  promise: Promise<SearchResult>;
  resolve: (value: SearchResult) => void;
};

function deferredSearch(): DeferredSearch {
  let resolvePromise: (value: SearchResult) => void = () => {};
  const promise = new Promise<SearchResult>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await nextTick();
}

function mountConfig() {
  return mount(GuessTheSongSetup, {
    props: { busy: false },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
}

describe("GuessTheSongSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the latest source-search result when older requests finish later", async () => {
    const oldSearch = deferredSearch();
    const newSearch = deferredSearch();
    mockSearch.mockImplementation((query: string) =>
      query === "old" ? oldSearch.promise : newSearch.promise,
    );

    const wrapper = mountConfig();

    const searchInput = wrapper.find(
      'input[placeholder="providers.music_quiz.search_music"]',
    );
    await searchInput.setValue("old");
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSearch).toHaveBeenCalledWith(
      "old",
      [MediaType.PLAYLIST, MediaType.GENRE],
      8,
      ["library"],
    );

    await searchInput.setValue("new");
    await vi.advanceTimersByTimeAsync(300);
    expect(mockSearch).toHaveBeenCalledWith(
      "new",
      [MediaType.PLAYLIST, MediaType.GENRE],
      8,
      ["library"],
    );

    newSearch.resolve({
      tracks: [],
      playlists: [
        {
          uri: "playlist:new",
          name: "Newest result",
          media_type: MediaType.PLAYLIST,
        },
      ],
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Newest result");

    oldSearch.resolve({
      tracks: [],
      playlists: [
        {
          uri: "playlist:old",
          name: "Older result",
          media_type: MediaType.PLAYLIST,
        },
      ],
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Newest result");
    expect(wrapper.text()).not.toContain("Older result");
  });

  it("emits a discriminated create request", async () => {
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
    const wrapper = mountConfig();

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

    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      config: {
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "normal",
        source_uris: ["playlist:test"],
      },
    });
  });

  it("hides already selected items from the search results", async () => {
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
    const wrapper = mountConfig();

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    await flushPromises();

    // still selected (removable) but no longer offered as a search result
    const resultButtons = wrapper
      .findAll(".media-search-result")
      .filter((button) => button.text().includes("Test playlist"));
    expect(resultButtons).toHaveLength(0);
    expect(wrapper.text()).toContain("Test playlist");
  });

  it("emits source uris for a playlist and a genre together", async () => {
    mockSearch.mockResolvedValue({
      tracks: [],
      playlists: [
        {
          uri: "playlist:test",
          name: "Test playlist",
          media_type: MediaType.PLAYLIST,
        },
      ],
      genres: [
        { uri: "genre:rock", name: "Rock", media_type: MediaType.GENRE },
      ],
    });
    const wrapper = mountConfig();

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
      .find((button) => button.text().includes("Rock"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      config: { source_uris: ["playlist:test", "genre:rock"] },
    });
  });

  it("removes a selected source when its chip is clicked", async () => {
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
    const wrapper = mountConfig();

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    await flushPromises();

    // remove via the selected-source chip (not the search-result entry)
    await wrapper
      .findAll("button.bg-muted")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain(
      "providers.music_quiz.pick_at_least_one_source",
    );
  });
});
