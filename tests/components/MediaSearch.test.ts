import MediaSearch from "@/components/MediaSearch.vue";
import {
  MediaType,
  type Album,
  type Artist,
  type Genre,
  type ItemMapping,
  type Playlist,
  type SearchResults,
  type Track,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../fixtures/track";
import { playlist } from "../fixtures/playlist";
import { genre } from "../fixtures/genre";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";

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

const MUSIC_QUIZ_SOURCE_MEDIA_TYPES = [
  MediaType.TRACK,
  MediaType.PLAYLIST,
  MediaType.GENRE,
  MediaType.ALBUM,
  MediaType.ARTIST,
];

async function flushPromises() {
  await Promise.resolve();
  await nextTick();
}

function mountSearch(
  props: Partial<InstanceType<typeof MediaSearch>["$props"]>,
) {
  return mount(MediaSearch, { props, attachTo: document.body });
}

// the results float in a popover portalled out of the wrapper, so they are only
// reachable through the document
function resultRows() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".media-search-result"),
  );
}

function resultsPanel() {
  return document.querySelector<HTMLElement>(".media-search-results");
}

/**
 * Pins the search box `bottom` pixels from the top of a `viewport`-tall window,
 * so a case can say how much room the panel has underneath it.
 */
function placeSearchBox(bottom: number, viewport: number) {
  vi.stubGlobal("innerHeight", viewport);
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (!this.matches('[data-slot="popover-anchor"]'))
        return original.call(this);
      return {
        top: bottom - 36,
        bottom,
        left: 0,
        right: 320,
        width: 320,
        height: 36,
        x: 0,
        y: bottom - 36,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
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

// an open results popover keeps document-level listeners and portalled nodes,
// so tear it down even when an assertion fails
enableAutoUnmount(afterEach);

describe("MediaSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    mockSearch.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
  });

  it("searches only the default-selected media types", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [],
        albums: [],
        artists: [],
      }),
    );
    const wrapper = mountSearch({
      allowedMediaTypes: MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
      defaultSelectedMediaTypes: [MediaType.PLAYLIST, MediaType.GENRE],
    });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);

    expect(mockSearch).toHaveBeenCalledWith(
      "test",
      [MediaType.PLAYLIST, MediaType.GENRE],
      8,
      ["library"],
    );
    vi.useRealTimers();
  });

  it("renders a result for each allowed media type", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [trackFixture({ uri: "track:1", name: "Some track" })],
        playlists: [
          playlistFixture({ uri: "playlist:1", name: "Some playlist" }),
        ],
        albums: [albumFixture({ uri: "album:1", name: "Some album" })],
        artists: [artistFixture({ uri: "artist:1", name: "Some artist" })],
        genres: [genreFixture({ uri: "genre:1", name: "Some genre" })],
      }),
    );
    const wrapper = mountSearch({
      allowedMediaTypes: MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
      defaultSelectedMediaTypes: MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
    });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(
      resultRows().map((result) => result.querySelector("strong")?.textContent),
    ).toEqual([
      "Some track",
      "Some playlist",
      "Some genre",
      "Some album",
      "Some artist",
    ]);
    vi.useRealTimers();
  });

  it("emits select with the chosen item", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [
          playlistFixture({ uri: "playlist:1", name: "Some playlist" }),
        ],
      }),
    );
    const wrapper = mountSearch({
      allowedMediaTypes: MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
      defaultSelectedMediaTypes: [MediaType.PLAYLIST],
    });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    resultRows()[0]!.click();
    await flushPromises();

    expect(wrapper.emitted("select")?.[0]?.[0]).toMatchObject({
      uri: "playlist:1",
      name: "Some playlist",
    });
    vi.useRealTimers();
  });

  it("hides excluded uris from the results", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [],
        playlists: [
          playlistFixture({ uri: "playlist:1", name: "Some playlist" }),
        ],
      }),
    );
    const wrapper = mountSearch({
      allowedMediaTypes: MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
      defaultSelectedMediaTypes: [MediaType.PLAYLIST],
      excludeUris: ["playlist:1"],
    });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(resultRows()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("collapses the same item from multiple providers", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [
          trackFixture({
            uri: "library://track/1",
            name: "Song",
            artists: [artistRef("Band")],
          }),
          trackFixture({
            uri: "spotify://track/9",
            name: "Song",
            artists: [artistRef("Band")],
          }),
        ],
        playlists: [
          playlistFixture({
            uri: "library://playlist/1",
            name: "Party",
          }),
          playlistFixture({
            uri: "spotify://playlist/9",
            name: "Party",
          }),
        ],
      }),
    );
    const wrapper = mountSearch({
      allowedMediaTypes: [MediaType.TRACK, MediaType.PLAYLIST],
    });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const rows = resultRows();
    // the duplicate track collapses, same-named playlists never do
    expect(
      rows.filter((row) => row.textContent?.includes("Song")),
    ).toHaveLength(1);
    expect(
      rows.filter((row) => row.textContent?.includes("Party")),
    ).toHaveLength(2);
    vi.useRealTimers();
  });

  it.each([
    { room: "too little", boxBottom: 560, viewport: 600, side: "top" },
    { room: "enough", boxBottom: 120, viewport: 900, side: "bottom" },
  ])(
    "opens the results $side of the search box when there is $room room below",
    async ({ boxBottom, viewport, side }) => {
      placeSearchBox(boxBottom, viewport);
      mockSearch.mockResolvedValue(
        searchResults({
          playlists: [
            playlistFixture({ uri: "playlist:1", name: "Some list" }),
          ],
        }),
      );
      const wrapper = mountSearch({
        allowedMediaTypes: [MediaType.PLAYLIST],
      });

      await wrapper.find("input").setValue("test");
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();

      expect(resultsPanel()?.getAttribute("data-side")).toBe(side);
      vi.useRealTimers();
    },
  );

  it("collapses duplicates of a track that lists no artists", async () => {
    mockSearch.mockResolvedValue(
      searchResults({
        tracks: [
          trackFixture({
            uri: "library://track/1",
            name: "Untitled",
            artists: [],
          }),
          trackFixture({
            uri: "spotify://track/9",
            name: "Untitled",
            artists: [],
          }),
        ],
      }),
    );
    const wrapper = mountSearch({ allowedMediaTypes: [MediaType.TRACK] });

    await wrapper.find("input").setValue("test");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(
      resultRows().filter((row) => row.textContent?.includes("Untitled")),
    ).toHaveLength(1);

    vi.useRealTimers();
  });
});

