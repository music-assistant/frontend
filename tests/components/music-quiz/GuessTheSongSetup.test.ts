import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  MediaType,
  type Genre,
  type Playlist,
  type SearchResults,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

type DeferredSearch = {
  promise: Promise<SearchResults>;
  resolve: (value: SearchResults) => void;
};

function deferredSearch(): DeferredSearch {
  let resolvePromise: (value: SearchResults) => void = () => {};
  const promise = new Promise<SearchResults>((resolve) => {
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

function mountConfig(includeSimilarMusic = false, sharedConfigValid = true) {
  return mount(GuessTheSongSetup, {
    props: { busy: false, includeSimilarMusic, sharedConfigValid },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
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

function playlistResult(uri: string, name: string): Playlist {
  return {
    item_id: uri,
    provider: "library",
    name,
    uri,
    is_playable: true,
    media_type: MediaType.PLAYLIST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    owner: "",
    is_editable: false,
    supported_mediatypes: [],
    is_dynamic: false,
  };
}

function genreResult(uri: string, name: string): Genre {
  return {
    item_id: uri,
    provider: "library",
    name,
    uri,
    is_playable: false,
    media_type: MediaType.GENRE,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    genre_aliases: null,
  };
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

    newSearch.resolve(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:new", "Newest result")],
      }),
    );
    await flushPromises();
    expect(wrapper.text()).toContain("Newest result");

    oldSearch.resolve(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:old", "Older result")],
      }),
    );
    await flushPromises();

    expect(wrapper.text()).toContain("Newest result");
    expect(wrapper.text()).not.toContain("Older result");
  });

  it("emits a name-free discriminated create request", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:test", "Test playlist")],
      }),
    );

    const wrapper = mountConfig();
    expect(wrapper.find("#quiz-name").exists()).toBe(false);

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
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      config: {
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "normal",
        source_uris: ["playlist:test"],
        include_similar_music: false,
      },
    });
  });

  it("blocks create when shared setup is invalid", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:test", "Test playlist")],
      }),
    );
    const wrapper = mountConfig(false, false);

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

  it("hides already selected items from the search results", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:test", "Test playlist")],
      }),
    );
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
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:test", "Test playlist")],
        genres: [genreResult("genre:rock", "Rock")],
      }),
    );
    const wrapper = mountConfig(true);

    const searchInput = wrapper.find(
      'input[placeholder="providers.music_quiz.search_music"]',
    );
    await searchInput.setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test playlist"))
      ?.trigger("click");
    // picking a result clears the search, so search again for the next pick
    await searchInput.setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Rock"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      config: {
        source_uris: ["playlist:test", "genre:rock"],
        include_similar_music: true,
      },
    });
  });

  it("removes a selected source when its chip is clicked", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [playlistResult("playlist:test", "Test playlist")],
      }),
    );
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
