import {
  ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  type ArtistRowId,
  type ArtistRowSource,
} from "@/components/artist/artistRows";
import { useArtistRowData } from "@/composables/useArtistRowData";
import {
  AlbumType,
  ArtistType,
  ProviderFeature,
  ProviderType,
  type Album,
  type Artist,
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
  mockLoadArtistLibraryTracks,
  mockLoadArtistTopTracks,
  mockLoadSimilarArtists,
} = vi.hoisted(() => ({
  mockApi: {
    supportsArtistDiscography: true,
    getProvider: vi.fn(),
    providers: {} as Record<string, unknown>,
  },
  mockLoadArtistReleases:
    vi.fn<(artist: Artist, source: ArtistRowSource) => Promise<Album[]>>(),
  mockLoadArtistLibraryTracks: vi.fn<(artist: Artist) => Promise<Track[]>>(),
  mockLoadArtistTopTracks:
    vi.fn<(artist: Artist, source: ArtistRowSource) => Promise<Track[]>>(),
  mockLoadSimilarArtists:
    vi.fn<(artist: Artist, source: ArtistRowSource) => Promise<Artist[]>>(),
}));

vi.mock("@/plugins/api", () => ({ api: mockApi, default: mockApi }));

// the loaders are mocked, the pure helpers (sorting, single/EP and appearance
// checks) are the real ones so the rows are derived the way they are in the app
vi.mock("@/components/artist/artistData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/artist/artistData")>()),
  loadArtistReleases: mockLoadArtistReleases,
  loadArtistLibraryTracks: mockLoadArtistLibraryTracks,
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
function setupRowData(options: {
  rows: ArtistRowId[];
  isAudiobookArtist?: boolean;
}) {
  const artistRef = ref<Artist>();
  const visibleRows = ref<ArtistRowId[]>(options.rows);
  const isAudiobookArtist = ref(options.isAudiobookArtist ?? false);
  const scope = effectScope();
  scopes.push(scope);
  const rowData = scope.run(() =>
    useArtistRowData(artistRef, visibleRows, isAudiobookArtist),
  )!;
  return { artist: artistRef, visibleRows, ...rowData };
}

type RowData = ReturnType<typeof setupRowData>;

/** Puts an artist on the page, the way the view does once its details load. */
async function showArtist(page: RowData, item: Artist) {
  page.artist.value = item;
  await flushPromises();
}

/** The user's saved per-row sources, which the editor writes and rows follow. */
function saveRowSources(
  sources: Partial<Record<ArtistRowId, ArtistRowSource>>,
) {
  store.currentUser = user({
    preferences: { [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: sources },
  });
}

/** The source of every release request that was issued, in order. */
function releaseSources(): ArtistRowSource[] {
  return mockLoadArtistReleases.mock.calls.map(([, source]) => source);
}

function itemIds(items?: Array<{ item_id: string }>): string[] | undefined {
  return items?.map((item) => item.item_id);
}

describe("useArtistRowData", () => {
  beforeEach(() => {
    mockApi.supportsArtistDiscography = true;
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
    mockLoadArtistLibraryTracks.mockReset().mockResolvedValue([]);
    mockLoadArtistTopTracks.mockReset().mockResolvedValue([]);
    mockLoadSimilarArtists.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    store.currentUser = undefined;
  });

  it("requests one list for two rows fed by the same source", async () => {
    const page = setupRowData({ rows: ["albums", "singles_eps"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);

    await showArtist(page, libraryArtist());

    expect(releaseSources()).toEqual(["all"]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
    expect(itemIds(page.singleItems.value)).toEqual(["single-1"]);
  });

  it("requests a source switched to once, and serves the old one from the cache", async () => {
    const page = setupRowData({ rows: ["albums"] });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    await showArtist(page, libraryArtist());

    mockLoadArtistReleases.mockResolvedValue([album({ item_id: "album-2" })]);
    saveRowSources({ albums: SPOTIFY });
    await flushPromises();

    expect(releaseSources()).toEqual(["all", SPOTIFY]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-2"]);

    saveRowSources({});
    await flushPromises();

    expect(releaseSources()).toEqual(["all", SPOTIFY]);
    expect(itemIds(page.albumItems.value)).toEqual(["album-1"]);
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
    mockLoadArtistLibraryTracks.mockResolvedValue([
      track({ item_id: "older", album: album({ year: 1999 }) }),
      track({ item_id: "newer", album: album({ year: 2024 }) }),
    ]);

    await showArtist(page, libraryArtist());

    expect(mockLoadArtistTopTracks).toHaveBeenCalledTimes(1);
    expect(itemIds(page.topTracksItems.value)).toEqual(["newer", "older"]);
  });

  it("re-requests every loaded release source and the library tracks on refresh", async () => {
    const page = setupRowData({ rows: ["albums", "appears_on"] });
    saveRowSources({ albums: SPOTIFY });
    mockLoadArtistReleases.mockResolvedValue(RELEASES);
    mockLoadArtistLibraryTracks.mockResolvedValue([track()]);
    await showArtist(page, libraryArtist());

    expect(releaseSources()).toEqual(["all", SPOTIFY]);
    expect(mockLoadArtistLibraryTracks).toHaveBeenCalledTimes(1);

    page.refreshReleases();
    await flushPromises();

    expect(releaseSources()).toHaveLength(4);
    expect(releaseSources().slice(2)).toEqual(
      expect.arrayContaining(["all", SPOTIFY]),
    );
    expect(mockLoadArtistLibraryTracks).toHaveBeenCalledTimes(2);
  });

  it("never requests the full discography for a provider artist", async () => {
    const page = setupRowData({ rows: ["albums", "singles_eps"] });

    await showArtist(
      page,
      artist({
        item_id: "artist-2",
        provider: SPOTIFY,
        provider_mappings: [providerMapping({ provider_instance: SPOTIFY })],
      }),
    );

    expect(releaseSources()).toEqual([SPOTIFY]);
  });

  it("never requests a discography for an audiobook artist", async () => {
    const page = setupRowData({
      rows: ["audiobooks", "audiobooks_all"],
      isAudiobookArtist: true,
    });

    await showArtist(page, libraryArtist({ artist_type: ArtistType.AUTHOR }));

    expect(mockLoadArtistReleases).not.toHaveBeenCalled();
    expect(mockLoadArtistLibraryTracks).not.toHaveBeenCalled();
  });
});
