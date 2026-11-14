import {
  ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  type ArtistRowId,
} from "@/components/artist/artistRows";
import { DISCOGRAPHY_TYPES_PREFERENCE_KEY } from "@/components/artist/discographyRows";
import type { RowSource } from "@/components/details/rowRegistry";
import { useArtistRowData } from "@/composables/useArtistRowData";
import {
  AlbumType,
  ArtistType,
  EventType,
  ProviderFeature,
  ProviderType,
  SortDirection,
  SortField,
  type Album,
  type Artist,
  type EventMessage,
  type Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { providerMapping } from "../fixtures/providerMapping";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const {
  mockApi,
  mockLoadArtistReleases,
  mockArtistAlbumsCountBySource,
  mockLoadArtistAppearsOn,
  mockLoadArtistAppearsOnCount,
  mockLoadArtistDiscography,
  mockLoadArtistDiscographyCount,
  mockLoadArtistTracks,
  mockLoadArtistTracksCount,
  mockLoadArtistTopTracks,
  mockLoadSimilarArtists,
} = vi.hoisted(() => ({
  mockApi: {
    getProvider: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    subscribe_multi: vi.fn<
      (events: EventType[], callback: (evt: EventMessage) => void) => () => void
    >(() => () => {}),
    providers: {} as Record<string, unknown>,
  },
  mockLoadArtistReleases:
    vi.fn<typeof import("@/components/artist/artistData").loadArtistReleases>(),
  mockArtistAlbumsCountBySource: vi.fn(),
  mockLoadArtistAppearsOn: vi.fn<(artist: Artist) => Promise<Album[]>>(),
  mockLoadArtistAppearsOnCount: vi.fn<(artist: Artist) => Promise<number>>(),
  mockLoadArtistDiscography:
    vi.fn<
      typeof import("@/components/artist/artistData").loadArtistDiscography
    >(),
  mockLoadArtistDiscographyCount:
    vi.fn<(artist: Artist, albumTypes?: AlbumType[]) => Promise<number>>(),
  mockLoadArtistTracks: vi.fn<(artist: Artist) => Promise<Track[]>>(),
  mockLoadArtistTracksCount: vi.fn<(artist: Artist) => Promise<number>>(),
  mockLoadArtistTopTracks:
    vi.fn<(artist: Artist, source: RowSource) => Promise<Track[]>>(),
  mockLoadSimilarArtists:
    vi.fn<(artist: Artist, source: RowSource) => Promise<Artist[]>>(),
}));

vi.mock("@/plugins/api", () => ({ api: mockApi, default: mockApi }));

// the loaders are mocked, the pure helpers (sorting, single/EP and appearance
// checks) are the real ones so the rows are derived the way they are in the app
vi.mock("@/components/artist/artistData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/artist/artistData")>()),
  loadArtistReleases: mockLoadArtistReleases,
  artistAlbumsCountBySource: mockArtistAlbumsCountBySource,
  loadArtistAppearsOn: mockLoadArtistAppearsOn,
  loadArtistAppearsOnCount: mockLoadArtistAppearsOnCount,
  loadArtistDiscography: mockLoadArtistDiscography,
  loadArtistDiscographyCount: mockLoadArtistDiscographyCount,
  loadArtistTracks: mockLoadArtistTracks,
  loadArtistTracksCount: mockLoadArtistTracksCount,
  loadArtistTopTracks: mockLoadArtistTopTracks,
  loadSimilarArtists: mockLoadSimilarArtists,
}));

const SPOTIFY = "spotify--abc";

// one album and one single, so the album and the singles row each get an item
const RELEASES: Album[] = [
  album({ item_id: "album-1" }),
  album({ item_id: "single-1", album_type: AlbumType.SINGLE }),
];

const scopes: EffectScope[] = [];

function libraryArtist(overrides: Partial<Artist> = {}): Artist {
  return artist({
    item_id: "artist-1",
    provider: "library",
    provider_mappings: [providerMapping({ provider_instance: SPOTIFY })],
    ...overrides,
  });
}

