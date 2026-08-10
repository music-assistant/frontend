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
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  return mount(MediaSearch, { props });
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

describe("MediaSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
      wrapper
        .findAll(".media-search-result")
        .map((result) => result.find("strong").text()),
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
    await wrapper.find(".media-search-result").trigger("click");

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

    expect(wrapper.find(".media-search-result").exists()).toBe(false);
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

    const rows = wrapper.findAll(".media-search-result");
    // the duplicate track collapses, same-named playlists never do
    expect(rows.filter((row) => row.text().includes("Song"))).toHaveLength(1);
    expect(rows.filter((row) => row.text().includes("Party"))).toHaveLength(2);
    vi.useRealTimers();
  });

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

    const rows = wrapper.findAll(".media-search-result");
    expect(rows.filter((row) => row.text().includes("Untitled"))).toHaveLength(
      1,
    );

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
