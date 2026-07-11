import MediaSearch from "@/components/MediaSearch.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("MediaSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
  });

  it("searches only the default-selected media types", async () => {
    mockSearch.mockResolvedValue({
      tracks: [],
      playlists: [],
      albums: [],
      artists: [],
    });
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
    mockSearch.mockResolvedValue({
      tracks: [{ uri: "track:1", name: "Some track", media_type: "track" }],
      playlists: [
        { uri: "playlist:1", name: "Some playlist", media_type: "playlist" },
      ],
      albums: [{ uri: "album:1", name: "Some album", media_type: "album" }],
      artists: [{ uri: "artist:1", name: "Some artist", media_type: "artist" }],
      genres: [{ uri: "genre:1", name: "Some genre", media_type: "genre" }],
    });
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
    mockSearch.mockResolvedValue({
      tracks: [],
      playlists: [
        { uri: "playlist:1", name: "Some playlist", media_type: "playlist" },
      ],
    });
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
    mockSearch.mockResolvedValue({
      tracks: [],
      playlists: [
        { uri: "playlist:1", name: "Some playlist", media_type: "playlist" },
      ],
    });
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
    mockSearch.mockResolvedValue({
      tracks: [
        {
          uri: "library://track/1",
          name: "Song",
          media_type: "track",
          artists: [{ name: "Band" }],
        },
        {
          uri: "spotify://track/9",
          name: "Song",
          media_type: "track",
          artists: [{ name: "Band" }],
        },
      ],
      playlists: [
        { uri: "library://playlist/1", name: "Party", media_type: "playlist" },
        { uri: "spotify://playlist/9", name: "Party", media_type: "playlist" },
      ],
    });
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
});