/** The composable, with the rows the page shows and no artist loaded yet. */
function setupRowData(options: { rows: ArtistRowId[] }) {
  const artistRef = ref<Artist>();
  const visibleRows = ref<ArtistRowId[]>(options.rows);
  const scope = effectScope();
  scopes.push(scope);
  const rowData = scope.run(() => useArtistRowData(artistRef, visibleRows))!;
  return { artist: artistRef, visibleRows, ...rowData };
}

type RowData = ReturnType<typeof setupRowData>;

/** Puts an artist on the page, the way the view does once its details load. */
async function showArtist(page: RowData, item: Artist) {
  page.artist.value = item;
  await flushPromises();
}

/** The user's saved per-row sources, which the editor writes and rows follow. */
function saveRowSources(sources: Partial<Record<ArtistRowId, RowSource>>) {
  store.currentUser = user({
    preferences: { [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: sources },
  });
}

/** The source of every release request that was issued, in order. */
function releaseSources(): RowSource[] {
  return mockLoadArtistReleases.mock.calls.map(([, source]) => source);
}

/** The release types of every discography request that was issued, in order. */
function discographyTypeRequests(): Array<AlbumType[] | undefined> {
  return mockLoadArtistDiscography.mock.calls.map(([, types]) => types);
}

function itemIds(items?: Array<{ item_id: string }>): string[] | undefined {
  return items?.map((item) => item.item_id);
}

describe("useArtistRowData", () => {
  beforeEach(() => {
    // a row only offers a provider that can supply it, so the saved album
    // source below is one the artist can actually be fed from
    mockApi.providers = {
      [SPOTIFY]: {
        instance_id: SPOTIFY,
        name: "Spotify",
        domain: "spotify",
        type: ProviderType.MUSIC,
        supported_features: [ProviderFeature.ARTIST_ALBUMS],
      },
    };
    mockApi.getProvider.mockReset();
    mockLoadArtistReleases.mockReset().mockResolvedValue([]);
    mockArtistAlbumsCountBySource.mockReset().mockResolvedValue(1);
    mockLoadArtistAppearsOn.mockReset().mockResolvedValue([]);
    mockLoadArtistAppearsOnCount.mockReset().mockResolvedValue(0);
    mockLoadArtistDiscography.mockReset().mockResolvedValue([]);
    mockLoadArtistDiscographyCount.mockReset().mockResolvedValue(0);
    mockLoadArtistTracks.mockReset().mockResolvedValue([]);
    mockLoadArtistTracksCount.mockReset().mockResolvedValue(0);
    mockLoadArtistTopTracks.mockReset().mockResolvedValue([]);
    mockLoadSimilarArtists.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    store.currentUser = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requests the newest 50 of each shelf's types, with a count of the same types", async () => {
    const page = setupRowData({ rows: ["albums", "singles_eps"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    mockArtistAlbumsCountBySource
      .mockResolvedValueOnce(102)
      .mockResolvedValueOnce(60);

    await showArtist(page, libraryArtist());

    const albumTypes = [
      AlbumType.ALBUM,
      AlbumType.COMPILATION,
      AlbumType.LIVE,
      AlbumType.SOUNDTRACK,
      AlbumType.UNKNOWN,
    ];
    const singleTypes = [AlbumType.SINGLE, AlbumType.EP];
    const listing = {
      limit: 50,
      sortField: SortField.RELEASE_DATE,
      sortDirection: SortDirection.DESC,
    };
    expect(
      mockLoadArtistReleases.mock.calls.map(([, , options]) => options),
    ).toEqual([
      { ...listing, albumTypes },
      { ...listing, albumTypes: singleTypes },
    ]);
    expect(
      mockArtistAlbumsCountBySource.mock.calls.map(([, , types]) => types),
    ).toEqual([albumTypes, singleTypes]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
    expect(itemIds(page.singleItems.value)).toEqual(["single-1"]);
    expect(page.albumsCount.value).toBe(102);
    expect(page.singlesCount.value).toBe(60);
  });

  it("requests a source switched to once, and serves the old one from the cache", async () => {
    const page = setupRowData({ rows: ["albums"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    await showArtist(page, libraryArtist());

    mockLoadArtistReleases.mockResolvedValue([album({ item_id: "album-2" })]);
    saveRowSources({ albums: SPOTIFY });
    await flushPromises();

    expect(releaseSources()).toEqual(["library", SPOTIFY]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-2"]);
    expect(page.albumsCount.value).toBe(1);

    saveRowSources({});
    await flushPromises();

    expect(releaseSources()).toEqual(["library", SPOTIFY]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
    expect(page.albumsCount.value).toBe(1);
  });

  it("requests no releases when only top tracks shows", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistReleases).not.toHaveBeenCalled();
  });

  it("drops a response that arrives after the artist changed", async () => {
    const page = setupRowData({ rows: ["albums"] });
    let resolveFirst: (albums: Album[]) => void = () => {};
    mockLoadArtistReleases.mockImplementationOnce(
      () =>
        new Promise<Album[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockLoadArtistReleases.mockResolvedValue([album({ item_id: "second" })]);

    await showArtist(page, libraryArtist());
    expect(page.albumItems.value).toBeUndefined();

    await showArtist(page, libraryArtist({ item_id: "artist-2" }));
    resolveFirst([album({ item_id: "first" })]);
    await flushPromises();

    expect(itemIds(page.albumItems.value)).toEqual(["second"]);
  });

  it("falls back to the newest library tracks when the source has no top tracks", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistTracks.mockResolvedValue([
      track({ item_id: "older", album: album({ year: 1999 }) }),
      track({ item_id: "newer", album: album({ year: 2024 }) }),
    ]);

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistTopTracks).toHaveBeenCalledTimes(1);
    expect(itemIds(page.topTracksItems.value)).toEqual(["newer", "older"]);
  });

  it("falls back to artist tracks when the top-tracks request fails", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockLoadArtistTopTracks.mockRejectedValueOnce(new Error("unavailable"));
    mockLoadArtistTracks.mockResolvedValue([
      track({ item_id: "library-track" }),
    ]);

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistTracks).toHaveBeenCalledTimes(1);
    expect(itemIds(page.topTracksItems.value)).toEqual(["library-track"]);
  });

  it("loads the fallback when a hidden top tracks row with no tracks is shown again", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    let resolveTopTracks!: (tracks: Track[]) => void;
    mockLoadArtistTopTracks.mockReturnValueOnce(
      new Promise<Track[]>((resolve) => {
        resolveTopTracks = resolve;
      }),
    );
    mockLoadArtistTracks.mockResolvedValue([
      track({ item_id: "library-fallback" }),
    ]);

    await showArtist(page, libraryArtist());
    page.visibleRows.value = [];
    await flushPromises();
    resolveTopTracks([]);
    await flushPromises();
    expect(mockLoadArtistTracks).not.toHaveBeenCalled();

    page.visibleRows.value = ["top_tracks"];
    await flushPromises();

    expect(mockLoadArtistTracks).toHaveBeenCalledTimes(1);
    expect(itemIds(page.topTracksItems.value)).toEqual(["library-fallback"]);
  });

  it("labels the top tracks row after the library when it uses that fallback", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistTracks.mockResolvedValue([track()]);

    await showArtist(page, libraryArtist());

    expect(page.topTracksSourceDisplay.value?.label).toBe("In your library");
  });

  it("does not fetch all artist tracks when top tracks are available", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistTopTracks.mockResolvedValue([track()]);

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistTracksCount).toHaveBeenCalledTimes(1);
    expect(mockLoadArtistTracks).not.toHaveBeenCalled();
  });

  it("keeps naming a provider artist's own provider when it uses that fallback", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistTracks.mockResolvedValue([track()]);
    mockApi.getProvider.mockReturnValue({ name: "Spotify", domain: "spotify" });

    await showArtist(page, artist({ item_id: "sp1", provider: SPOTIFY }));

    expect(itemIds(page.topTracksItems.value)).toHaveLength(1);
    expect(page.topTracksSourceDisplay.value).toEqual({
      label: "On Spotify",
      domain: "spotify",
    });
    expect(mockApi.getProvider).toHaveBeenCalledWith(SPOTIFY);
  });

  it("labels the top tracks row as all sources when a provider supplies them", async () => {
    const page = setupRowData({ rows: ["top_tracks"] });
    mockLoadArtistTopTracks.mockResolvedValue([track()]);

    await showArtist(page, libraryArtist());

    expect(page.topTracksSourceDisplay.value?.label).toBe("All sources");
  });

  it("names each release row's source", async () => {
    const page = setupRowData({ rows: ["albums"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    mockApi.getProvider.mockReturnValue({ name: "Spotify", domain: "spotify" });

    await showArtist(page, libraryArtist());
    expect(page.albumsSourceDisplay.value?.label).toBe("In your library");

    saveRowSources({ albums: SPOTIFY });
    await flushPromises();
    expect(page.albumsSourceDisplay.value).toEqual({
      label: "On Spotify",
      domain: "spotify",
    });
  });

  it("loads the appearances with a request of their own", async () => {
    const page = setupRowData({ rows: ["albums", "appears_on"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    mockLoadArtistAppearsOn.mockResolvedValue([album({ item_id: "guest" })]);

    await showArtist(page, libraryArtist());

    expect(itemIds(page.appearsOnItems.value)).toEqual(["guest"]);
    expect(mockLoadArtistAppearsOn).toHaveBeenCalledTimes(1);
    expect(releaseSources()).toEqual(["library"]);
    expect(mockLoadArtistTracks).not.toHaveBeenCalled();
  });

  it.each([
    ["album", album({ item_id: "added" })],
    ["track", track({ item_id: "added" })],
  ])("refetches the appearances after a %s is added", async (_type, added) => {
    vi.useFakeTimers();
    const page = setupRowData({ rows: ["appears_on"] });
    await showArtist(page, libraryArtist());
    mockLoadArtistAppearsOn.mockResolvedValue([album({ item_id: "guest" })]);
    const [, onLibraryChange] = mockApi.subscribe_multi.mock.lastCall!;

    onLibraryChange({ event: EventType.MEDIA_ITEM_ADDED, data: added });
    await vi.runAllTimersAsync();

    expect(mockLoadArtistAppearsOn).toHaveBeenCalledTimes(2);
    expect(itemIds(page.appearsOnItems.value)).toEqual(["guest"]);
  });

  it("feeds a provider artist's rows from its own provider", async () => {
    const page = setupRowData({ rows: ["albums", "singles_eps"] });

    await showArtist(
      page,
      artist({
        item_id: "artist-2",
        provider: SPOTIFY,
        provider_mappings: [providerMapping({ provider_instance: SPOTIFY })],
      }),
    );

    expect(releaseSources()).toEqual([SPOTIFY, SPOTIFY]);
  });

  it("loads the discography once and keeps the order it came in", async () => {
    const page = setupRowData({ rows: ["discography"] });
    mockLoadArtistDiscography.mockResolvedValue([
      album({ item_id: "newest" }),
      album({ item_id: "oldest" }),
    ]);

    await showArtist(page, libraryArtist());
    expect(itemIds(page.discographyItems.value)).toEqual(["newest", "oldest"]);

    // unhiding another row must not re-request what is already loaded
    page.visibleRows.value = ["discography", "albums"];
    await flushPromises();

    expect(mockLoadArtistDiscography).toHaveBeenCalledTimes(1);
  });

  it("refetches the album rows, not the track rows, after an album is added", async () => {
    vi.useFakeTimers();
    const page = setupRowData({
      rows: ["discography", "albums", "top_tracks"],
    });
    await showArtist(page, libraryArtist());
    mockLoadArtistDiscography.mockResolvedValue([album({ item_id: "added" })]);
    const [, onLibraryChange] = mockApi.subscribe_multi.mock.lastCall!;

    onLibraryChange({
      event: EventType.MEDIA_ITEM_ADDED,
      data: album({ item_id: "added" }),
    });
    await vi.runAllTimersAsync();

    expect(itemIds(page.discographyItems.value)).toEqual(["added"]);
    expect(mockLoadArtistReleases).toHaveBeenCalledTimes(2);
    expect(mockLoadArtistTopTracks).toHaveBeenCalledTimes(1);
    expect(mockLoadArtistTracks).toHaveBeenCalledTimes(1);
  });

  it("requests no discography when only other rows show", async () => {
    const page = setupRowData({ rows: ["albums", "top_tracks"] });

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistDiscography).not.toHaveBeenCalled();
  });

  it("clears the discography for a new artist", async () => {
    const page = setupRowData({ rows: ["discography"] });
    mockLoadArtistDiscography.mockResolvedValue([
      album({ item_id: "release-1" }),
    ]);
    await showArtist(page, libraryArtist());

    let resolveSecond: (albums: Album[]) => void = () => {};
    mockLoadArtistDiscography.mockImplementationOnce(
      () =>
        new Promise<Album[]>((resolve) => {
          resolveSecond = resolve;
        }),
    );
    await showArtist(page, libraryArtist({ item_id: "artist-2" }));
    expect(page.discographyItems.value).toBeUndefined();

    resolveSecond([album({ item_id: "release-2" })]);
    await flushPromises();

    expect(itemIds(page.discographyItems.value)).toEqual(["release-2"]);
  });

  it("requests each discography row's own release types", async () => {
    const page = setupRowData({ rows: ["discography", "discography_second"] });
    mockLoadArtistDiscography.mockImplementation(async (_artist, types) => [
      album({ item_id: types!.join(",") }),
    ]);
    mockLoadArtistDiscographyCount.mockImplementation(async (_artist, types) =>
      types?.includes(AlbumType.LIVE) ? 17 : 123,
    );

    await showArtist(page, libraryArtist());

    expect(discographyTypeRequests()).toEqual([
      [AlbumType.ALBUM],
      [AlbumType.LIVE],
    ]);
    expect(itemIds(page.discographyItems.value)).toEqual(["album"]);
    expect(itemIds(page.discographySecondItems.value)).toEqual(["live"]);
    expect(page.discographyCount.value).toBe(123);
    expect(page.discographySecondCount.value).toBe(17);
  });

  it("shares one request between discography rows showing the same types", async () => {
    store.currentUser = user({
      preferences: {
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
          discography_second: [AlbumType.ALBUM],
        },
      },
    });
    const page = setupRowData({ rows: ["discography", "discography_second"] });

    await showArtist(page, libraryArtist());

    expect(discographyTypeRequests()).toEqual([[AlbumType.ALBUM]]);
    expect(mockLoadArtistDiscographyCount).toHaveBeenCalledTimes(1);
  });

  it("requests a discography row again when its types change", async () => {
    const page = setupRowData({ rows: ["discography"] });
    mockLoadArtistDiscographyCount.mockResolvedValueOnce(123);
    await showArtist(page, libraryArtist());
    let resolveCount!: (count: number) => void;
    mockLoadArtistDiscographyCount.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          resolveCount = resolve;
        }),
    );

    store.currentUser = user({
      preferences: {
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
          discography: [AlbumType.ALBUM, AlbumType.EP],
        },
      },
    });
    await flushPromises();
    expect(page.discographyCount.value).toBeUndefined();
    resolveCount(145);
    await flushPromises();
    expect(page.discographyCount.value).toBe(145);

    expect(discographyTypeRequests()).toEqual([
      [AlbumType.ALBUM],
      [AlbumType.ALBUM, AlbumType.EP],
    ]);
  });

  it("requests nothing for the rows of an audiobook artist", async () => {
    const page = setupRowData({ rows: ["audiobooks", "audiobooks_all"] });

    await showArtist(page, libraryArtist({ artist_type: ArtistType.AUTHOR }));

    expect(mockLoadArtistReleases).not.toHaveBeenCalled();
    expect(mockLoadArtistTracks).not.toHaveBeenCalled();
  });

  describe("automatic release rows", () => {
    /** Library counts per row; a provider's count is 7 for either row. */
    function countsByRow(albums: number, singles: number) {
      mockArtistAlbumsCountBySource.mockImplementation(
        async (_artist: Artist, source: RowSource, types: AlbumType[]) => {
          if (source !== "library") return 7;
          return types.includes(AlbumType.SINGLE) ? singles : albums;
        },
      );
    }

    /** Every release and count request, as "<row>:<source>". */
    function requests(): string[] {
      const row = (types?: AlbumType[]) =>
        types?.includes(AlbumType.SINGLE) ? "singles" : "albums";
      return [
        ...mockLoadArtistReleases.mock.calls.map(
          ([, source, options]) =>
            `releases:${row(options?.albumTypes)}:${source}`,
        ),
        ...mockArtistAlbumsCountBySource.mock.calls.map(
          ([, source, types]) => `count:${row(types)}:${source}`,
        ),
      ].sort();
    }

    beforeEach(() => {
      mockLoadArtistReleases.mockImplementation(async (_artist, source) =>
        source === "library"
          ? RELEASES
          : [
              album({ item_id: "spotify-album" }),
              album({
                item_id: "spotify-single",
                album_type: AlbumType.SINGLE,
              }),
            ],
      );
    });

    it("shows the library when it holds releases, requesting nothing else", async () => {
      countsByRow(3, 2);
      const page = setupRowData({ rows: ["albums", "singles_eps"] });

      await showArtist(page, libraryArtist());

      expect(requests()).toEqual([
        "count:albums:library",
        "count:singles:library",
        "releases:albums:library",
        "releases:singles:library",
      ]);
      expect(page.albumsSource.value).toBe("library");
      expect(page.albumsSelectedSource.value).toBe("auto");
      expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
    });

    it("turns to the mapped provider once the library count comes back empty", async () => {
      countsByRow(0, 0);
      let resolveCount!: (count: number) => void;
      mockArtistAlbumsCountBySource.mockImplementationOnce(
        () => new Promise<number>((resolve) => (resolveCount = resolve)),
      );
      mockApi.getProvider.mockReturnValue({
        name: "Spotify",
        domain: "spotify",
      });
      const page = setupRowData({ rows: ["albums"] });

      await showArtist(page, libraryArtist());
      // still deciding: the row keeps loading instead of showing an empty library
      expect(page.albumsSource.value).toBeUndefined();
      expect(page.albumItems.value).toBeUndefined();
      expect(page.albumsSourceDisplay.value).toEqual({ label: "Automatic" });

      resolveCount(0);
      await flushPromises();

      expect(requests()).toEqual([
        "count:albums:library",
        `count:albums:${SPOTIFY}`,
        "releases:albums:library",
        `releases:albums:${SPOTIFY}`,
      ]);
      expect(page.albumsSource.value).toBe(SPOTIFY);
      expect(page.albumsSelectedSource.value).toBe("auto");
      expect(itemIds(page.albumItems.value)).toEqual(["spotify-album"]);
      expect(page.albumsCount.value).toBe(7);
      expect(page.albumsSourceDisplay.value).toEqual({
        label: "On Spotify",
        domain: "spotify",
      });
    });

    it("decides each row from its own count", async () => {
      countsByRow(3, 0);
      const page = setupRowData({ rows: ["albums", "singles_eps"] });

      await showArtist(page, libraryArtist());

      expect(page.albumsSource.value).toBe("library");
      expect(page.singlesSource.value).toBe(SPOTIFY);
      expect(itemIds(page.singleItems.value)).toEqual(["spotify-single"]);
      expect(requests()).not.toContain(`releases:albums:${SPOTIFY}`);
    });

    it("stays on the library for an artist no provider can list albums for", async () => {
      countsByRow(0, 0);
      mockLoadArtistReleases.mockResolvedValue([]);
      const page = setupRowData({ rows: ["albums", "singles_eps"] });

      await showArtist(page, libraryArtist({ provider_mappings: [] }));

      expect(requests()).toEqual([
        "count:albums:library",
        "count:singles:library",
        "releases:albums:library",
        "releases:singles:library",
      ]);
      expect(page.albumsSource.value).toBe("library");
      expect(page.albumItems.value).toEqual([]);
    });

    it("keeps an explicit choice of the library", async () => {
      countsByRow(0, 0);
      saveRowSources({ albums: "library" });
      const page = setupRowData({ rows: ["albums"] });

      await showArtist(page, libraryArtist());

      expect(requests()).toEqual([
        "count:albums:library",
        "releases:albums:library",
      ]);
      expect(page.albumsSelectedSource.value).toBe("library");
    });

    it("keeps an explicit choice of a provider", async () => {
      countsByRow(3, 2);
      saveRowSources({ singles_eps: SPOTIFY });
      const page = setupRowData({ rows: ["singles_eps"] });

      await showArtist(page, libraryArtist());

      expect(requests()).toEqual([
        `count:singles:${SPOTIFY}`,
        `releases:singles:${SPOTIFY}`,
      ]);
      expect(page.singlesSource.value).toBe(SPOTIFY);
    });

    it("goes back to automatic when the saved choice is cleared", async () => {
      countsByRow(0, 0);
      saveRowSources({ albums: "library" });
      const page = setupRowData({ rows: ["albums"] });
      await showArtist(page, libraryArtist());
      expect(page.albumsSource.value).toBe("library");

      saveRowSources({});
      await flushPromises();

      expect(page.albumsSelectedSource.value).toBe("auto");
      expect(page.albumsSource.value).toBe(SPOTIFY);
      expect(itemIds(page.albumItems.value)).toEqual(["spotify-album"]);
    });

    it("stays on the library when the library count fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockArtistAlbumsCountBySource.mockRejectedValue(new Error("nope"));
      const page = setupRowData({ rows: ["albums"] });

      await showArtist(page, libraryArtist());

      expect(page.albumsSource.value).toBe("library");
      expect(releaseSources()).toEqual(["library"]);
    });

    it("comes back to the library once a library change adds releases", async () => {
      vi.useFakeTimers();
      countsByRow(0, 0);
      const page = setupRowData({ rows: ["albums"] });
      await showArtist(page, libraryArtist());
      expect(page.albumsSource.value).toBe(SPOTIFY);

      countsByRow(2, 0);
      const [, onLibraryChange] = mockApi.subscribe_multi.mock.lastCall!;
      onLibraryChange({
        event: EventType.MEDIA_ITEM_ADDED,
        data: album({ item_id: "added" }),
      });
      await vi.runAllTimersAsync();

      expect(page.albumsSource.value).toBe("library");
      expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
    });

    it("asks a provider nothing for a hidden row", async () => {
      countsByRow(0, 0);
      const page = setupRowData({ rows: ["top_tracks"] });

      await showArtist(page, libraryArtist());

      expect(mockArtistAlbumsCountBySource).not.toHaveBeenCalled();
      expect(mockLoadArtistReleases).not.toHaveBeenCalled();
    });
  });
});