// keep the fixture's provider in step with its uri, so the dedupe cases really
// do carry results from two different providers
function providerOf(uri: string): string {
  const [scheme] = uri.split("://");
  return scheme === uri ? "library" : scheme;
}

function artistRef(name: string): ItemMapping {
  return {
    available: true,
    is_playable: true,
    item_id: name,
    media_type: MediaType.ARTIST,
    name,
    provider: "library",
    version: "",
    uri: `library://artist/${name}`,
    external_ids: [],
  };
}

function trackFixture(
  overrides: Omit<Partial<Track>, "item_id" | "provider"> & Pick<Track, "uri">,
): Track {
  return track({
    ...overrides,
    item_id: overrides.uri,
    provider: providerOf(overrides.uri),
  });
}

function playlistFixture(
  overrides: Omit<Partial<Playlist>, "item_id" | "provider"> &
    Pick<Playlist, "uri">,
): Playlist {
  return playlist({
    ...overrides,
    item_id: overrides.uri,
    provider: providerOf(overrides.uri),
  });
}

function albumFixture(
  overrides: Omit<Partial<Album>, "item_id" | "provider"> & Pick<Album, "uri">,
): Album {
  return album({
    ...overrides,
    item_id: overrides.uri,
    provider: providerOf(overrides.uri),
  });
}

function artistFixture(
  overrides: Omit<Partial<Artist>, "item_id" | "provider"> &
    Pick<Artist, "uri">,
): Artist {
  return artist({
    ...overrides,
    item_id: overrides.uri,
    provider: providerOf(overrides.uri),
  });
}

function genreFixture(
  overrides: Omit<Partial<Genre>, "item_id" | "provider"> & Pick<Genre, "uri">,
): Genre {
  return genre({
    ...overrides,
    item_id: overrides.uri,
    provider: providerOf(overrides.uri),
  });
}
